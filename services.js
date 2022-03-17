require("dotenv").config();

const configurations = [
  {
    fee_id: "LNPY1221",
    fee_currency: "NGN",
    fee_locale: "*",
    fee_entity: "*",
    fee_entity_property: "*",
    fee_apply: "APPLY",
    fee_type: "PERC",
    fee_value: "1.4",
    wildcards_no: 3,
  },
  {
    fee_id: "LNPY1222",
    fee_currency: "NGN",
    fee_locale: "INTL",
    fee_entity: "CREDIT-CARD",
    fee_entity_property: "VISA",
    fee_apply: "APPLY",
    fee_type: "PERC",
    fee_value: "5.0",
    wildcards_no: 0,
  },
  {
    fee_id: "LNPY1223",
    fee_currency: "NGN",
    fee_locale: "LOCL",
    fee_entity: "CREDIT-CARD",
    fee_entity_property: "*",
    fee_apply: "APPLY",
    fee_type: "FLAT_PERC",
    fee_value: "50:1.4",
    wildcards_no: 1,
  },
  {
    fee_id: "LNPY1224",
    fee_currency: "NGN",
    fee_locale: "*",
    fee_entity: "BANK-ACCOUNT",
    fee_entity_property: "*",
    fee_apply: "APPLY",
    fee_type: "FLAT",
    fee_value: "100",
    wildcards_no: 2,
  },
  {
    fee_id: "LNPY1225",
    fee_currency: "NGN",
    fee_locale: "*",
    fee_entity: "USSD",
    fee_entity_property: "MTN",
    fee_apply: "APPLY",
    fee_type: "PERC",
    fee_value: "0.55",
    wildcards_no: 1,
  },
];

exports.addFees =  (FeeConfigurationSpec) => {

  const config = FeeConfigurationSpec.split("\n").map((data) => {
    const dataObj = data.split(" ");
    
    const fee_currency = dataObj[1];
    const fee_locale = dataObj[2];
    const entity = dataObj[3].split("(");
    const fee_entity = entity[0];
    const fee_entity_property = entity[1].slice(0, -1);

    const wildcards_no = [
      fee_currency,
      fee_locale,
      fee_entity,
      fee_entity_property,
    ].filter((value) => value === "*").length;
    return {
      fee_id: dataObj[0],
      fee_currency,
      fee_locale,
      fee_entity,
      fee_entity_property,
      fee_apply: dataObj[5],
      fee_type: dataObj[6],
      fee_value: dataObj[7],
      wildcards_no,
    };
  });

  // TODO: Save data
  return  config;
};

exports.computeTransaction = (payload) => {
  const { Amount, CurrencyCountry, Currency, Customer } = payload;

  const { ID, Issuer, Brand, Number, SixID, Type, Country } = payload.PaymentEntity;

  const locale = CurrencyCountry === Country ? "LOCL" : "INTL";
  const typeProperties = [ID, Issuer, Brand, Number, SixID];

  let selectedFee = null;
  let configs = configurations.filter(
    (conf) =>
      (conf.fee_currency === Currency || conf.fee_currency === "*") &&
      (conf.fee_locale === locale || conf.fee_locale === "*") &&
      (conf.fee_entity === Type || conf.fee_entity === "*") &&
      (typeProperties.includes(conf.fee_entity_property) ||
        conf.fee_entity_property === "*")
  );
  if (configs.length === 1) {
    selectedFee = configs[0];
  }
  if (configs.length > 1) {
    selectedFee = configs.reduce((prev, current) =>
      prev.wildcards_no > current.wildcards_no ? current : prev
    );
  }

  if (!selectedFee) {
    throw new Error("Matching fee configuration not found.");
  }
  
  let AppliedFeeValue = 0;
  const feeType = selectedFee.fee_type;
  const feeValue = selectedFee.fee_value;
  if (feeType === "FLAT") {
    AppliedFeeValue = feeValue;
  }
  if (feeType === "PERC") {
    AppliedFeeValue = (feeValue * Amount) / 100;
  }
  if (feeType === "FLAT_PERC") {
    const fp = feeValue.split(":");
    AppliedFeeValue = parseFloat(fp[0]) + (parseFloat(fp[1]) * Amount) / 100;
  }
  const ChargeAmount = Customer.BearsFee ? Amount + AppliedFeeValue : Amount;
  const SettlementAmount = ChargeAmount - AppliedFeeValue;
  return {
    AppliedFeeID: selectedFee.fee_id,
    AppliedFeeValue,
    ChargeAmount,
    SettlementAmount,
  };
};
