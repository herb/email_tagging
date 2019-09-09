/*
const fs = require("fs");
const MailParser = require("mailparser").MailParser;
const simpleParser = require("mailparser").simpleParser;
const parse_html = require("node-html-parser").parse;
const MBox = require("node-mbox");
const url = require("url");

var mbox = new MBox();
mbox.on("message", function(msg: any) {
  simpleParser(msg, function(err: any, parsed: any) {
    const body_html_root = parse_html(parsed.html);

    const link_elems = body_html_root.querySelectorAll("a");
    link_elems.foreach(function(link_elem: any) {
      var href = url.parse(link_elem.attributes.href);
      if (href.hostname === "www.dropbox.com") {
        console.log("detected dropbox link");
      }
    });
  });
});

fs.ReadStream("tests/cloud_shares.mbox").pipe(mbox);
*/

const slogger = require("node-slogger");
const parse_html = require("node-html-parser").parse;
const url = require("url");

const message_util = require("./message_util");

export function message_html_detect_links(
  text: string | null,
  html: string | null
) {
  const body_html_root = parse_html(html);

  const link_elems = body_html_root.querySelectorAll("a");
  for (let link_elem of link_elems) {
    if (link_elem.attributes.href) {
      var href = url.parse(link_elem.attributes.href);
      if (href.hostname === "www.dropbox.com") {
        if (href.pathname.startsWith("/s/")) {
          return {
            source: "html",
            _type: "webshare",
            description: "dropbox",
            snippet: href.href
          };
        }
      }

      if (href.hostname === "drive.google.com") {
        if (href.pathname == "/open") {
          return {
            source: "html",
            _type: "webshare",
            description: "google-drive",
            snippet: href.href
          };
        }
      }
    }
  }

  return null;
}

const dbx_re = /https:\/\/www.dropbox.com\/s\//;

export function message_text_detect_links(
  text: string | null,
  html: string | null
) {
  if (!text) {
    return null;
  }
  const matches = text.search(dbx_re);
  if (matches != -1) {
    return {
      source: "text",
      _type: "webshare",
      description: "dropbox",
      snippet: text.slice(matches, 50)
    };
  }

  return null;
}

// sorts newest messages first
function message_sorter_reverse(a: any, b: any) {
  let a_int = parseInt(a.internalDate);
  let b_int = parseInt(b.internalDate);

  if (a_int > b_int) {
    return -1;
  } else if (a_int == b_int) {
    return 0;
  } else {
    return 1;
  }
}

const LATERAL_PHISHING_TIME_THRESHOLD: number = 1000 * 60 * 60 * 24 * 90; // 90 days
const LATERAL_PHISHING_TRUSTED_DOMAINS: string[] = []; // trust no one

// if it's a reply to an old thread that has a link to an untrusted domain, it
// has a higher likelihood of being a lateral phishing attempt
//
// we could further refine this in an enterprise POV by restricting replies
// from within the domain
export function thread_detect_lateral_phishing(thread: any) {
  slogger.debug("    thread length", thread.messages.length);
  if (thread.messages.length == 1) {
    return null;
  }

  // ideally we probably cluster these message by time and compare the cluster
  // newest clusters but this should be a first approximation
  thread.messages.sort(message_sorter_reverse);

  let newest = thread.messages[0];
  let next = thread.messages[1];
  let time_delta = parseInt(newest.internalDate) - parseInt(next.internalDate);

  // DEBUG
  let mi_newest = message_util.get_message_info(newest);
  let mi_next = message_util.get_message_info(next);

  slogger.debug("    thread delta", time_delta, mi_newest.date, mi_next.date);

  if (time_delta > LATERAL_PHISHING_TIME_THRESHOLD) {
    // should we exclude emails from this mailbox? probably not
    let msg_info = message_util.get_message_info(newest);

    if (!msg_info.body_html) {
      // FIXME: support text fields
      return null;
    }

    const body_html_root = parse_html(msg_info.body_html);

    const link_elems = body_html_root.querySelectorAll("a");
    for (let link_elem of link_elems) {
      if (link_elem.attributes.href) {
        var href = url.parse(link_elem.attributes.href);
        if (href.protocol == "mailto:") {
          continue;
        }
        if (LATERAL_PHISHING_TRUSTED_DOMAINS.indexOf(href.hostname) == -1) {
          // FIXME: standardize this interface for detect across thread and
          // message based
          return [
            msg_info,
            {
              source: "thread",
              _type: "lateral-phishing",
              description: "",
              snippet: href.href
            }
          ];
        }
      }
    }
  }

  return null;
}
