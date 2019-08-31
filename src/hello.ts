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

app.set('view engine', 'pug');
app.use(express.static('static'));

app.get("/", function(req: any, res: any) {
  if (!req.session.tokens) {
    return res.redirect(302, '/gmail/auth');
  }
  res.render('index', { cdn_prefix: "https://cdnjs.cloudflare.com", title: 'Hey', message: 'Hello there!' })
});

function get_header_value(headers:any, key:string) {
  for (let kv of headers) {
    if (kv.name == key) {
      return kv.value;
    }
  }

  return null;
}

app.get("/detect", function(req: any, res: any) {
  var tokens = "";
  if (!req.session.tokens) {
    return res.send({"error": "no auth tokens"});
  } else {
    tokens = JSON.parse(req.session.tokens);
  }

  var gmail = auth.get_gmail_client(tokens);

  gmail.users.messages.list(
    { userId: "me", pageToken: req.query.next_page_token },
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
        return res.send({"error": err});
      }
      let results:object[] = [];
      for (let c in message_info_list) {
        let msg = message_info_list[c].data;

        let msg_subject = get_header_value(msg.payload.headers, 'Subject');
        let msg_date = new Date(parseInt(msg.internalDate));

        let parts = msg.payload.parts;

        // pull out text and html parts of the message (and deal with
        // potentially multipart messages)
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

        slogger.info(`${msg.id}: date=${msg_date}, subject=${msg_subject}`);
        if (found) {
          slogger.info('    ', found);
          results.push({
            date: msg_date,
            from: get_header_value(msg.payload.headers, 'From'),
            to: get_header_value(msg.payload.headers, 'To'),
            cc: get_header_value(msg.payload.headers, 'Cc'),
            subject: msg_subject,
            detections: [found],
          });
        }
      }
      res.send({data: {
        'founds': results,
        'next_page_token': next_page_token,
        'nb_detected': results.length,
        'nb_scanned': 100,
      }});
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
