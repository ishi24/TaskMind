# TaskMind - AI-Powered Intelligent Productivity Suite

**[🚀 Launch Live App](https://taskmind-gwce.onrender.com/)**

TaskMind is a comprehensive, full-stack productivity SaaS designed to integrate Generative AI into daily task management. Hosted on the cloud, it leverages Google's Gemini API to parse natural language, prioritize tasks, draft emails, decompose complex projects, and generate study schedules automatically.

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
* **Smart Reminders:** Set specific reminder times. The server runs a background job to alert you via browser notifications when a task is due.
* **Calendar Integration:** View events sorted chronologically.

### 🔐 Security & User Management
* **Secure Authentication:** User Sign Up/Login with `bcrypt` password hashing.
* **Account Recovery:** "Forgot Password" flow that sends a real verification code to the user's email.
* **Profile Management:** Settings page to update user profile, change passwords, and simulate external integrations.

## 2. Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API).
* **Backend:** Node.js, Express.js.
* **Database:** MySQL 8.0 (Hosted on AWS RDS).
* **AI Engine:** Google Gemini API (`@google/genai`).
* **Email Service:** Nodemailer (Gmail SMTP).
* **Deployment:** Render (Cloud Hosting).

## 3. How to Use the App

1.  **Access the Site:** Go to [https://taskmind-gwce.onrender.com/](https://taskmind-gwce.onrender.com/).
    * *Note: If the site loads slowly initially, please wait ~30 seconds. The free-tier server sleeps when inactive.*
2.  **Sign Up:** Create a new account.
3.  **Test AI:** Try typing *"Lunch with client tomorrow at 12pm"* in the top bar and click **Go**.
4.  **Collaborate:** Create a task, click the **👤** icon, and assign it to another email address.
5.  **Plan Studies:** Scroll to the "Study Planner" section, enter a subject (e.g., "History Final"), pick a date, and click **Generate**.

## 4. Local Development Setup

If you wish to run this code on your local machine instead of the cloud, follow these steps:

### Prerequisites
* Node.js (LTS version).
* Access to a MySQL database (Local or AWS).
* A Google Gemini API Key.
* A Gmail Account with an App Password (for email features).

### Step-by-Step Setup

1.  **Clone the Repository**
    ```bash
    git clone [https://github.com/ishi24/TaskMind.git](https://github.com/ishi24/TaskMind.git)
    cd TaskMind
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**
    Create a `.env` file in the root directory and add your credentials:
    ```env
    # Database Configuration
    DB_HOST=your_db_host_endpoint
    DB_USER=your_db_username
    DB_PASSWORD=your_db_password
    DB_DATABASE=taskmind_db

    # AI Configuration
    GEMINI_API_KEY=your_gemini_api_key

    # Email Configuration
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_16_char_app_password
    ```

4.  **Run the Server**
    ```bash
    node server.js
    ```
    (Look for `✅ Backend server running...`)

5.  **Launch Frontend**
    Open `http://localhost:3001` in your browser.