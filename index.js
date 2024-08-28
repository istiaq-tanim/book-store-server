const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        // Connect to MongoDB
        await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db('book-store');
        const bookCollection = db.collection('books');

        app.get("/books", async (req, res) => {
            const books = await bookCollection.find().toArray()
            return res.status(200).json({
                success: true,
                message: "Books Retrieved Successfully",
                data: books
            })
        })

        app.get("/books/:id", async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) }
            const book = await bookCollection.findOne(query)
            return res.status(200).json({
                success: true,
                message: "Book Retrieved Successfully",
                data: book
            })
        })

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

    } finally {
    }
}

run().catch(console.dir);

// Test route
app.get('/', (req, res) => {
    const serverStatus = {
        message: 'Server is running smoothly',
        timestamp: new Date()
    };
    res.json(serverStatus);
});


