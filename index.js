require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");

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
    await client.connect();

    // Collections
    const userCollection = client.db("CoreTeam").collection("user");
    const tasksCollection = client.db("CoreTeam").collection("tasks");

    /**
     * User Routes
     */

    // Get all users
    app.get("/user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Add a new user
    app.post("/user", async (req, res) => {
      const user = req.body;

      if (
        !user.name ||
        !user.email ||
        !user.role ||
        !user.bank_account_no ||
        !user.salary ||
        !user.designation ||
        !user.photo
      ) {
        return res.status(400).send({ error: "All fields are required." });
      }

      try {
        const result = await userCollection.insertOne(user);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send({ error: "Failed to save user." });
      }
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

    // Ping MongoDB
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
