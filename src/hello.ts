const express = require("express");
const morgan = require("morgan");
const auth = require("./google-auth");
const cookie_parser = require("cookie-parser");
const cookie_session = require("cookie-session");
const slogger = require("node-slogger");

const app = express();

app.use(morgan("tiny"));
app.use(cookie_parser());
app.use(cookie_session({ name: "session", keys: ["1337"] }));

app.get("/", function(req: any, res: any) {
  res.send("hello world!");
});

app.get("/detect", function(req: any, res: any) {
  var tokens = "";
  if (!req.session.tokens) {
    return res.send("no auth tokens");
  } else {
    tokens = JSON.parse(req.session.tokens);
  }
  var gmail = auth.get_gmail_client(tokens);
  gmail.users.labels.list({ userId: "me" }, function(err: any, gmail_res: any) {
    if (err) {
      slogger.warn("api returned an error: " + err);
      res.send("error occurred: " + err);
    }

    var labels = gmail_res.data.labels;

    var res_text = "";
    if (labels.length == 0) {
      res_text = "No labels found.";
    } else {
      res_text;
      for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        res_text += `${label.name}\n`;
      }
    }

    res.send(res_text);
  });
});

app.get("/gmail/auth", function(req: any, res: any) {
  res.redirect(302, auth.get_google_url());
});

app.get("/gmail/auth/callback", function(req: any, res: any) {
  var tokens = auth.get_oauth_tokens_from_code(req.query.code);
  tokens.then(
    (tokens: any) => {
      slogger.info("tokens: " + JSON.stringify(tokens));
      req.session.tokens = JSON.stringify(tokens);
      res.redirect(302, "/detect");
    },
    (err: any) => {
      res.send("auth failed: " + err);
    }
  );
});

app.listen(3000, function() {
  console.log("app listening on port 3000");
});
