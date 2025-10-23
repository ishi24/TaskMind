// 1. IMPORT LIBRARIES
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Only need addMinutes; no tz helpers required
const { addMinutes } = require('date-fns');

// 2. INITIALIZE APP
const app = express();
const PORT = 3001;

// 3. MIDDLEWARE
app.use(cors());
app.use(express.json());

// 4. DB POOL
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// --- CONSTANTS ---
const userTimeZone = 'America/New_York';

// ---------- GEMINI HELPERS (RETRY + FALLBACK) ----------
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",       // preferred (price/perf) :contentReference[oaicite:3]{index=3}
  "gemini-2.5-flash-lite",  // fastest/cheapest GA fallback :contentReference[oaicite:4]{index=4}
  "gemini-2.0-flash-001"    // stable fallback still widely available :contentReference[oaicite:5]{index=5}
];

// Truncated exponential backoff with jitter (ms)
function backoffDelay(attempt, base = 300, max = 8000) {
  const exp = Math.min(max, base * Math.pow(2, attempt)); // 0→300,1→600,2→1200...
  const jitter = Math.floor(Math.random() * 250);         // add 0–249ms jitter
  return Math.min(max, exp + jitter);
}

// Returns response text or throws
async function callGeminiWithRetry({ prompt, maxAttempts = 6 }) {
  let lastErr;
  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const resp = await ai.models.generateContent({
          model,
          // If your key is exported as GEMINI_API_KEY, SDK auto-detects it too. :contentReference[oaicite:6]{index=6}
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        // Extract text regardless of SDK response shape
        let txt = (resp?.response?.text && resp.response.text()) || resp?.text || resp?.output_text || "";
        txt = (txt || "").replace(/```json|```/g, "").trim();
        if (!txt) throw new Error("Empty response from model.");
        return { text: txt, modelUsed: model };
      } catch (err) {
        lastErr = err;

        // Pull status code if present
        const code = (err?.status) || (err?.error?.code) || (err?.response?.status);
        const message = err?.message || String(err);

        // Retry on these transient cases (503 overloaded, 429 rate, 500 internal)
        const retriable = code === 503 || code === 429 || code === 500 || /UNAVAILABLE|overloaded|Resource exhausted/i.test(message);

        if (retriable && attempt < maxAttempts - 1) {
          const wait = backoffDelay(attempt);
          console.warn(`[Gemini] ${code || ''} ${message} — retrying in ${wait}ms (attempt ${attempt + 1}/${maxAttempts}) on ${model}`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        // If not retriable OR retries exhausted, try next model or ultimately throw
        console.warn(`[Gemini] Giving up on ${model} (attempts: ${attempt + 1}).`);
        break;
      }
    }
    // try next model in the list
    console.warn(`[Gemini] Trying fallback model...`);
  }
  // Out of candidates
  throw lastErr;
}
// -------------------------------------------------------

// --- API ENDPOINTS ---

/** Use Case 1: Implement User.signUp() */
app.post('/signup', async (req, res) => {
  const dbConnection = await dbPool.getConnection();
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    await dbConnection.beginTransaction();
    const hashedPassword = await bcrypt.hash(password, 10);
    const userSql = 'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)';
    const [userResult] = await dbConnection.query(userSql, [fullName, email, hashedPassword]);
    const newUserId = userResult.insertId;

    const calendarSql = 'INSERT INTO calendars (owner_user_id, name) VALUES (?, ?)';
    await dbConnection.query(calendarSql, [newUserId, 'My Calendar']);

    await dbConnection.commit();
    res.status(201).json({ message: 'User created successfully! Please log in.' });
  } catch (error) {
    try { await dbConnection.rollback(); } catch {}
    console.error('Error during sign-up:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Error: Email already in use.' });
    }
    res.status(500).json({ message: 'Server error' });
  } finally {
    dbConnection.release();
  }
});

