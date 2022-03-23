const Redis = require("ioredis");

const redisClient = new Redis();
const pipeline = redisClient.pipeline();

const INDEX = "fee:index";

exports.addIndex = async () => {
  let indices = await redisClient.call("FT._LIST");

  if (indices.includes(INDEX)) {
    await redisClient.call("FT.DROPINDEX", INDEX);
  }

  await redisClient.call(
    "FT.CREATE",
    INDEX,
    "ON",
    "hash",
    "PREFIX",
    1,
    "fee:",
    "SCHEMA",
    "fee_currency",
    "TEXT",
    "fee_locale",
    "TEXT",
    "fee_entity",
    "TEXT",
    "fee_entity_property",
    "TEXT"
  );
};

exports.validateSpec = async (FeeConfigurationSpec) => {

  for(data of FeeConfigurationSpec.split("\n")) {
    const dataObj = data.split(" ");
    if (dataObj.length !== 8) {
      throw new Error("Fee configuration specification is invalid.")
    }
  
    const fee_id = dataObj[0];
    if (fee_id.length !== 8) {
      throw new Error(`Invalid Fee Id ${fee_id}. Fee Id must contain 8 characters.`)
    }
    const fee_currency = dataObj[1];
    if (fee_currency !== "NGN") {
      throw new Error("NGN is the only accepted currency at the moment.")
    }
    
    const fee_locale = dataObj[2];
    if (!(["*", "INTL", "LOCL"].includes(fee_locale))) {
      throw new Error("Fee locale value must be either *, INTL or LOCL.")
    }

    const entity = dataObj[3].split("(");
    const fee_entity = entity[0];
    if (!(["*", "CREDIT-CARD", "DEBIT-CARD","BANK-ACCOUNT", "USSD", "WALLET-ID"].includes(fee_entity))) {
      throw new Error("Fee entity value must be either *, CREDIT-CARD, DEBIT-CARD, BANK-ACCOUNT, USSD or WALLET-ID.")
    }

    const fee_type = dataObj[6];
    if (!(["FLAT", "PERC", "FLAT_PERC"].includes(fee_type))) {
      throw new Error("Fee type must be either FLAT, PERC, or FLAT_PERC.")
    }
    const fee_value = dataObj[7];
    if (["FLAT", "PERC"].includes(fee_type) && Number(fee_value) < 0) {
      throw new Error("Fee value must be a non-negative numeric.")
    }
    
  };

};


exports.addFees = async (FeeConfigurationSpec) => {

  await this.validateSpec(FeeConfigurationSpec);

  const indices = await redisClient.call("FT._LIST");
  if (!indices.includes(INDEX)) {
    await this.addIndex();
  }

  FeeConfigurationSpec.split("\n").forEach(async (data) => {
    const dataObj = data.split(" ");

    const fee_currency = dataObj[1];
    const fee_locale = dataObj[2];
    const entity = dataObj[3].split("(");
    const fee_entity = entity[0];
    const fee_entity_property =
      entity[1].slice(0, -1);
    const isCardNo = fee_entity_property.length === 16;
    const card_last4 = isCardNo ? fee_entity_property.slice(-4) : null;
    const card_first6 = isCardNo ? fee_entity_property.slice(0, 6) : null;

    const wildcards_no = [
      fee_currency,
      fee_locale,
      fee_entity,
      fee_entity_property,
    ].filter((value) => value === "*").length;
    const fee = {
      fee_id: dataObj[0],
      fee_currency,
      fee_locale,
      fee_entity,
      fee_entity_property,
      fee_apply: dataObj[5],
      fee_type: dataObj[6],
      fee_value: dataObj[7],
      card_last4,
      card_first6,
      wildcards_no,
    };
    await pipeline.hmset(`fee:${fee.fee_id}`, fee);
  });

  await pipeline.exec();
};

exports.computeTransaction = async (payload) => {

  const configs = await this.getConfigs(payload);
  if (configs.length === 0) {
    throw new Error("No fee configuration for USD transactions.");
  }
  
  const highestSpecifityConfig = await this.getHighestSpecifity(configs,payload);

  const fee = await this.calculateFees(highestSpecifityConfig, payload);

  return fee;
};

exports.getConfigs = async (payload) => {


  // TODO: Query individual fields from redis
  const query = `*`;
  // return query
  let [count, ...data] = await redisClient.call(
    "FT.SEARCH",
    INDEX,
    query
  );

  // Convert data to object
  let foundData = data.filter((entry, index) => index % 2 !== 0);
  let feeConfigs = foundData.map((sightingArray) => {
    let keys = sightingArray.filter((_, index) => index % 2 === 0);
    let values = sightingArray.filter((_, index) => index % 2 !== 0);
    return keys.reduce((sighting, key, index) => {
      sighting[key] = values[index];
      return sighting;
    }, {});
  });
  return  feeConfigs;
};


exports.getHighestSpecifity = async (feeConfigs, payload) => {

  if (feeConfigs.length === 1) {
    return configs[0];
  }

  const { CurrencyCountry, Currency, PaymentEntity } = payload;
  const locale  = CurrencyCountry === PaymentEntity.Country ? "LOCL" : "INTL";
  const typeProperties = [PaymentEntity.ID, PaymentEntity.Issuer, PaymentEntity.Brand, PaymentEntity.SixID, PaymentEntity.Number];
  console.log({Currency, locale, locale, locale, locale, type: PaymentEntity.Type});
  const configs = feeConfigs.filter(
    (conf) =>
      (conf.fee_currency === Currency || conf.fee_currency === "*") &&
      (conf.fee_locale === locale || conf.fee_locale === "*") &&
      (conf.fee_entity === PaymentEntity.Type || conf.fee_entity === "*") &&
      (typeProperties.includes(conf.fee_entity_property)||
      conf.fee_entity_property === "*")
  );
console.log({ configs });
  if (configs.length === 0) {
    throw new Error("No fee configuration for USD transactions.");
  }
  
  // Return config with the lowest wildcards_no
  return configs.reduce((prev, current) =>
      prev.wildcards_no > current.wildcards_no ? current : prev
    );
};


exports.calculateFees = async (config, payload) => {
  const { Amount, Customer } = payload;
  let AppliedFeeValue = 0;
  const feeType = config.fee_type;
  const feeValue = config.fee_value;
  if (feeType === "FLAT") {
    AppliedFeeValue = feeValue;
  }
  if (feeType === "PERC") {
    AppliedFeeValue = (feeValue * Amount) / 100;
  }
  if (feeType === "FLAT_PERC") {
    const flatPercent = feeValue.split(":");
    AppliedFeeValue = parseFloat(flatPercent[0]) + (parseFloat(flatPercent[1]) * Amount) / 100;
  }
  const ChargeAmount = Customer.BearsFee ? Amount + AppliedFeeValue : Amount;
  const SettlementAmount = ChargeAmount - AppliedFeeValue;
  return {
    AppliedFeeID: config.fee_id,
    AppliedFeeValue,
    ChargeAmount,
    SettlementAmount,
  };
};