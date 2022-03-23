const routes = require("express").Router();
const FeesController = require("../controllers/FeesController");

routes.get("/", (req, res) => {
  return res.status(200).send({ status: "ok" });
});

routes.post("/fees", FeesController.addConfig);

routes.post("/compute-transaction-fee", FeesController.computeTransactionFee);

module.exports = routes;