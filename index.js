const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const SSLCommerzPayment = require('sslcommerz-lts')

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
const is_live = false


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
        app.post("/order", async (req, res) => {
            const order = req.body;
            const trans_id = new ObjectId().toString()
            const data = {
                total_amount: order.total,
                currency: order.currency,
                tran_id: trans_id,
                success_url: `${process.env.BASE_URL}/payment-success/${trans_id}`,
                fail_url: 'http://localhost:3030/fail',
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: 'Computer.',
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: order.name,
                cus_email: order.email,
                cus_add1: order.address,
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: order.contact,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                let GatewayPageURL = apiResponse.GatewayPageURL
                res.send({ url: GatewayPageURL })
                const finalOrder = {
                    email: order?.email,
                    paidStatus: false,
                    deliveryStatus: false,
                    transactionId: trans_id,
                    totalPrice: order?.total,
                    address: order?.address,
                    orderDate: new Date(),
                    products: order?.orderProducts.map(({ author, title, image, quantity, originalPrice }) => {
                        return {
                            author,
                            title,
                            image,
                            quantity,
                            price: originalPrice
                        }
                    })

                }
                const result = paymentCollection.insertOne(finalOrder)
            });
            app.post("/payment-success/:tranId", async (req, res) => {
                const { tranId } = req.params
                console.log(tranId)
                const result = await paymentCollection.updateOne({ transactionId: tranId }, {
                    $set: {
                        paidStatus: true
                    }
                })
                if (result?.modifiedCount > 0) {
                    res.redirect(`${process.env.FBASE_URL}/payment/success/${tranId}`)
                }
            })
        })

        app.get("/orders", async (req, res) => {
            const orderBookList = await paymentCollection.find().toArray()
            return res.status(200).json({
                success: true,
                message: "Payment Retrieved Successfully",
                data: orderBookList
            })
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

        app.get("/statistic", async (req, res) => {
            const { email } = req.query
            const userStat = await paymentCollection.aggregate([
                { $match: { email: email } },
                {
                    $group: {
                        _id: "$email",
                        totalPayment: { $sum: { $cond: [{ $eq: ["$paidStatus", true] }, "$totalPrice", 0] } },
                        pendingOrders: { $sum: { $cond: [{ $eq: ["$deliveryStatus", false] }, 1, 0] } },
                        deliveryOrders: { $sum: { $cond: [{ $eq: ["$deliveryStatus", true] }, 1, 0] } }
                    }
                }

            ]).toArray()
            return res.status(200).json({
                success: true,
                message: "Payment Retrieved Successfully",
                data: userStat
            })
        })

        app.get("/admin-stat", async (req, res) => {
            const stats = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalPayment: {
                            $sum: "$totalPrice"
                        },
                        pendingOrders: {
                            $sum: { $cond: [{ $eq: ["$deliveryStatus", false] }, 1, 0] }
                        },
                        deliveryOrders: {
                            $sum: { $cond: [{ $eq: ["$deliveryStatus", true] }, 1, 0] }
                        }
                    }
                }
            ]).toArray();
            return res.status(200).json({
                success: true,
                message: "Admin Statistic Retrieved Successfully",
                data: stats
            })
        })

        app.patch("/orders/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const order = await paymentCollection.findOne(query)
            console.log(order)

            if (!order) {
                return res.status(404).send({ message: "Order not found" });
            }
            const updateDoc = {
                $set: {
                    deliveryStatus: !order.deliveryStatus
                }
            };

            const result = await paymentCollection.updateOne(query, updateDoc)
            console.log(result)
            res.send(result)
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


