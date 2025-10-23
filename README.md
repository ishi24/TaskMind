# TaskMind - Project Implementation

This project contains the backend logic and frontend GUI for the TaskMind application, demonstrating core user management, task management, event scheduling, and AI features.

## 1. Overview of Software and Frameworks
* **Programming Language:** JavaScript (Frontend & Backend)
* **Backend (Logic):** Node.js with Express.js
* **Frontend (GUI):** HTML, CSS, plain JavaScript (Fetch API)
* **Database:** MySQL 8.0 on AWS RDS
* **AI:** Google Gemini API (`@google/genai`)
* **Key Libraries:** `mysql2`, `bcryptjs`, `cors`, `dotenv`, `date-fns`

## 2. Implemented Use Cases
* **User Management:**
    * `User.signUp()`: Account creation with password hashing and default calendar generation.
    * `User.logIn()`: Secure user login.
* **Task Management:**
    * `User.createTask()`: Manual task creation.
    * Displaying user's tasks (including subtasks).
    * Updating task status (e.g., mark as done).
    * Deleting tasks (checks for subtasks).
* **Event Management:**
    * Manual event creation.
    * Displaying user's events (sorted chronologically).
    * Deleting events.
* **AI Features:**
    * `AI Quick Add`: Parsing natural language input (e.g., "Meeting tomorrow at 10 am and Prep slides") to create both events and tasks automatically using Gemini.
    * `AI Task Decomposition`: Breaking down a complex task into smaller subtasks using Gemini.

## 3. How to Compile and Run
These instructions are for running the application from the command line.

### Prerequisites
* Node.js (LTS version) installed.
* Access to the MySQL database (AWS RDS) and its credentials.
* A Google Gemini API Key.

### Setup
1.  Clone or download the project folder.
2.  Open a terminal and navigate into the `taskmind-project` folder: `cd taskmind-project`
3.  Create a file named `.env` in this folder.
4.  Add your database and AI credentials to the `.env` file:
    ```
    DB_HOST=your_database_host_endpoint
    DB_USER=your_database_username
    DB_PASSWORD=your_database_password
    DB_DATABASE=taskmind_db
    GEMINI_API_KEY=your_google_gemini_api_key
    ```
5.  Install required libraries:
    ```bash
    npm install
    ```

### Running the Application
1.  **Start Backend:** In the terminal, run:
    ```bash
    node server.js
    ```
    (Look for `✅ Backend server running...`)
2.  **Launch Frontend:** In your file explorer, double-click `index.html` (or use VS Code's "Open with Live Server").

### Testing
1.  Go to the Sign Up page, create a new user.
2.  Log in with the new user.
3.  Use the forms to manually create tasks and events. Test marking tasks complete and deleting items.
4.  Use the "Natural Language Quick Add" bar (e.g., "Team sync next Monday at 1pm for 1 hour and create agenda task"). Verify event and task appear.
5.  Create a complex task (e.g., "Organize team retreat"). Click the ✨ button next to it. Verify subtasks appear.
6.  Check your database (using DBeaver, etc.) to confirm data persistence.
