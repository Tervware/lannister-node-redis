require("dotenv").config();
const express = require("express");
const Cors = require("cors");
const routes = require("./routes");

const app = express();
app.use(Cors());
app.use(express.json());

app.use("/", routes);

// Handles all errors
app.use((err, req, res, next) => {
  try {
    return res.status(400).send({ Error: err.message });
  } catch (error) {
    return res.status(500).send({ Error: "Error" });
  }
});

// Not found route
app.use((req, res) => {
  return res.status(404).send({ Error: "Route not found." });
});

module.exports = app;
