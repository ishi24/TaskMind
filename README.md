# TaskMind - AI-Powered Intelligent Productivity Suite

TaskMind is a comprehensive, full-stack productivity application designed to demonstrate the integration of Generative AI into daily task management. Beyond standard CRUD operations, TaskMind leverages Google's Gemini API to parse natural language, prioritize tasks, draft emails, decompose complex projects, and generate study schedules automatically.

## 1. Features & Capabilities

### 🧠 AI-Powered Tools
* **Natural Language Quick Add:** Type naturally (e.g., *"Meeting with Sam next Tuesday at 2pm and remind me to buy milk"*). The AI parses this to create both Calendar Events and Tasks instantly.
* **AI Task Prioritization:** One-click analysis of your task list. The AI assigns "High", "Medium", or "Low" priority based on urgency and context.
* **Smart Task Decomposition:** Click the ✨ button on a vague task (e.g., "Plan Vacation"), and the AI breaks it down into actionable subtasks.
* **AI Study Planner:** Input a subject and exam date. The AI generates a structured revision schedule spread across the days leading up to the exam.
* **AI Email Assistant:** Draft professional emails based on short context and send them directly from the application using a real SMTP integration.

### 🤝 Collaboration & Social
* **Task Assignment:** Assign tasks to other users by email.
* **Shared Views:** Tasks assigned to you appear with a "Shared with me" badge; tasks you assign to others show a "Shared" badge.
* **Comments:** Real-time commenting system on individual tasks for collaboration.

### ⚡ Productivity & Metrics
* **Dashboard Analytics:** Visual "Streak" counter, Task Completion Rate, and Total Task counts to gamify productivity.
* **Smart Reminders:** Set specific reminder times. The server runs a background job to alert you (via terminal logs) when a task is due.
* **Calendar Integration:** View events sorted chronologically.

### 🔐 Security & User Management
* **Secure Authentication:** User Sign Up/Login with `bcrypt` password hashing.
* **Account Recovery:** "Forgot Password" flow that sends a real verification code to the user's email.
* **Profile Management:** Settings page to update user profile, change passwords, and simulate external integrations.

## 2. Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API).
* **Backend:** Node.js, Express.js.
* **Database:** MySQL 8.0 (AWS RDS or Local).
* **AI Engine:** Google Gemini API (`@google/genai`).
* **Email Service:** Nodemailer (Gmail SMTP).
* **Key Libraries:** `mysql2`, `bcryptjs`, `cors`, `dotenv`, `date-fns`, `nodemailer`.

## 3. Database Schema Overview
The application uses a relational MySQL database with the following key tables:
* `users`: Stores credentials, profile info, and reset tokens.
* `tasks`: Stores task details, priority, due dates, and completion status.
* `events`: Stores calendar events with start/end times.
* `task_assignments`: Manages logic for shared tasks between users.
* `task_comments`: Stores collaboration history.
* `task_reminders`: Tracks pending alerts for the background worker.

## 4. Installation & Setup

### Prerequisites
1.  **Node.js** (LTS version).
2.  **MySQL Database** (Local or Cloud/AWS).
3.  **Google Gemini API Key** (Get it from Google AI Studio).
4.  **Gmail Account** with "App Password" enabled (for sending emails).

### Step-by-Step Setup

1.  **Clone the Repository**
    ```bash
    git clone [https://github.com/yourusername/taskmind.git](https://github.com/yourusername/taskmind.git)
    cd taskmind
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory and add your credentials:
    ```env
    # Database Configuration
    DB_HOST=your_db_host
    DB_USER=your_db_user
    DB_PASSWORD=your_db_password
    DB_DATABASE=taskmind_db

    # AI Configuration
    GEMINI_API_KEY=your_gemini_api_key

    # Email Configuration (Required for Reset Password & Email Sending)
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_16_char_app_password
    ```

4.  **Database Setup**
    Ensure your MySQL database has the required tables (`users`, `tasks`, `events`, `calendars`, `task_assignments`, `task_comments`, `task_reminders`).
    *(Refer to the provided SQL schema diagrams or scripts if available).*

## 5. Running the Application

1.  **Start the Backend Server**
    The server handles API requests and runs the background reminder checker.
    ```bash
    node server.js
    ```
    *Output should confirm:* `✅ Backend server is running...`

2.  **Launch the Frontend**
    Open `index.html` in your browser.
    *Tip: For best results, use VS Code's "Live Server" extension.*

## 6. Usage Guide (How to Test Features)

1.  **AI Quick Add:** In the dashboard, type *"Lunch with Mom tomorrow at 12pm"* into the top bar and hit Go.
2.  **Collaboration:** Create a task, click the **👤** icon, and enter another registered user's email to share the task.
3.  **AI Study Plan:** Go to the bottom yellow section, enter "Biology Final" and a date. Watch the AI fill your task list.
4.  **Email Drafter:** Scroll to the "AI Email Drafter". Enter a recipient and a prompt (e.g., "Ask for a sick day"). Click **Draft** -> **Send Now**.
5.  **Reminders:** Click the **🔔** icon on a task. Set a time 1 minute from now. Watch your VS Code terminal to see the alert pop up!