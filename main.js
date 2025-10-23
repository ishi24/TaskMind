// This is the URL of our running backend
const API_URL = 'http://localhost:3001';

// We get the current page's path to decide which logic to run
const currentPage = window.location.pathname;

if (currentPage.includes('signup.html')) {
    setupSignupForm();
} else if (currentPage.includes('login.html')) {
    setupLoginForm();
} else if (currentPage.includes('dashboard.html')) {
    setupDashboard();
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

    // --- Task Management ---
    taskForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = document.getElementById('taskTitle').value;
        taskMessage.className = 'message';
        taskMessage.textContent = '';
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title, owner_user_id: user.userId })
            });
            const result = await response.json();
            if (response.ok) {
                taskMessage.textContent = result.message;
                taskMessage.className = 'message success';
                document.getElementById('taskTitle').value = '';
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

        const decomposeButton = !task.parent_task_id 
            ? '<button class="button-decompose">✨</button>' 
            : '';

        if (task.status === 'done') {
            taskEl.classList.add('done');
        }
        
        taskEl.innerHTML = `
            <span>${task.title}</span>
            <div class="task-actions">
                ${decomposeButton} 
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
            } catch (error) {
                alert('Failed to update task.');
                taskEl.classList.toggle('done');
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
}
