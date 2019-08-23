const express = require("express");
const morgan = require("morgan");
const app = express();

app.use(morgan("tiny"));

app.get("/", function(req: any, res: any) {
  res.send("hello world!");
});

app.listen(3000, function() {
  console.log("app listening on port 3000");
});
