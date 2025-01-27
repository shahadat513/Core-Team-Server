require("dotenv").config();
const express = require("express");
const jwt = require('jsonwebtoken')
const app = express();
const cors = require("cors");

const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aqw27.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect();

    // Collections
    const userCollection = client.db("CoreTeam").collection("user");
    const tasksCollection = client.db("CoreTeam").collection("tasks");




    /**
     * User Routes
     */

    // JWT related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      });
      res.send({ token });
    });

    // middleware
    // Token Verify
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorize access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorize access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // Admin Token Verify
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin' || 'HR';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }
    // HR Token Verify
    const verifyHR = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isHR = user?.role === 'HR';
      if (!isHR) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    // Get all users
    // app.get("/user", verifyToken, verifyHR || verifyAdmin, async (req, res) => {
    //   // console.log(req.headers);
    //   const result = await userCollection.find().toArray();
    //   res.send(result);
    // });
    app.get("/user", async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.findOne(query)
      res.send(result);
    });

    // Admin
    app.get("/user/admin/:email", async (req, res) => {
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden access' })
      // }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      let admin = false
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    });
    // HR
    app.get("/user/HR/:email", async (req, res) => {
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(403).send({ message: 'forbidden access' })
      // }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      let HR = false
      if (user) {
        HR = user?.role === 'HR'
      }
      res.send({ HR })
    });

    // Add a new user
    app.post("/user", async (req, res) => {
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);

    });

    // Task Routes

    // Add Task to DB
    app.post('/tasks', async (req, res) => {
      const taskData = req.body;

      const result = await tasksCollection.insertOne(taskData);
      res.send(result);
    });

    // Show All Task Data
    app.get('/tasks', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await tasksCollection.find(query).toArray();
      res.send(result);
    });

    // Delete Single Task
    app.delete('/tasks/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tasksCollection.deleteOne(query);
      res.send(result);
    });

    // Update Single Task
    app.put('/tasks/:id', async (req, res) => {
      const id = req.params.id;
      const updatedTask = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          task: updatedTask.task,
          hours: updatedTask.hours,
          date: updatedTask.date,
        },
      };

      const result = await tasksCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // Admin Related API

    // Update user as fired
    app.put('/user/fire/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { fired } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { fired: fired },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Update user role to HR
    app.put("/user/make-hr/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: { role: role },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // strip payment information
    app.post('/stripe-payment', async (req, res) => { 
      const { price } = req.body
      const amount = parseInt(price * 100);
      console.log( 'payment ammount',amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // Ping MongoDB
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
