require("dotenv").config(); 
const express = require("express");
const Cors = require("cors");  
const {addFees, computeTransaction} = require("./services");

const app = express();
app.use(Cors());
app.use(express.json());


app.post("/fees", (req, res)=> {
   addFees(req.body.FeeConfigurationSpec);
  return res.status(200).send({ status: "ok" });
});

app.post("/compute-transaction-fee", (req, res)=> {
  const data = computeTransaction(req.body);
  return res.status(200).send(data);
});


// Handles all errors
app.use((err, req, res, next) => {
  try {
   
    return res
      .status(400)
      .send({ status: "error", message: err.message });
  } catch (error) {
    return res
      .status(500)
      .send({ status: "error", message: "Error"});
  }
});

// Not found route
app.use((req, res) => {
  return res.status(404).send({ status: "error", message: "Route not found" });
});

module.exports = app;
