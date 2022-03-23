const { addFees, computeTransaction } = require("../services/fees")
  
  exports.addConfig =  async (req, res, next) => {
    try {
      await addFees(req.body.FeeConfigurationSpec);
      return res.status(200).send({ status: "ok" });
    } catch (error) {
      return next(error);
    }
  };
  
 exports.computeTransactionFee = async (req, res, next) => {
    try {
      const data = await computeTransaction(req.body);
      return res.status(200).send(data);
    } catch (error) {
      return next(error);
    }
  };
  