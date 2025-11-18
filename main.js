// Automatically uses the current domain (works for localhost AND taskmindofficial.com)
const API_URL = window.location.origin;

// We get the current page's path to decide which logic to run
const currentPage = window.location.pathname;

if (currentPage.includes('signup.html')) {
    setupSignupForm();
} else if (currentPage.includes('login.html')) {
    setupLoginForm();
} else if (currentPage.includes('dashboard.html')) {
    setupDashboard();
} else if (currentPage.includes('settings.html')) { 
    setupSettings();
} else if (currentPage.includes('reset.html')) { 
    setupReset();
}

/**
 * Logic for the Sign Up Page (signup.html)
 */
function setupSignupForm() {
    const signupForm = document.getElementById('signupForm');
    const messageEl = document.getElementById('message');

    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        messageEl.className = 'message';
        messageEl.textContent = '';
        
        try {
            const response = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, email, password })
            });

            const result = await response.json();

            if (response.ok) {
                messageEl.textContent = result.message;
                messageEl.className = 'message success';
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                messageEl.textContent = result.message;
                messageEl.className = 'message error';
            }
        } catch (error) {
            messageEl.textContent = 'Could not connect to server. Please try again.';
            messageEl.className = 'message error';
        }
    });
}

/**
 * Logic for the Login Page (login.html)
 */
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const messageEl = document.getElementById('message');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        messageEl.className = 'message';
        messageEl.textContent = '';

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('taskMindUser', JSON.stringify(result.user));
                window.location.href = 'dashboard.html';
            } else {
                messageEl.textContent = result.message;
                messageEl.className = 'message error';
            }
        } catch (error) {
            messageEl.textContent = 'Could not connect to server. Please try again.';
            messageEl.className = 'message error';
        }
    });
}

/**
 * Logic for Settings Page
 */
function setupSettings() {
    const userStr = localStorage.getItem('taskMindUser');
    if (!userStr) { window.location.href = 'login.html'; return; }
    
    let user = JSON.parse(userStr); // Use 'let' so we can update it

    // 1. Logout Button
    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem('taskMindUser');
        window.location.href = 'index.html';
    });

    // 2. Pre-fill Profile Data
    document.getElementById('settingsEmail').value = user.email;
    document.getElementById('settingsName').value = user.fullName;

    // 3. Update Profile Handler
    const profileForm = document.getElementById('profileForm');
    const profileMessage = document.getElementById('profileMessage');

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('settingsName').value;
        
        try {
            const res = await fetch(`${API_URL}/users/${user.userId}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: newName })
            });
            if (res.ok) {
                profileMessage.textContent = 'Saved!';
                profileMessage.className = 'message success';
                // Update LocalStorage
                user.fullName = newName;
                localStorage.setItem('taskMindUser', JSON.stringify(user));
            } else {
                profileMessage.textContent = 'Error updating profile.';
                profileMessage.className = 'message error';
            }
        } catch (err) { console.error(err); }
    });

    // 4. Change Password Handler
    const passwordForm = document.getElementById('passwordForm');
    const passwordMessage = document.getElementById('passwordMessage');

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = document.getElementById('oldPassword').value;
        const newPass = document.getElementById('newPassword').value;

        try {
            const res = await fetch(`${API_URL}/users/${user.userId}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
            });
            const data = await res.json();
            
            if (res.ok) {
                passwordMessage.textContent = data.message;
                passwordMessage.className = 'message success';
                document.getElementById('passwordForm').reset();
            } else {
                passwordMessage.textContent = data.message;
                passwordMessage.className = 'message error';
            }
        } catch (err) { 
            passwordMessage.textContent = 'Server error';
            passwordMessage.className = 'message error';
        }
    });

    // 5. Simulate Integrations
    const toggles = [document.getElementById('toggleGoogle'), document.getElementById('toggleOutlook')];
    const intMsg = document.getElementById('integrationMessage');

    toggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                intMsg.textContent = "Connecting to external service... (Simulation: Connected!)";
                intMsg.className = "message success";
            } else {
                intMsg.textContent = "Disconnected.";
                intMsg.className = "message info";
            }
        });
    });
}

