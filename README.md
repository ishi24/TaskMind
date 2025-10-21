# TaskMind - Sprint 3 Implementation (Section 4.1)

## 1. Overview of Software and Frameworks
This project implements the core backend logic and a frontend GUI for the TaskMind application.

* **Programming Language:** JavaScript (for both frontend and backend)
* **Backend (Logic):** Node.js with the Express.js framework.
* **Frontend (GUI):** HTML, CSS, and plain JavaScript (using the Fetch API).
* **Database:** MySQL 8.0, hosted on Amazon Web Services (AWS) RDS.
* **Libraries:**
    * `mysql2`: To connect Node.js to our MySQL database.
    * `bcryptjs`: To securely hash and protect user passwords.
    * `cors`: To allow the frontend and backend to communicate.
    * `dotenv`: To manage our secret database credentials.

## 2. Implemented Use Cases
We successfully implemented the following two major use cases from our class diagram:

1.  **User.signUp()**: A new user can be created from the frontend, securely hashed, and stored in the `users` table.
2.  **User.createTask()**: A new task can be created from the frontend and stored in the `tasks` table, linked to its `owner_user_id`.

## 3. Proof of Database Communication
The following screenshots demonstrate that data flows from the frontend GUI to the backend database tables.

*(Insert your screenshots here)*
1.  **Screenshot of the webpage** showing the success messages for creating a user and a task.
2.  **Screenshot from DBeaver** showing the new user in the `users` table (from `SELECT * FROM users;`).
3.  **Screenshot from DBeaver** showing the new task in the `tasks` table (from `SELECT * FROM tasks;`).

## 4. How to Compile and Run
These instructions are for running the application from the command line.

### Prerequisites
* Node.js (LTS version) must be installed.
* A MySQL database must be running and accessible.

### Setup
1.  Unzip the `TaskMind_Implementation.zip` file.
2.  Open a terminal and navigate into the project folder: `cd taskmind-project`
3.  Create a file named `.env` in the root of this folder.
4.  Add your database credentials to the `.env` file in this format:
    ```
    DB_HOST=your_database_host_endpoint
    DB_USER=your_database_username
    DB_PASSWORD=your_database_password
    DB_DATABASE=taskmind_db
    ```
5.  Install all required project libraries by running:
    ```
    npm install
    ```

### Running the Application
1.  **Start the Backend Server:** In your terminal, run:
    ```
    node server.js
    ```
    (A confirmation message will appear: `✅ Backend server is running on http://localhost:3001`)

2.  **Launch the Frontend GUI:** In your file explorer, double-click the `index.html` file to open it in any web browser.

3.  **Test:** You can now use the forms to create users and tasks, and verify the new data appears in your database.