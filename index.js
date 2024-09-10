const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');


const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {

        // await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db('book-store');
        const bookCollection = db.collection('books');
        const userCollection = db.collection("users")
        const paymentCollection = db.collection("payments")


        app.post('/register', async (req, res) => {
            const { name, email, password } = req.body;


            const existingUser = await userCollection.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists'
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            await userCollection.insertOne({ name, email, password: hashedPassword, role: "USER" });

            res.status(201).json({
                success: true,
                message: 'User registered successfully'
            });
        });

        // User Login
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;

            // Find user by email
            const user = await userCollection.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Compare hashed password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.EXPIRES_IN });

            res.json({
                success: true,
                message: 'Login successful',
                token
            });
        });

        app.get("/books", async (req, res) => {
            const query = req.query
            let filter = { $and: [] }

            if (query?.ratings) {
                const ratings = query?.ratings.split("|").map(item => parseInt(item, 10))
                filter.$and.push({ ratings: { $in: ratings } })
            };

            if (query?.category) {
                const categories = query.category.split("|").map(item => ({
                    category: { $regex: new RegExp(item, "i") }
                }))
                filter.$and.push({ $or: categories });
            }

            if (query?.price) {
                const priceRanges = query.price.split("|").map(range => {
                    const [min, max] = range.split("-").map(Number);
                    return { price: { $gte: min, $lte: max } };
                });
                filter.$and.push({ $or: priceRanges });
            }

            if (filter.$and.length === 0) {
                delete filter.$and;
            }
            const books = await bookCollection.find(filter).sort({
                saleNumber: 1
            }).toArray()

            res.status(201).json({
                success: true,
                message: 'Books is Fetching',
                data: books
            });

        })

        app.get("/featuredBook", async (req, res) => {
            const { query } = req.query
            let books
            if (query === "featured") {
                books = await bookCollection.find({ featured: true }).toArray()
            }
            if (query === "onSale") {
                books = await bookCollection.find({ onSale: true }).toArray()
            }
            return res.status(200).json({
                success: true,
                message: "Book Retrieved Successfully",
                data: books
            })
        })

        app.get("/newRelease", async (req, res) => {
            const { query } = req.query
            const books = await bookCollection.find({ category: query }).toArray()
            return res.status(200).json({
                success: true,
                message: "Book Retrieved Successfully",
                data: books
            })
        })

        app.get("/books/:id", async (req, res) => {
            const { id } = req.params
            const query = { _id: new ObjectId(id) };
            const book = await bookCollection.findOne(query)
            return res.status(200).json({
                success: true,
                message: "Book Retrieved Successfully",
                data: book
            })
        })

        app.post("/addBook", async (req, res) => {
            const product = req.body
            const data = await bookCollection.insertOne(product)
            res.status(201).json({
                success: true,
                message: 'New Book is Added',
                data
            });
        })

        app.delete("/book/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await bookCollection.deleteOne(query)
            res.status(201).json({
                success: true,
                message: 'Book is Deleted',
            });
        })

        app.put("/book/:id", async (req, res) => {
            const id = req.params.id
            const updatedProduct = req.body
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateProduct = { $set: updatedProduct }

            const result = await bookCollection.updateOne(filter, updateProduct, options)
            res.status(201).json({
                success: true,
                message: 'Book Data is Updated',
                result
            });
        })

        app.get("/payment", async (req, res) => {
            const { email } = req.query
            const orderBookList = await paymentCollection.find({ email: email }).toArray()
            return res.status(200).json({
                success: true,
                message: "Payment Retrieved Successfully",
                data: orderBookList
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


