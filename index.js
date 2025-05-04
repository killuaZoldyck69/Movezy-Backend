require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const port = process.env.port || 7000;

app.use(cors());
app.use(express.json());

// Verify JWT middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access: No token" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ message: "Unauthorized access: Invalid token" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2nua0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("MoveZy");
    const userCollection = database.collection("users");
    const bookingCollection = database.collection("bookings");

    // Generate JWT token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    // Register a new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const existingUser = await userCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Get all users (Admin only)
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Get user by either id or email
    app.get("/user/find", verifyToken, async (req, res) => {
      const { id, email } = req.query;

      let query = {};

      if (id) {
        query._id = new ObjectId(id); // If an id is provided, query by id
      }

      if (email) {
        query.email = email; // If an email is provided, query by email
      }

      try {
        const user = await userCollection.findOne(query);

        if (user) {
          res.send(user);
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ message: "Error fetching user" });
      }
    });

    // Create a new booking
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const booking = req.body;

        // Convert requestedDeliveryDate to a Date object if it's a string
        let requestedDeliveryDate = booking.requestedDeliveryDate;
        if (typeof requestedDeliveryDate === "string") {
          requestedDeliveryDate = new Date(requestedDeliveryDate);
        }

        // Prepare the new booking object
        const newBooking = {
          ...booking,
          requestedDeliveryDate, // Store as Date
        };

        console.log(newBooking); // Log for debugging

        const result = await bookingCollection.insertOne(newBooking);
        res.send(result);
      } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // Get bookings with optional filters (email, id, date range)
    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const { email, id, from, to } = req.query; // Extract query parameters
        let query = {};

        // Check for filters by email and id
        if (email) {
          query.email = email;
        }
        if (id) {
          query._id = new ObjectId(id);
        }

        // Check for date range filter
        if (from && to) {
          // Parse the dates from string to Date type
          const startDate = new Date(from + "T00:00:00.000Z"); // Start of the day for 'from'
          const endDate = new Date(to + "T23:59:59.999Z"); // End of the day for 'to'

          // Add the date range filter to the query
          query.requestedDeliveryDate = {
            $gte: startDate,
            $lte: endDate,
          };
        }

        // Query the database based on the filters
        const result = id
          ? await bookingCollection.findOne(query) // If id is provided, find one document
          : await bookingCollection.find(query).toArray(); // Otherwise, find multiple documents

        // Send the result
        res.send(result);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("MoveZy Backend Server is Running...");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
