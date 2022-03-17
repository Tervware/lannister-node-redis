require("dotenv").config();
const app = require("./app");

app.listen(process.env.APP_PORT, () => {
  console.log(
    `Environment: ${process.env.NODE_ENV} on port  ${process.env.APP_PORT} `
  );
});
