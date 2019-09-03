const async_fn = require("async");
const express = require("express");
const morgan = require("morgan");
const cookie_parser = require("cookie-parser");
const cookie_session = require("cookie-session");
const slogger = require("node-slogger");

const auth = require("./google-auth");
const detect = require("./detect");
const message_util = require("./message_util");

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
    cdn_prefix: "https://cdnjs.cloudflare.com"
  });
});

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

            // debugging
            let snip: string = "";
            let msg_info = message_util.get_message_info(thread.messages[0]);
            if (thread.snippet) {
              snip = thread.snippet;
            } else {
              snip = msg_info.subject;
            }
            slogger.info("thread", thread.id, 'date', msg_info.date, "snippet", snip);

            // thread base detections
            let found_thread = detect.thread_detect_lateral_phishing(thread);
            if (found_thread) {
              let info = found_thread[0];
              results.push({
                date: info.date,
                from: info._from,
                to: info.to,
                cc: info.cc,
                subject: info.subject,
                detections: [found_thread[1]]
              });
            }

            // message based detections
            for (let msg of thread.messages) {
              let msg_info = message_util.get_message_info(msg);

              let detections = [];
              for (let found_msg of [
                detect.message_text_detect_links(
                  msg_info.body_text,
                  msg_info.body_html
                ),
                detect.message_html_detect_links(
                  msg_info.body_text,
                  msg_info.body_html
                )
              ]) {
                if (found_msg) {
                  detections.push(found_msg);
                }

                if (detections.length > 0) {
                  slogger.info("    ", detections);
                  results.push({
                    date: msg_info.date,
                    from: msg_info._from,
                    to: msg_info.to,
                    cc: msg_info.cc,
                    subject: msg_info.subject,
                    detections: detections
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
