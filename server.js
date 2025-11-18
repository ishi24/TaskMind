// 1. IMPORT LIBRARIES
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const nodemailer = require('nodemailer');
const { addMinutes } = require('date-fns');
const path = require('path'); // NEW: Required to serve HTML files

// Configure Email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 2. INITIALIZE APP
const app = express();
const PORT = process.env.PORT || 3001; // UPDATED: Use cloud port or 3001

// 3. MIDDLEWARE
app.use(cors());
app.use(express.json());

// --- NEW: SERVE STATIC FILES ---
// This allows the server to send index.html, style.css, etc. to the browser
app.use(express.static(__dirname));

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

const userTimeZone = 'America/New_York';

// ---------- GEMINI HELPERS (RETRY + FALLBACK) ----------
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",       // preferred (price/perf)
  "gemini-2.5-flash-lite",  // fastest/cheapest GA fallback
  "gemini-2.0-flash-001"    // stable fallback still widely available
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
          // If your key is exported as GEMINI_API_KEY, SDK auto-detects it too.
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

/** Use Case 14: Update Profile (Name) */
app.put('/users/:userId/profile', async (req, res) => {
  try {
    const { fullName } = req.body;
    await dbPool.query('UPDATE users SET full_name = ? WHERE user_id = ?', [fullName, req.params.userId]);
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

/** Use Case 14: Change Password */
app.put('/users/:userId/password', async (req, res) => {
  const dbConnection = await dbPool.getConnection();
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.params.userId;

    // 1. Get current hash
    const [users] = await dbConnection.query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ message: 'User not found' });

    // 2. Verify Old Password
    const isMatch = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect current password' });
    }

    // 3. Hash New Password and Update
    const newHash = await bcrypt.hash(newPassword, 10);
    await dbConnection.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, userId]);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    dbConnection.release();
  }
});

