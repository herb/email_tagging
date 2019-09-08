import * as async_fn from "async";
import * as crypto from "crypto";
const slogger = require("node-slogger");

import * as auth from "./google-auth";
import * as detectors from "./detectors";
import * as message_util from "./message_util";

export interface NextPageData {
  email: string;
  email_hash: string;

  founds: object[];

  next_page_token: any;

  nb_detected: number;
  nb_scanned: number;
  nb_estimated: number;
}

interface NextPageCallback {
  (error: any, data?: NextPageData): void;
}
export function next_page(
  email: string,
  tokens: auth.Tokens,
  next_page_token: string,
  callback: NextPageCallback
) {
  const gmail = auth.get_gmail_client(tokens);

  gmail.users.threads.list(
    { userId: "me", pageToken: next_page_token },
    function(err: any, gmail_res: any) {
      if (err) {
        slogger.warn("messages.list api returned an error: " + err);
        callback(err);
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
            slogger.info(
              "thread",
              thread.id,
              "date",
              msg_info.date,
              "snippet",
              snip
            );

            // thread base detections
            let found_thread = detectors.thread_detect_lateral_phishing(thread);
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
                detectors.message_text_detect_links(
                  msg_info.body_text,
                  msg_info.body_html
                ),
                detectors.message_html_detect_links(
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

          return callback(null, {
            email: email,
            email_hash: crypto
              .createHash("md5")
              .update(email)
              .digest("hex"),
            founds: results,
            next_page_token: next_page_token,
            nb_detected: results.length,
            nb_scanned: 100,
            nb_estimated: estimated_result_size
          });
        }
      );
    }
  );
}