/** NEW!! Use Case 2: Implement User.logIn() */
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    const [users] = await dbPool.query(sql, [email]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    res.status(200).json({
      message: 'Login successful!',
      user: { userId: user.user_id, fullName: user.full_name, email: user.email }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Use Case 3: Implement User.createTask() */
app.post('/tasks', async (req, res) => {
  try {
    const { title, owner_user_id } = req.body;
    if (!title || !owner_user_id) {
      return res.status(400).json({ message: 'Task title and user ID are required.' });
    }

    const sql = 'INSERT INTO tasks (title, owner_user_id, status) VALUES (?, ?, ?)';
    const [result] = await dbPool.query(sql, [title, owner_user_id, 'todo']);

    res.status(201).json({
      message: 'Task created successfully!',
      task: { taskId: result.insertId, title, status: 'todo' }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Use Case 5: Create an Event (conflict detection removed) */
app.post('/events', async (req, res) => {
  const dbConnection = await dbPool.getConnection();
  try {
    const { title, startTime, endTime, owner_user_id } = req.body;
    if (!title || !startTime || !endTime || !owner_user_id) {
      return res.status(400).json({ message: 'All event fields are required.' });
    }

    const calendarSql = 'SELECT calendar_id FROM calendars WHERE owner_user_id = ? LIMIT 1';
    const [calendars] = await dbConnection.query(calendarSql, [owner_user_id]);
    if (calendars.length === 0) {
      return res.status(404).json({ message: 'User calendar not found.' });
    }
    const calendarId = calendars[0].calendar_id;

    console.log("--- Creating Event ---");
    console.log("Received Title:", title);
    console.log("Received StartTime:", startTime);
    console.log("Received EndTime:", endTime);
    console.log("Saving to Calendar ID:", calendarId);

    const eventSql = 'INSERT INTO events (calendar_id, title, start_time, end_time) VALUES (?, ?, ?, ?)';
    const [result] = await dbConnection.query(eventSql, [calendarId, title, startTime, endTime]);

    res.status(201).json({
      message: 'Event created successfully!',
      event: { eventId: result.insertId, title, start_time: startTime, end_time: endTime }
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    dbConnection.release();
  }
});

/** NEW!! Use Case 10: Get User's Tasks */
app.get('/tasks', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ message: 'User ID is required.' });

    const sql = `
      SELECT * FROM tasks
      WHERE owner_user_id = ?
      ORDER BY
        COALESCE(parent_task_id, task_id),
        parent_task_id IS NOT NULL,
        created_at ASC
    `;
    const [tasks] = await dbPool.query(sql, [userId]);
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** NEW!! Use Case 5: Get User's Events */
app.get('/events', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ message: 'User ID is required.' });

    const sql = `
      SELECT e.* FROM events e
      JOIN calendars c ON e.calendar_id = c.calendar_id
      WHERE c.owner_user_id = ?
      ORDER BY e.start_time ASC
    `;
    const [events] = await dbPool.query(sql, [userId]);
    res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** NEW!! Use Case 10: Delete a Task (cascade children) */
app.delete('/tasks/:taskId', async (req, res) => {
  const dbConnection = await dbPool.getConnection();
  try {
    const taskId = req.params.taskId;
    await dbConnection.beginTransaction();

    await dbConnection.query('DELETE FROM tasks WHERE parent_task_id = ?', [taskId]);
    await dbConnection.query('DELETE FROM tasks WHERE task_id = ?', [taskId]);

    await dbConnection.commit();
    res.status(200).json({ message: 'Task (and any subtasks) deleted successfully' });
  } catch (error) {
    try { await dbConnection.rollback(); } catch {}
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    dbConnection.release();
  }
});

/** NEW!! Use Case 10: Update a Task */
app.put('/tasks/:taskId', async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required.' });

    await dbPool.query('UPDATE tasks SET status = ? WHERE task_id = ?', [status, taskId]);
    res.status(200).json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** NEW!! Use Case 5: Delete an Event */
app.delete('/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    await dbPool.query('DELETE FROM events WHERE event_id = ?', [eventId]);
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** NEW!! Use Case 4: AI Task Decomposition */
app.post('/tasks/:id/decompose', async (req, res) => {
  const { id: parentTaskId } = req.params;
  const { userId } = req.body;
  const dbConnection = await dbPool.getConnection();

  try {
    await dbConnection.beginTransaction();

    const [parentTasks] = await dbConnection.query('SELECT title FROM tasks WHERE task_id = ?', [parentTaskId]);
    if (parentTasks.length === 0) {
      return res.status(404).json({ message: 'Parent task not found.' });
    }
    const parentTitle = parentTasks[0].title;

    const prompt = `
You are a project management assistant. Break the following complex task into 3-5 small, actionable subtasks.
Return ONLY a valid JSON object with a single key "subtasks", which is an array of strings.
Do not include markdown tags like \`\`\`json or any other text.

Example Task: "Write final research paper"
Your JSON:
{
  "subtasks": [
    "Draft outline",
    "Gather 5 academic sources",
    "Write introduction",
    "Write body paragraphs",
    "Write conclusion and proofread"
  ]
}

Now, decompose this task: "${parentTitle}"
    `;

    const { text: jsonText, modelUsed } = await callGeminiWithRetry({ prompt });
    console.log(`[Gemini] Decompose used model: ${modelUsed}`);

    const parsed = JSON.parse(jsonText);
    if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
      throw new Error('AI returned invalid subtask format.');
    }

    const taskSql = 'INSERT INTO tasks (owner_user_id, title, status, parent_task_id) VALUES ?';
    const taskValues = parsed.subtasks.map(title => [userId, title, 'todo', parentTaskId]);

    await dbConnection.query(taskSql, [taskValues]);
    await dbConnection.commit();

    const [newSubtasks] = await dbConnection.query('SELECT * FROM tasks WHERE parent_task_id = ?', [parentTaskId]);
    res.status(201).json({ message: 'Task decomposed successfully!', subtasks: newSubtasks });
  } catch (error) {
    try { await dbConnection.rollback(); } catch {}
    console.error('Decompose Error:', error);
    res.status(500).json({ message: "Error decomposing task" });
  } finally {
    dbConnection.release();
  }
});

// --- AI Quick Add (conflict detection removed) ---
app.post('/ai-quick-add', async (req, res) => {
  const { text, userId } = req.body;
  const dbConnection = await dbPool.getConnection();

  try {
    const now = new Date();

    // Local-time string for the prompt (no date-fns-tz)
    const localDateString = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(now);

    const isoNow = now.toISOString();
    const timeZoneName = userTimeZone;

    const prompt = `
You are a task-parsing assistant. Analyze the user's text and return ONLY a valid JSON object.
Do not include markdown tags.

The JSON object must have keys "events" and "tasks".
- "events": Array of objects. Each MUST have "title" (Title Case), "startTimeISO" (an exact ISO 8601 **UTC** string that **must end with 'Z'**, e.g., "2025-10-22T19:30:00.000Z"), and "durationMinutes" (number). If a duration is not mentioned, default to 60.
- "tasks": Array of objects. Each MUST have "title" (Title Case).
- Return empty arrays if no events or tasks are found.

DATE CONTEXT: The user is in the "${timeZoneName}" timezone.
Their current local time is: ${localDateString}
The current UTC time is: ${isoNow}
Use this context for all relative terms like "tomorrow", "next week", "at 7:30 pm".

Example 1 (Assuming current time is Oct 21, 2025 in ${timeZoneName}):
User text: "Meet Sam next Tuesday at 2pm for 1 hour and remind me to prep docs"
Your JSON:
{ "events": [ { "title": "Meet Sam", "startTimeISO": "2025-10-28T18:00:00.000Z", "durationMinutes": 60 } ], "tasks": [ { "title": "Prep Docs" } ] }

Example 2 (Assuming current time is Oct 21, 2025 in ${timeZoneName}):
User text: "Family Dinner tomorrow at 7:30 pm for 90 minutes"
Your JSON:
{ "events": [ { "title": "Family Dinner", "startTimeISO": "2025-10-22T23:30:00.000Z", "durationMinutes": 90 } ], "tasks": [] }

Now, parse this text: "${text}"
    `;

    const { text: jsonText, modelUsed } = await callGeminiWithRetry({ prompt });
    console.log(`[Gemini] Quick Add used model: ${modelUsed}`);
    console.log("AI Raw Response:", jsonText);

    let parsedAiResult = { events: [], tasks: [] };
    try {
      parsedAiResult = JSON.parse(jsonText);
      if (!Array.isArray(parsedAiResult.events)) parsedAiResult.events = [];
      if (!Array.isArray(parsedAiResult.tasks)) parsedAiResult.tasks = [];
    } catch (e) {
      console.error("AI JSON parse error:", e, "Raw Text:", jsonText);
      return res.status(502).json({ message: "AI returned invalid JSON." });
    }
    console.log("AI Parsed Result:", parsedAiResult);

    await dbConnection.beginTransaction();

    const calendarSql = 'SELECT calendar_id FROM calendars WHERE owner_user_id = ? LIMIT 1';
    const [calendars] = await dbConnection.query(calendarSql, [userId]);
    if (calendars.length === 0) throw new Error('User calendar not found.');
    const calendarId = calendars[0].calendar_id;

    const createdItems = { events: [], tasks: [] };

    // Create Events
    if (parsedAiResult.events.length > 0) {
      const eventInserts = [];
      for (const eventData of parsedAiResult.events) {
        if (!eventData.startTimeISO || !eventData.title) continue;

        if (!/Z$/i.test(eventData.startTimeISO)) {
          console.warn(`Skipping event without UTC 'Z' suffix: ${eventData.startTimeISO}`);
          continue;
        }

        let startTimeUtc;
        try {
          startTimeUtc = new Date(eventData.startTimeISO);
          if (isNaN(startTimeUtc.getTime())) throw new Error('Invalid ISO 8601 date string.');
        } catch (parseError) {
          console.error(`Date parsing backend error for "${eventData.startTimeISO}":`, parseError);
          continue;
        }

        const duration = Number.isFinite(eventData.durationMinutes) ? eventData.durationMinutes : 60;
        const endTimeUtc = addMinutes(startTimeUtc, duration);

        eventInserts.push([calendarId, eventData.title, startTimeUtc, endTimeUtc]);
        createdItems.events.push({
          title: eventData.title,
          start_time: startTimeUtc.toISOString(),
          end_time: endTimeUtc.toISOString()
        });
      }

      if (eventInserts.length > 0) {
        const eventSql = 'INSERT INTO events (calendar_id, title, start_time, end_time) VALUES ?';
        await dbConnection.query(eventSql, [eventInserts]);
      }
    }

    // Create Tasks
    if (parsedAiResult.tasks.length > 0) {
      const taskSql = 'INSERT INTO tasks (owner_user_id, title, status) VALUES ?';
      const taskValues = parsedAiResult.tasks.map(t => [userId, t.title, 'todo']);
      if (taskValues.length > 0) {
        await dbConnection.query(taskSql, [taskValues]);
        parsedAiResult.tasks.forEach(t => createdItems.tasks.push({ title: t.title, status: 'todo' }));
      }
    }

    await dbConnection.commit();

    if (createdItems.events.length > 0 || createdItems.tasks.length > 0) {
      return res.status(200).json({ message: "Successfully added items!", created: createdItems });
    } else if (parsedAiResult.events.length > 0 || parsedAiResult.tasks.length > 0) {
      return res.status(500).json({ message: "Could not process extracted details. Please try rephrasing." });
    } else {
      return res.status(200).json({ message: "No events or tasks found in text.", created: createdItems });
    }
  } catch (error) {
    try { await dbConnection.rollback(); } catch {}
    console.error('AI Quick Add General Error:', error);
    res.status(500).json({ message: "Error processing AI request" });
  } finally {
    dbConnection.release();
  }
});

// 5. START THE SERVER
app.listen(PORT, () => {
  console.log(`✅ Backend server is running on http://localhost:${PORT}`);
});