function setupReset() {
    const requestForm = document.getElementById('requestResetForm');
    const confirmForm = document.getElementById('confirmResetForm');
    const msg = document.getElementById('resetMessage');
    const emailInput = document.getElementById('resetEmail');

    // Step 1: Request Code
    requestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        msg.textContent = 'Sending...';
        msg.className = 'message info';

        try {
            const res = await fetch(`${API_URL}/auth/forgot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            if (res.ok) {
                // Hide Step 1, Show Step 2
                requestForm.style.display = 'none';
                confirmForm.style.display = 'block';
                msg.textContent = ''; 
            } else {
                msg.textContent = 'Error sending code.';
                msg.className = 'message error';
            }
        } catch (err) { console.error(err); }
    });

    // Step 2: Confirm Reset
    confirmForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('resetCode').value;
        const newPassword = document.getElementById('newResetPassword').value;
        const email = emailInput.value; // Use the value from step 1

        try {
            const res = await fetch(`${API_URL}/auth/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });
            const result = await res.json();

            if (res.ok) {
                msg.textContent = result.message;
                msg.className = 'message success';
                setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            } else {
                msg.textContent = result.message;
                msg.className = 'message error';
            }
        } catch (err) {
            msg.textContent = 'Server connection failed.';
            msg.className = 'message error';
        }
    });
}

/**
 * Logic for the Dashboard Page (dashboard.html)
 */
