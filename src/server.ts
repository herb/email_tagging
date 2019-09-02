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

app.set("view engine", "pug");
app.use(express.static("static"));

app.get("/", function(req: any, res: any) {
  if (!req.session.tokens) {
    return res.redirect(302, "/gmail/auth");
  }
  res.render("index", {
    cdn_prefix: "https://cdnjs.cloudflare.com",
  });
});

function get_header_value(headers: any, key: string) {
  for (let kv of headers) {
    if (kv.name == key) {
      return kv.value;
    }
  }

  return null;
}

function get_message_info(msg: any) {
  let msg_subject = get_header_value(msg.payload.headers, "Subject");
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
      html = Buffer.from(msg.payload.body.data, "base64").toString("ascii");
    }
  } else {
    for (let part of parts) {
      if (part.mimeType == "text/plain") {
        text = part.body.data;
      } else if (part.mimeType == "text/html") {
        html = Buffer.from(part.body.data, "base64").toString("ascii");
      }
    }
  }

  return {
    date: msg_date,
    _from: get_header_value(msg.payload.headers, "From"),
    to: get_header_value(msg.payload.headers, "To"),
    cc: get_header_value(msg.payload.headers, "Cc"),
    subject: msg_subject,
    body_text: text,
    body_html: html
  };
}

app.get("/detect", function(req: any, res: any) {
  var tokens = "";
  if (!req.session.tokens) {
    return res.send({ error: "no auth tokens" });
  } else {
    tokens = JSON.parse(req.session.tokens);
  }

  var gmail = auth.get_gmail_client(tokens);

  gmail.users.threads.list(
    { userId: "me", pageToken: req.query.next_page_token },
    function(err: any, gmail_res: any) {
      if (err) {
        slogger.warn("messages.list api returned an error: " + err);
        res.send("error occurred: " + err);
      }

      const next_page_token = gmail_res.data.nextPageToken;
      const estimated_result_size = gmail_res.data.resultSizeEstimate;

      const threads = gmail_res.data.threads;
      async_fn.map(
        threads,
        (t: any, cb: any) => {
          gmail.users.threads.get(
            { userId: "me", id: t.id },
            (err: any, t_res: any) => {
              cb(err, t_res);
            }
          );
        },
        (err: any, threads: any) => {
          let results: object[] = [];
          for (let t of threads) {
            let thread = t.data;
            slogger.info("thread", thread.id, "snippet", thread.snippet);
            for (let msg of thread.messages) {
              let msg_info = get_message_info(msg);

              for (let found of [
                detect.text_detect_links(
                  msg_info.body_text,
                  msg_info.body_html
                ),
                detect.html_detect_links(msg_info.body_text, msg_info.body_html)
              ]) {
                if (found) {
                  slogger.info("    ", found);
                  results.push({
                    date: msg_info.date,
                    from: msg_info._from,
                    to: msg_info.to,
                    cc: msg_info.cc,
                    subject: msg_info.subject,
                    detections: [found]
                  });
                }
              }
            }
          }

          res.send({
            data: {
              founds: results,
              next_page_token: next_page_token,
              nb_detected: results.length,
              nb_scanned: 100,
              nb_estimated: estimated_result_size
            }
          });
        }
      );
    }
  );
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
