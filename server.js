const express = require('express');
const db = require("./config/database");
const cors = require("cors");
const compression = require('compression');
const userRoutes = require("./routes/usersRoutes");
const specializationRoutes = require("./routes/SpecializationsRoutes");
const articleRoutes = require("./routes/articleRoutes");
const analyticsRoute = require('./routes/analyticsRoute');
require('dotenv').config();
const PORT = process.env.PORT || 4000;
const cookieParser = require("cookie-parser");
const uploadRoute = require('./routes/uploadRoute');

const app = express();
// Use the cookie-parser middlewconare
app.use(cookieParser());

app.use(compression());

// Connect to the Database
db.dbConnect();
//db.dbDrop();

// Middleware to parse JSON
app.use(express.json());

// Enable CORS
app.use(cors({ origin: "*" }));


app.get("/hello", (req, res) => {
    console.log("Hello World");
});



// Use the userRoutes
app.use("/api", userRoutes);
app.use("/api", specializationRoutes);
app.use("/api",articleRoutes );
app.use("/api", uploadRoute);
app.use("/api/analytics", analyticsRoute);


// Start the server
app.listen(PORT, () => {
    console.log('Server is running on port 4000',PORT);
   // db.dbDrop()
});

// Export the app for testing or other purposes
module.exports = app;