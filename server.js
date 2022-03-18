require("dotenv").config();
const app = require("./app");

app.listen(process.env.PORT, () => {
  console.log(
    `Environment: ${process.env.NODE_ENV} on port  ${process.env.PORT} `
  );
});