async function setupDashboard() {
    // 1. Get user data from localStorage
    const userData = localStorage.getItem('taskMindUser');
    
    if (!userData) {
        window.location.href = 'login.html';
        return;
    }
    const user = JSON.parse(userData);

    // 2. Personalize the page
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.textContent = `Welcome, ${user.fullName}!`;

    // 3. Setup Logout Button
    const logoutButton = document.getElementById('logoutButton');
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('taskMindUser');
        window.location.href = 'index.html';
    });

    // --- (FIX) DEFINE ALL VARIABLES AT THE TOP ---
    const aiForm = document.getElementById('aiQuickAddForm');
    const aiInput = document.getElementById('aiInput');
    const aiMessage = document.getElementById('aiMessage');

    const taskForm = document.getElementById('taskForm');
    const taskMessage = document.getElementById('taskMessage');
    const taskListDiv = document.getElementById('taskList');

    const eventForm = document.getElementById('eventForm');
    const eventMessage = document.getElementById('eventMessage');
    const eventListDiv = document.getElementById('eventList');
    // --- END VARIABLE DEFINITIONS ---

    // --- AI Prioritize Button Listener ---
    const aiRankBtn = document.getElementById('aiPrioritizeBtn');
    
    // --- AI Email Drafter Logic ---
    const btnDraftEmail = document.getElementById('btnDraftEmail');
    const btnOpenMail = document.getElementById('btnOpenMail');
    const emailRecipient = document.getElementById('emailRecipient');
    const emailContext = document.getElementById('emailContext');
    const emailSubjectResult = document.getElementById('emailSubjectResult');
    const emailBodyResult = document.getElementById('emailBodyResult');
    const btnSendRealEmail = document.getElementById('btnSendRealEmail');

    // --- AI Study Planner Logic ---
    const btnGeneratePlan = document.getElementById('btnGeneratePlan');
    
    btnGeneratePlan.addEventListener('click', async () => {
        const subject = document.getElementById('studySubject').value;
        const examDate = document.getElementById('studyExamDate').value;
        const focusAreas = document.getElementById('studyFocus').value;

        if (!subject || !examDate) {
            return alert("Please provide a Subject and Exam Date.");
        }

        const originalText = btnGeneratePlan.textContent;
        btnGeneratePlan.textContent = "Generating...";
        btnGeneratePlan.disabled = true;

        try {
            const response = await fetch(`${API_URL}/ai-study-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.userId,
                    subject, 
                    examDate, 
                    focusAreas 
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message);
                // Clear inputs
                document.getElementById('studySubject').value = '';
                document.getElementById('studyExamDate').value = '';
                document.getElementById('studyFocus').value = '';
                
                // Refresh the Task List to show the new plan
                await fetchTasks(); 
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to connect to AI.");
        } finally {
            btnGeneratePlan.textContent = originalText;
            btnGeneratePlan.disabled = false;
        }
    });

    btnDraftEmail.addEventListener('click', async () => {
        const context = emailContext.value;
        if (!context) return alert("Please tell me what the email is about!");

        btnDraftEmail.textContent = "Drafting...";
        btnDraftEmail.disabled = true;

        try {
            const response = await fetch(`${API_URL}/ai-email-draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    recipient: emailRecipient.value,
                    context: context,
                    tone: "Professional" 
                })
            });

            const result = await response.json();

            if (response.ok) {
                // 1. Fill the inputs
                emailSubjectResult.value = result.subject;
                emailBodyResult.value = result.body;

                // 2. Generate MailTo Link
                // Encodes text so it fits in a URL
                const subjectEnc = encodeURIComponent(result.subject);
                const bodyEnc = encodeURIComponent(result.body);
                const recipient = emailRecipient.value || "";
                
                // This special link opens your computer's default email app
                btnOpenMail.href = `mailto:${recipient}?subject=${subjectEnc}&body=${bodyEnc}`;
                btnOpenMail.style.display = 'block'; // Show the green button
                btnSendRealEmail.style.display = 'block';
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to connect to AI.");
        } finally {
            btnDraftEmail.textContent = "✨ Draft Email";
            btnDraftEmail.disabled = false;
        }
    });

    // Listener for "Send Now" button
    btnSendRealEmail.addEventListener('click', async () => {
        const recipient = emailRecipient.value;
        const subject = emailSubjectResult.value;
        const body = emailBodyResult.value;

        if (!recipient) return alert("Please enter a Recipient email address.");

        const originalText = btnSendRealEmail.textContent;
        btnSendRealEmail.textContent = "Sending...";
        btnSendRealEmail.disabled = true;

        try {
            const response = await fetch(`${API_URL}/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: recipient, subject, body })
            });
            const result = await response.json();

            if (response.ok) {
                alert("Email sent successfully!");
                emailSubjectResult.value = '';
                emailBodyResult.value = '';
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            alert("Failed to connect to server.");
        } finally {
            btnSendRealEmail.textContent = originalText;
            btnSendRealEmail.disabled = false;
        }
    });

    aiRankBtn.addEventListener('click', async () => {
        // 1. UI Feedback
        const originalText = aiRankBtn.textContent;
        aiRankBtn.textContent = 'Thinking...';
        aiRankBtn.disabled = true;

        try {
            // 2. Call Backend
            const response = await fetch(`${API_URL}/tasks/ai-prioritize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.userId })
            });
            
            const result = await response.json();

            if (response.ok) {
                // 3. Refresh List to show new colors/order
                await fetchTasks();
                alert('AI has ranked your tasks!');
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to connect to AI.');
        } finally {
            // 4. Reset Button
            aiRankBtn.textContent = originalText;
            aiRankBtn.disabled = false;
        }
    });

    // --- AI Quick Add (MODIFIED: Removed conflict handling) ---
    aiForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = aiInput.value;
        if (!text) return;

        aiMessage.textContent = 'Processing...'; // <-- Simplified message
        aiMessage.className = 'message info';
        
        // --- REMOVED ---
        // document.getElementById('aiSuggestions').innerHTML = ''; 

        try {
            const response = await fetch(`${API_URL}/ai-quick-add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, userId: user.userId })
            });
            const result = await response.json();

            if (response.ok) {
                aiMessage.textContent = result.message;
                aiMessage.className = 'message success';
                aiInput.value = ''; 
                await fetchTasks(); // Refresh tasks
                await fetchEvents(); // Refresh events
            
            // --- REMOVED: `else if (response.status === 409)` block ---
            // This conflict status is no longer sent by the server.

            } else {
                // This will now catch 400, 500, etc.
                aiMessage.textContent = result.message;
                aiMessage.className = 'message error';
            }
        } catch (error) {
            aiMessage.textContent = 'Could not connect to AI server.';
            aiMessage.className = 'message error';
        }
    });

    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = document.getElementById('taskTitle').value;
        // NEW: Get values
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;

        taskMessage.className = 'message';
        taskMessage.textContent = '';
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: title, 
                    owner_user_id: user.userId,
                    priority: priority, // Send new field
                    dueDate: dueDate    // Send new field
                })
            });
            const result = await response.json();
            if (response.ok) {
                taskMessage.textContent = result.message;
                taskMessage.className = 'message success';
                document.getElementById('taskTitle').value = '';
                document.getElementById('taskDueDate').value = ''; // Reset date
                addTaskToDOM(result.task); 
            } else {
                taskMessage.textContent = result.message;
                taskMessage.className = 'message error';
            }
        } catch (error) {
            taskMessage.textContent = 'Could not connect to server.';
            taskMessage.className = 'message error';
        }
    });

    async function fetchTasks() {
        try {
            const response = await fetch(`${API_URL}/tasks?userId=${user.userId}`);
            const tasks = await response.json();
            if (response.ok) {
                taskListDiv.innerHTML = '';
                if (tasks.length === 0) {
                    taskListDiv.innerHTML = '<p>You have no tasks. Add one above!</p>';
                }
                tasks.forEach(task => addTaskToDOM(task));
            }
        } catch (error) {
            taskListDiv.innerHTML = '<p style="color: red;">Could not load tasks.</p>';
        }
    }

    function addTaskToDOM(task) {
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item';
        
        const taskId = task.taskId || task.task_id;
        taskEl.setAttribute('data-task-id', taskId);

        if (task.parent_task_id) {
            taskEl.classList.add('subtask');
        }

        if (task.status === 'done') {
            taskEl.classList.add('done');
        }

        // --- NEW: Format Date and Priority Color ---
        let metaInfo = '';
        if (task.priority) {
            const pColor = task.priority === 'High' ? 'red' : (task.priority === 'Medium' ? 'orange' : 'green');
            metaInfo += `<span style="color:${pColor}; font-size:0.8rem; margin-right:10px; font-weight:bold;">${task.priority}</span>`;
        }
        if (task.due_date) {
            const dateObj = new Date(task.due_date);
            metaInfo += `<span style="font-size:0.8rem; color:#666;">📅 ${dateObj.toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>`;
        }
        // -------------------------------------------

        const decomposeButton = !task.parent_task_id 
            ? '<button class="button-decompose">✨</button>' 
            : '';
        
        let roleBadge = '';
        
        // Case 1: It's my task, and I shared it with someone
        if (task.role === 'owner' && task.assignment_count > 0) {
             roleBadge = '<span style="font-size:0.7rem; background:#6f42c1; color:white; padding:2px 5px; border-radius:4px; margin-right:5px;">Shared</span>';
        } 
        // Case 2: Someone shared it with me
        else if (task.role === 'assignee') {
             roleBadge = '<span style="font-size:0.7rem; background:#17a2b8; color:white; padding:2px 5px; border-radius:4px; margin-right:5px;">Shared with me</span>';
        }

        taskEl.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <div>${roleBadge} <span>${task.title}</span></div>
                <div>${metaInfo}</div>
                
                <div class="comments-section" id="comments-${taskId}" style="display:none; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <div class="comments-list" style="font-size:0.9rem; color:#555; margin-bottom:10px;"></div>
                    <div style="display:flex; gap:5px;">
                        <input type="text" class="comment-input" placeholder="Add note..." style="flex:1;">
                        <button class="button-send-comment">Post</button>
                    </div>
                </div>

            </div>
            <div class="task-actions">
                <button class="button-assign" title="Assign to User">👤</button>
                
                ${decomposeButton}
                <button class="button-reminder" title="Set Reminder">🔔</button> 
                <button class="button-toggle-comments" title="Comments">💬</button>
                <button class="button-complete">✓</button>
                <button class="button-delete">X</button>
            </div>
        `;
        
        const parentEl = task.parent_task_id 
            ? document.querySelector(`.task-item[data-task-id="${task.parent_task_id}"]`) 
            : null;
            
        if (parentEl) {
            parentEl.after(taskEl);
        } else {
            taskListDiv.prepend(taskEl);
        }
    }

    taskListDiv.addEventListener('click', async (event) => {
        const target = event.target;
        const taskEl = target.closest('.task-item');
        if (!taskEl) return;
        const taskId = taskEl.getAttribute('data-task-id');

        if (target.classList.contains('button-decompose')) {
            target.textContent = '...';
            target.disabled = true;
            try {
                const response = await fetch(`${API_URL}/tasks/${taskId}/decompose`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.userId })
                });
                const result = await response.json();
                
                if (response.ok) {
                    result.subtasks.reverse().forEach(subtask => {
                        addTaskToDOM(subtask);
                    });
                    target.remove();
                } else {
                    alert(`Error: ${result.message}`);
                    target.textContent = '✨';
                    target.disabled = false;
                }
            } catch (error) {
                alert('Failed to decompose task.');
                target.textContent = '✨';
                target.disabled = false;
            }
        }

        if (target.classList.contains('button-delete')) {
            try {
                await fetch(`${API_URL}/tasks/${taskId}`, { method: 'DELETE' });
                taskEl.remove();
            } catch (error) { alert('Failed to delete task.'); }
        }
    
        if (target.classList.contains('button-complete')) {
            const isDone = taskEl.classList.toggle('done');
            const newStatus = isDone ? 'done' : 'todo';
            
            try {
                await fetch(`${API_URL}/tasks/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                
                // --- ADD THIS LINE HERE ---
                // Immediately update the stats boxes when you click the checkmark
                updateStats(); 
                // ---------------------------

            } catch (error) {
                alert('Failed to update task.');
                taskEl.classList.toggle('done'); // Revert visual change if error
            }
        }

        if (target.classList.contains('button-reminder')) {
            // Simple prompt for input (YYYY-MM-DD HH:MM)
            const defaultTime = new Date().toISOString().slice(0, 16).replace('T', ' ');
            const remindTime = prompt("Set reminder (YYYY-MM-DD HH:MM):", defaultTime);
            
            if (remindTime) {
                try {
                    const response = await fetch(`${API_URL}/tasks/${taskId}/reminders`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ remindAt: remindTime })
                    });
                    
                    if(response.ok) {
                        alert('Reminder set!');
                        target.textContent = '⏰'; // Change icon to indicate success
                    } else {
                        const res = await response.json();
                        alert('Error: ' + res.message);
                    }
                } catch (e) {
                    alert('Failed to save reminder.');
                }
            }
        }

        // 1. Toggle Comment Section
        if (target.classList.contains('button-toggle-comments')) {
            const commentSection = taskEl.querySelector(`#comments-${taskId}`);
            const isHidden = commentSection.style.display === 'none';
            
            if (isHidden) {
                commentSection.style.display = 'block';
                loadComments(taskId, commentSection.querySelector('.comments-list'));
            } else {
                commentSection.style.display = 'none';
            }
        }

        // 2. Post a Comment
        if (target.classList.contains('button-send-comment')) {
            const commentSection = taskEl.querySelector(`#comments-${taskId}`);
            const input = commentSection.querySelector('.comment-input');
            const text = input.value;
            
            if (text) {
                try {
                    await fetch(`${API_URL}/tasks/${taskId}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.userId, text })
                    });
                    input.value = ''; // Clear input
                    loadComments(taskId, commentSection.querySelector('.comments-list')); // Reload list
                } catch (e) { alert('Failed to post comment'); }
            }
        }
        
        if (target.classList.contains('button-assign')) {
            const email = prompt("Enter email of the user to assign:");
            if (email) {
                try {
                    const response = await fetch(`${API_URL}/tasks/${taskId}/assign`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: email })
                    });
                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message);
                    } else {
                        alert(result.message);
                    }
                } catch (e) {
                    alert("Failed to assign task.");
                }
            }
        }

    });

    // --- Event Management (MODIFIED: Removed conflict handling) ---
    eventForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = document.getElementById('eventTitle').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        
        eventMessage.className = 'message info';
        eventMessage.textContent = 'Scheduling event...'; // <-- Simplified message
        
        // --- REMOVED ---
        // document.getElementById('eventSuggestions').innerHTML = '';

        try {
            const response = await fetch(`${API_URL}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    startTime: startTime,
                    endTime: endTime,
                    owner_user_id: user.userId
                })
            });
            const result = await response.json();

            if (response.ok) {
                eventMessage.textContent = result.message;
                eventMessage.className = 'message success';
                eventForm.reset();
                addEventToDOM(result.event); // This now refreshes the list
            
            // --- REMOVED: `else if (response.status === 409)` block ---
            // This conflict status is no longer sent by the server.

            } else {
                // This will now catch 400, 500, etc.
                eventMessage.textContent = result.message;
                eventMessage.className = 'message error';
            }
        } catch (error) {
            eventMessage.textContent = 'Could not connect to server.';
            eventMessage.className = 'message error';
        }
    });

    // (Unchanged) Fetches all events and re-renders the list
    async function fetchEvents() {
        try {
            const response = await fetch(`${API_URL}/events?userId=${user.userId}`);
            const events = await response.json(); // These are already sorted by backend
            if (response.ok) {
                eventListDiv.innerHTML = ''; // Clear the list first
                if (events.length === 0) {
                    eventListDiv.innerHTML = '<p>You have no events. Add one!</p>';
                } else {
                    let eventsHTML = '';
                    events.forEach(event => {
                        eventsHTML += createEventHTML(event); // Use a helper function
                    });
                    eventListDiv.innerHTML = eventsHTML; // Set the sorted HTML
                }
            }
        } catch (error) {
            eventListDiv.innerHTML = '<p style="color: red;">Could not load events.</p>';
        }
    }

    // (Unchanged) This function now just refreshes the whole list
    async function addEventToDOM(event) {
        await fetchEvents();
    }
    
    // --- NEW: Analytics Fetcher ---
    async function updateStats() {
        try {
            const response = await fetch(`${API_URL}/analytics?userId=${user.userId}`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('statRate').textContent = data.completionRate + '%';
                document.getElementById('statStreak').textContent = data.streak;
                document.getElementById('statTotal').textContent = data.completed + '/' + data.total;
            }
        } catch (error) {
            console.error("Failed to load stats");
        }
    }

    async function loadComments(taskId, container) {
        container.innerHTML = 'Loading...';
        try {
            const res = await fetch(`${API_URL}/tasks/${taskId}/comments`);
            const comments = await res.json();
            
            if (comments.length === 0) {
                container.innerHTML = '<i>No comments yet.</i>';
            } else {
                container.innerHTML = comments.map(c => `
                    <div style="margin-bottom:5px;">
                        <strong>${c.full_name}:</strong> ${c.comment_text}
                    </div>
                `).join('');
            }
        } catch (e) {
            container.innerHTML = 'Error loading comments.';
        }
    }    

    // (Unchanged) Helper function to create event HTML
    function createEventHTML(event) {
        const eventId = event.eventId || event.event_id;
        
        const startTimeUTC = event.start_time.endsWith('Z') ? event.start_time : event.start_time + 'Z';
        const endTimeUTC = event.end_time.endsWith('Z') ? event.end_time : event.end_time + 'Z';

        const startDateObj = new Date(startTimeUTC);
        const endDateObj = new Date(endTimeUTC);

        const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
        const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

        const startDateStr = startDateObj.toLocaleDateString(undefined, dateOptions);
        const startTimeStr = startDateObj.toLocaleTimeString(undefined, timeOptions);
        const endDateStr = endDateObj.toLocaleDateString(undefined, dateOptions);
        const endTimeStr = endDateObj.toLocaleTimeString(undefined, timeOptions);

        return `
            <div class="event-item" data-event-id="${eventId}">
                <div>
                    <strong>${event.title}</strong>
                    <p>Start: ${startDateStr}, ${startTimeStr}</p>
                    <p>End: ${endDateStr}, ${endTimeStr}</p>
                </div>
                <div class="event-actions">
                    <button class="button-delete-event button-delete">X</button>
                </div>
            </div>
        `;
    }

    // (Unchanged) Event listener for deleting events
    eventListDiv.addEventListener('click', async (event) => {
        const target = event.target;
        
        if (target.classList.contains('button-delete-event')) {
            const eventEl = target.closest('.event-item');
            if (!eventEl) return;
            
            const eventId = eventEl.getAttribute('data-event-id');

            // NOTE: confirm() can be problematic in some environments.
            // For this project, we'll keep it, but a custom modal is better for production.
            if (confirm('Are you sure you want to delete this event?')) {
                try {
                    const response = await fetch(`${API_URL}/events/${eventId}`, { method: 'DELETE' });
                    if (response.ok) {
                          eventEl.remove(); 
                          if (eventListDiv.children.length === 0) {
                              eventListDiv.innerHTML = '<p>You have no events. Add one!</p>';
                          }
                    } else {
                          alert('Backend could not delete the event.');
                    }
                } catch (error) {
                    alert('Failed to delete event. Network error.');
                }
            }
        }
    });

    // --- Initial Data Load ---
    await fetchTasks();
    await fetchEvents();
    await updateStats();
    // --- NEW: Reminder Poller ---
    // check every 15 seconds
    setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/reminders/check?userId=${user.userId}`);
            const reminders = await res.json();

            if (reminders.length > 0) {
                // 1. Show Browser Notification/Alert
                reminders.forEach(r => {
                    // You can make this a fancy modal later, for now standard alert:
                    alert(`🔔 REMINDER: ${r.title}\nDue at: ${new Date(r.remind_at).toLocaleTimeString()}`);
                });

                // 2. Tell server we saw them
                const ids = reminders.map(r => r.reminder_id);
                await fetch(`${API_URL}/reminders/ack`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reminderIds: ids })
                });
            }
        } catch (e) {
            console.error("Reminder poll failed", e);
        }
    }, 15000);
}
