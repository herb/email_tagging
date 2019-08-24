const async_fn = require("async");
const express = require("express");
const morgan = require("morgan");
const cookie_parser = require("cookie-parser");
const cookie_session = require("cookie-session");
const slogger = require("node-slogger");

const auth = require("./google-auth");
const detect = require("./detect");

const app = express();

app.use(morgan("tiny"));
app.use(cookie_parser());
app.use(cookie_session({ name: "session", keys: ["1337"] }));

app.get("/", function(req: any, res: any) {
  res.send("hello world!");
});

function get_subject(headers:any) {
  for (let kv of headers) {
    if (kv.name =='Subject') {
      return kv.value;
    }
  }

  return null;
}

app.get("/detect", function(req: any, res: any) {
  var tokens = "";
  if (!req.session.tokens) {
    return res.send("no auth tokens");
  } else {
    tokens = JSON.parse(req.session.tokens);
  }

  var gmail = auth.get_gmail_client(tokens);
  gmail.users.messages.list(
    { userId: "me" },
    function(err: any, gmail_res: any) {
      if (err) {
        slogger.warn("messages.list api returned an error: " + err);
        res.send("error occurred: " + err);
      }

      const next_page_token = gmail_res.data.nextPageToken;

      var messages = gmail_res.data.messages;
      async_fn.map(messages, (msg:any, cb:any) => {
        gmail.users.messages.get({ userId: "me", id: msg.id }, (err:any, msg_res:any) => {
          cb(err, msg_res);
        });
    },
    (err:any, message_info_list:any) => {
      if (err) {
        return res.send('error: ' + err);
      }
      for (let c in message_info_list) {
        let msg = message_info_list[c].data;

        let subject = get_subject(msg.payload.headers);

        let parts = msg.payload.parts;

        let text = null;
        let html = null;
        if (!parts) {
          if (msg.payload.mimeType == "text/plain") {
            text = msg.payload.body.data;
          } else if (msg.payload.mimeType == "text/html") {
            html = Buffer.from(
                msg.payload.body.data, 'base64').toString('ascii');
          }
        } else {
          for (let part of parts) {
            if (part.mimeType == "text/plain") {
              text = part.body.data
            } else if (part.mimeType == "text/html") {
              html = Buffer.from(part.body.data, 'base64').toString('ascii');
            }
          }
        }

        // TODO: add some text handlers
        let found = detect.html_detect_dbx(text, html);

        slogger.info(`${msg.id}: date=${new Date(parseInt(msg.internalDate))}, subject=${subject}`);
        if (found) {
          slogger.info('    ', found);
        }
      }
      res.send('done');
    });

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