/** Use Case 3 & 10: Create Task with Priority and Due Date */
app.post('/tasks', async (req, res) => {
  try {
    // Extract new fields
    const { title, owner_user_id, priority, dueDate } = req.body;

    if (!title || !owner_user_id) {
      return res.status(400).json({ message: 'Task title and user ID are required.' });
    }

    // Default values if not provided
    const taskPriority = priority || 'Medium';
    const taskDueDate = dueDate || null; // null allowed if no date picked

    // Updated SQL to include priority and due_date
    const sql = 'INSERT INTO tasks (title, owner_user_id, status, priority, due_date) VALUES (?, ?, ?, ?, ?)';

    const [result] = await dbPool.query(sql, [title, owner_user_id, 'todo', taskPriority, taskDueDate]);

    res.status(201).json({
      message: 'Task created successfully!',
      // Return the full object so the UI can render it immediately
      task: {
          taskId: result.insertId,
          title,
          status: 'todo',
          priority: taskPriority,
          due_date: taskDueDate
      }
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

/** Use Case 10, 11, 12: Get Tasks (Owned + Assigned + Shared Status) */
app.get('/tasks', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ message: 'User ID is required.' });

    const sql = `
      SELECT DISTINCT t.*,
             CASE WHEN t.owner_user_id = ? THEN 'owner' ELSE 'assignee' END as role,
             (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id = t.task_id) as assignment_count
      FROM tasks t
      LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
      WHERE t.owner_user_id = ? OR ta.assigned_to_user_id = ?
      ORDER BY
        COALESCE(t.parent_task_id, t.task_id) DESC,
        t.due_date ASC
    `;

    // We pass userId 3 times now (for role check, owner check, assignee check)
    const [tasks] = await dbPool.query(sql, [userId, userId, userId]);
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

/** Use Case 10: AI Prioritization (Fixed & Robust) */
app.post('/tasks/ai-prioritize', async (req, res) => {
  const { userId } = req.body;
  const dbConnection = await dbPool.getConnection();

  try {
    // 1. Fetch all "todo" tasks
    const [tasks] = await dbConnection.query(
      'SELECT task_id, title, priority FROM tasks WHERE owner_user_id = ? AND status = "todo"',
      [userId]
    );

    if (tasks.length === 0) {
      return res.status(200).json({ message: 'No tasks to rank.' });
    }

    // 2. Construct Prompt
    const taskListString = JSON.stringify(tasks.map(t => ({ id: t.task_id, title: t.title })));

    const prompt = `
    You are a strict productivity manager. Analyze this list of tasks and assign a priority ('High', 'Medium', 'Low').

    Rules:
    - "High": Urgent, deadlines, financial, critical.
    - "Medium": Standard work/chores.
    - "Low": Leisure, optional.

    Return ONLY a JSON object with a key "updates" containing an array of objects:
    { "id": <number>, "priority": <string> }

    Tasks:
    ${taskListString}
    `;

    // 3. Call Gemini
    const { text: jsonText } = await callGeminiWithRetry({ prompt });
    console.log("[AI Prioritize] Raw Response:", jsonText); // <--- LOGGING ADDED

    let result;
    try {
         result = JSON.parse(jsonText);
    } catch (e) {
         // Sometimes AI adds markdown ```json ... ``` wrappers. Strip them.
         const cleanText = jsonText.replace(/```json|```/g, '').trim();
         result = JSON.parse(cleanText);
    }

    if (!result.updates || !Array.isArray(result.updates)) {
      throw new Error("Invalid AI response format");
    }

    // 4. Update Database (with safeguards)
    await dbConnection.beginTransaction();

    for (const update of result.updates) {
        // Handle case sensitivity (priority vs Priority) or missing values
        let p = update.priority || update.Priority || 'Medium';

        // Ensure strict capitalization for DB consistency
        p = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
        if (!['High', 'Medium', 'Low'].includes(p)) p = 'Medium';

        await dbConnection.query(
            'UPDATE tasks SET priority = ? WHERE task_id = ?',
            [p, update.id]
        );
    }

    await dbConnection.commit();
    res.status(200).json({ message: 'Tasks prioritized by AI!' });

  } catch (error) {
    try { await dbConnection.rollback(); } catch {}
    console.error('AI Prioritize Error:', error);
    res.status(500).json({ message: 'Failed to prioritize tasks.' });
  } finally {
    dbConnection.release();
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

/** Use Case 10 & 13: Update Task (Mark Done/Undone) */
app.put('/tasks/:taskId', async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { status } = req.body; // 'done' or 'todo'

    if (!status) return res.status(400).json({ message: 'Status is required.' });

    let sql;
    let params;

    if (status === 'done') {
        // If marking done, save the CURRENT timestamp
        sql = 'UPDATE tasks SET status = ?, completed_at = NOW() WHERE task_id = ?';
        params = [status, taskId];
    } else {
        // If unchecking, clear the timestamp
        sql = 'UPDATE tasks SET status = ?, completed_at = NULL WHERE task_id = ?';
        params = [status, taskId];
    }

    await dbPool.query(sql, params);
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

/** Use Case 7: Create Reminder */
app.post('/tasks/:taskId/reminders', async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const { remindAt } = req.body; // Format: "YYYY-MM-DD HH:MM"

    if (!remindAt) return res.status(400).json({ message: 'Reminder time is required.' });

    // Insert into the 'task_reminders' table
    const sql = 'INSERT INTO task_reminders (task_id, remind_at, status) VALUES (?, ?, ?)';
    await dbPool.query(sql, [taskId, remindAt, 'pending']);

    res.status(201).json({ message: 'Reminder set successfully!' });
  } catch (error) {
    console.error('Error setting reminder:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- NEW: REMINDER LOGIC (REPLACES THE TERMINAL LOOP) ---
/** Check for due reminders (Frontend calls this every 30s) */
app.get('/reminders/check', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "UserId required" });

    try {
        // Find reminders that are due (<= NOW) and still 'pending'
        // We join with tasks to get the title
        const sql = `
          SELECT r.reminder_id, t.title, r.remind_at
          FROM task_reminders r
          JOIN tasks t ON r.task_id = t.task_id
          WHERE t.owner_user_id = ? AND r.status = 'pending' AND r.remind_at <= NOW()
        `;
        const [dueReminders] = await dbPool.query(sql, [userId]);
        res.json(dueReminders);
    } catch (error) {
        console.error("Check reminder error:", error);
        res.status(500).json([]);
    }
});
/** Mark reminder as seen (Frontend calls this after showing alert) */
app.post('/reminders/ack', async (req, res) => {
    const { reminderIds } = req.body; // Expects array of IDs
    if (!reminderIds || reminderIds.length === 0) return res.sendStatus(200);

    try {
        await dbPool.query(
            `UPDATE task_reminders SET status = 'sent' WHERE reminder_id IN (?)`,
            [reminderIds]
        );
        res.json({ success: true });
    } catch (error) {
        console.error("Ack reminder error:", error);
        res.status(500).json({ error: "Failed to update" });
    }
});

/** Use Case 8: AI Email Drafter */
app.post('/ai-email-draft', async (req, res) => {
  const { recipient, context, tone } = req.body; // e.g. "Professional", "Casual"

  try {
    const prompt = `
    You are an expert communication assistant. Write an email based on the following context.

    Recipient: ${recipient || "Unknown"}
    Context/Goal: ${context}
    Tone: ${tone || "Professional"}

    Return ONLY a JSON object with these keys:
    - "subject": A clear, concise subject line.
    - "body": The email body text (plain text, no markdown).

    Your JSON:
    `;

    const { text: jsonText } = await callGeminiWithRetry({ prompt });
    console.log("[AI Email] Response:", jsonText);

    let result;
    try {
        // Clean markdown if present
        const cleanText = jsonText.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanText);
    } catch (e) {
        throw new Error("AI returned invalid JSON");
    }

    res.status(200).json(result);

  } catch (error) {
    console.error("AI Email Error:", error);
    res.status(500).json({ message: "Failed to draft email." });
  }
});

/** Use Case 9: AI Study Planner */
app.post('/ai-study-plan', async (req, res) => {
  const { userId, subject, examDate, focusAreas } = req.body;
  const dbConnection = await dbPool.getConnection();

  try {
    const today = new Date();
    const exam = new Date(examDate);
    const daysUntil = Math.ceil((exam - today) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 0) {
      return res.status(400).json({ message: "Exam date must be in the future." });
    }

    const prompt = `
    You are a strict academic tutor. Create a study plan for a student.

    Subject: "${subject}"
    Focus Areas: "${focusAreas || 'General comprehensive review'}"
    Days until exam: ${daysUntil}
    Exam Date: ${examDate}

    Goal: Break this down into ${Math.min(daysUntil, 5)} - ${Math.min(daysUntil, 10)} distinct study tasks.
    Spread the dates out starting from tomorrow up to the day before the exam.

    Return ONLY a JSON object with a key "plan" containing an array of objects.
    Each object must have:
    - "title": Actionable study task (e.g., "Review Chapter 1-3", "Practice Problems").
    - "date": The specific date for this task (YYYY-MM-DD format).

    Your JSON:
    `;

    const { text: jsonText } = await callGeminiWithRetry({ prompt });
    console.log("[AI Study Plan] Response:", jsonText);

    let result;
    try {
        const cleanText = jsonText.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanText);
    } catch (e) {
        throw new Error("AI returned invalid JSON");
    }

    if (!result.plan || !Array.isArray(result.plan)) {
        throw new Error("Invalid plan format.");
    }

    // Save to Database
    await dbConnection.beginTransaction();

    const sql = 'INSERT INTO tasks (owner_user_id, title, status, priority, due_date) VALUES ?';
    // We default these tasks to "High" priority
    const values = result.plan.map(item => [
        userId,
        `📚 ${item.title}`, // Add emoji to distinguish study tasks
        'todo',
        'High',
        item.date
    ]);

    if (values.length > 0) {
        await dbConnection.query(sql, [values]);
    }

    await dbConnection.commit();
    res.status(201).json({ message: `Generated ${values.length} study tasks!`, count: values.length });

  } catch (error) {
    try { await dbConnection.rollback(); } catch {}
    console.error("AI Study Plan Error:", error);
    res.status(500).json({ message: "Failed to generate plan." });
  } finally {
    dbConnection.release();
  }
});

/** Use Case 12: Get Comments for a Task */
app.get('/tasks/:taskId/comments', async (req, res) => {
    try {
        const [comments] = await dbPool.query(`
            SELECT c.*, u.full_name
            FROM task_comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC
        `, [req.params.taskId]);
        res.status(200).json(comments);
    } catch (error) {
        res.status(500).json({ message: "Error fetching comments" });
    }
});

/** Use Case 11 & 12: Assign Task to User */
app.post('/tasks/:taskId/assign', async (req, res) => {
  const { email } = req.body;
  const taskId = req.params.taskId;

  try {
    // 1. Find the user ID by email
    const [users] = await dbPool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User with that email not found.' });
    }
    const assigneeId = users[0].user_id;

    // 2. Assign the task
    // (Ignore duplicate errors if already assigned)
    try {
        await dbPool.query(
            'INSERT INTO task_assignments (task_id, assigned_to_user_id) VALUES (?, ?)',
            [taskId, assigneeId]
        );
    } catch (e) {
        // If already assigned, just proceed
    }

    res.status(200).json({ message: `Task assigned to ${email}!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Use Case 12: Add a Comment */
app.post('/tasks/:taskId/comments', async (req, res) => {
    try {
        const { userId, text } = req.body;
        if (!text) return res.status(400).json({ message: "Comment cannot be empty" });

        await dbPool.query(
            'INSERT INTO task_comments (task_id, user_id, comment_text) VALUES (?, ?, ?)',
            [req.params.taskId, userId, text]
        );
        res.status(201).json({ message: "Comment added" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error saving comment" });
    }
});

/** Use Case 13: Get Productivity Metrics */
app.get('/analytics', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    try {
        // 1. Get total counts
        const [counts] = await dbPool.query(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
            FROM tasks
            WHERE owner_user_id = ?
        `, [userId]);

        const total = counts[0].total || 0;
        const completed = counts[0].completed || 0;
        const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

        // 2. Calculate Streak (Complex Logic simplified)
        // Fetch all unique dates where tasks were completed, ordered newest first
        const [dates] = await dbPool.query(`
            SELECT DISTINCT DATE(completed_at) as dateVal
            FROM tasks
            WHERE owner_user_id = ? AND status = 'done' AND completed_at IS NOT NULL
            ORDER BY dateVal DESC
        `, [userId]);

        let streak = 0;
        if (dates.length > 0) {
            const today = new Date();
            today.setHours(0,0,0,0);

            // Check if the most recent completion was today or yesterday
            const lastActive = new Date(dates[0].dateVal);
            const diffDays = (today - lastActive) / (1000 * 60 * 60 * 24);

            if (diffDays <= 1) {
                streak = 1; // Started the streak
                // Check previous days
                for (let i = 0; i < dates.length - 1; i++) {
                    const curr = new Date(dates[i].dateVal);
                    const prev = new Date(dates[i+1].dateVal);
                    // If gap is exactly 1 day, increment streak
                    const gap = (curr - prev) / (1000 * 60 * 60 * 24);
                    if (Math.round(gap) === 1) {
                        streak++;
                    } else {
                        break; // Streak broken
                    }
                }
            }
        }

        res.status(200).json({
            total,
            completed,
            completionRate,
            streak
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

/** Use Case 15: Request Password Reset (REAL EMAIL) */
app.post('/auth/forgot', async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await dbPool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
        return res.status(200).json({ message: 'If that email exists, a code has been sent.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await dbPool.query('UPDATE users SET reset_token = ? WHERE email = ?', [code, email]);

    // --- REAL EMAIL SENDING ---
    const mailOptions = {
      from: `"TaskMind Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Password Reset Code',
      text: `Here is your recovery code for TaskMind: ${code}\n\nIf you did not request this, please ignore this email.`
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email}`);
    // --------------------------

    res.status(200).json({ message: 'Code sent to your email!' });
  } catch (error) {
    console.error("Email Error:", error);
    res.status(500).json({ message: 'Failed to send email. Check server logs.' });
  }
});

/** Use Case 8 (Extension): Send Drafted Email */
app.post('/email/send', async (req, res) => {
  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
      return res.status(400).json({ message: "Missing email fields." });
  }

  try {
    const mailOptions = {
      from: `"TaskMind Assistant" <${process.env.EMAIL_USER}>`, // Sender is YOU (the app)
      to: to,
      subject: subject,
      text: body
      // html: body.replace(/\n/g, '<br>') // Optional: If you wanted HTML emails
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully!" });

  } catch (error) {
    console.error("Send Error:", error);
    res.status(500).json({ message: "Failed to send email." });
  }
});

/** Use Case 15: Confirm Reset (Step 2) */
app.post('/auth/reset', async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    // 1. Verify Code
    const [users] = await dbPool.query('SELECT user_id FROM users WHERE email = ? AND reset_token = ?', [email, code]);

    if (users.length === 0) {
        return res.status(400).json({ message: 'Invalid code or email.' });
    }

    // 2. Hash New Password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. Update Password and Clear Token
    await dbPool.query(
        'UPDATE users SET password_hash = ?, reset_token = NULL WHERE user_id = ?',
        [hashedPassword, users[0].user_id]
    );

    res.status(200).json({ message: 'Password reset successful! You can now login.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- NEW: Catch-all handler ---
// If user goes to generic URL, send them index.html or login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. START SERVER
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
