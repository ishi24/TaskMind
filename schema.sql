-- Creates the database if it doesn't exist (useful for setup)
CREATE DATABASE IF NOT EXISTS taskmind_db;
USE taskmind_db;

-- 1. Table for User Management
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table for Calendars
CREATE TABLE calendars (
    calendar_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT 'My Calendar',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE -- Added ON DELETE CASCADE
);

-- 3. Table for Event Scheduling
CREATE TABLE events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    calendar_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (calendar_id) REFERENCES calendars(calendar_id) ON DELETE CASCADE -- Added ON DELETE CASCADE
);

-- 4. Table for Task Management
CREATE TABLE tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    status ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
    priority INT DEFAULT 1,
    due_date DATE,
    parent_task_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE CASCADE, -- Added ON DELETE CASCADE
    FOREIGN KEY (parent_task_id) REFERENCES tasks(task_id) ON DELETE SET NULL -- Changed to SET NULL to avoid delete order issues
);

-- 5. Table for Collaboration (Calendar Sharing)
CREATE TABLE calendar_members (
    calendar_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('viewer', 'editor', 'owner') NOT NULL DEFAULT 'viewer',
    PRIMARY KEY (calendar_id, user_id),
    FOREIGN KEY (calendar_id) REFERENCES calendars(calendar_id) ON DELETE CASCADE, -- Added ON DELETE CASCADE
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE -- Added ON DELETE CASCADE
);

-- 6. Table for Task Reminders (Use Case 7)
CREATE TABLE task_reminders (
    reminder_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    remind_at DATETIME NOT NULL, -- The specific time for the reminder (UTC)
    status ENUM('pending', 'sent', 'dismissed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

-- 7. Table for Event Reminders (Use Case 7)
CREATE TABLE event_reminders (
    reminder_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    remind_at DATETIME NOT NULL, -- The specific time for the reminder (UTC)
    status ENUM('pending', 'sent', 'dismissed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- Optional: Add Indexes for better performance later
CREATE INDEX idx_task_owner ON tasks(owner_user_id);
CREATE INDEX idx_event_calendar ON events(calendar_id);
CREATE INDEX idx_event_start_time ON events(start_time);
CREATE INDEX idx_task_reminder_time ON task_reminders(remind_at);
CREATE INDEX idx_event_reminder_time ON event_reminders(remind_at);