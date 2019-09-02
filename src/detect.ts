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

const parse_html = require("node-html-parser").parse;
const url = require("url");


export function html_detect_dbx(text:string, html:string) {
  const body_html_root = parse_html(html);

  const link_elems = body_html_root.querySelectorAll("a");
  for (let link_elem of link_elems) {
    if (link_elem.attributes.href) {
      var href = url.parse(link_elem.attributes.href);
      if (href.hostname === "www.dropbox.com") {
        if (href.pathname.startsWith('/s/')) {
          return {source: 'html', _type: 'webshare', description: 'dropbox', snippet: href.href};
        }
      }

      if (href.hostname === "drive.google.com") {
        if (href.pathname == '/open') {
          return {source: 'html', _type: 'webshare', description: 'google-drive', snippet: href.href};
        }
      }
    }
  }

  return null;
}
