const express = require("express");
const morgan = require("morgan");
const cookie_parser = require("cookie-parser");
const cookie_session = require("cookie-session");
const slogger = require("node-slogger");

const auth = require("./google-auth");
import * as detect from "./detect";

const app = express();

app.use(morgan("tiny"));
app.use(cookie_parser());
app.use(cookie_session({ name: "session", keys: ["1337"] }));

app.set("view engine", "pug");
app.use(express.static("static"));

app.get("/", function(req: any, res: any) {
  if (!req.session.tokens) {
    return res.redirect(302, "/gmail/auth");
  }

  const profile = JSON.parse(req.session.profile);

  res.render("index", {
    cdn_prefix: "https://cdnjs.cloudflare.com",
    email: profile.emailAddress
  });
});

app.get("/detect", function(req: any, res: any) {
  let tokens = null;
  if (!req.session.tokens) {
    return res.send({ error: "no auth tokens" });
  } else {
    tokens = JSON.parse(req.session.tokens);
  }

  let profile = JSON.parse(req.session.profile);

  detect.next_page(profile.emailAddress, tokens, req.query.next_page_token, (err:any, data:any) => {
    if (err) {
      res.send({ error: err });
    }
    return res.send({ data: data });
  });
});

app.get("/gmail/auth", function(req: any, res: any) {
  res.redirect(302, auth.get_google_url());
});

app.get("/gmail/auth/callback", function(req: any, res: any) {
  var tokens = auth.get_oauth_tokens_from_code(req.query.code);
  tokens.then(
    (tokens: any) => {
      const gmail = auth.get_gmail_client(tokens);
      const profile = gmail.users.getProfile({ userId: "me" });
      profile.then(
        (profile: any) => {
          auth.persist_tokens_and_profile(req.session, tokens, profile.data);

          res.redirect(302, "/");
        },
        (err: any) => {
          res.send("profile retrieval failed: " + err);
        }
      );
    },
    (err: any) => {
      res.send("auth failed: " + err);
    }
  );
});

app.listen(3000, function() {
  console.log("app listening on port 3000");
});
