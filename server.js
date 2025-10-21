// server.js

// 1. IMPORT LIBRARIES
require('dotenv').config(); // Loads credentials from our .env file
const express = require('express');
const mysql = require('mysql2/promise'); // Using the 'promise' version for modern async/await
const cors = require('cors');
const bcrypt = require('bcryptjs'); // For hashing passwords

// 2. INITIALIZE APP
const app = express();
const PORT = 3001; // Our backend server will run on this port

// 3. SET UP MIDDLEWARE
app.use(cors()); // Allow our frontend to make requests to this backend
app.use(express.json()); // Allow the server to read JSON data from requests

// 4. DATABASE CONNECTION POOL
// This creates a "pool" of connections for our server to use.
// It's much more efficient than creating a new connection for every query.
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- API ENDPOINTS (Implementing our Class Diagram methods) ---

/**
 * Use Case 1: Implement User.signUp()
 * This endpoint will receive new user data (name, email, password) from the frontend.
 */
app.post('/signup', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        // --- Logic ---
        // 1. Hash the password (as required by our User class 'passwordHash' attribute)
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the 'salt rounds'

        // 2. Create the SQL query
        const sql = 'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)';
        
        // 3. Execute the query
        const [result] = await dbPool.query(sql, [fullName, email, hashedPassword]);

        // 4. Send a success response back to the frontend
        console.log(`User created with ID: ${result.insertId}`);
        res.status(201).json({ 
            message: 'User created successfully!', 
            userId: result.insertId 
        });

    } catch (error) {
        console.error('Error during sign-up:', error);
        // Handle a "duplicate email" error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Error: Email already in use.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Use Case 2: Implement User.createTask()
 * This endpoint will receive task data (title, user ID) from the frontend.
 */
app.post('/tasks', async (req, res) => {
    try {
        const { title, owner_user_id } = req.body; // Frontend will send the task title and the ID of the user creating it

        // --- Logic ---
        // 1. Create the SQL query
        const sql = 'INSERT INTO tasks (title, owner_user_id, status) VALUES (?, ?, ?)';
        
        // 2. Execute the query (default status is 'todo')
        const [result] = await dbPool.query(sql, [title, owner_user_id, 'todo']);

        // 3. Send a success response back to the frontend
        console.log(`Task created with ID: ${result.insertId}`);
        res.status(201).json({ 
            message: 'Task created successfully!', 
            taskId: result.insertId 
        });

    } catch (error) {
        console.error('Error creating task:', error);
        // This could fail if the owner_user_id doesn't exist
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(404).json({ message: 'Error: User ID not found.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});


// 5. START THE SERVER
app.listen(PORT, () => {
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
});