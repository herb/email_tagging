const slogger = require('node-slogger');

export function get_header_value(headers: any, key: string) {
  for (let kv of headers) {
    if (kv.name == key) {
      return kv.value;
    }
  }

  return null;
}

export function get_message_info(msg: any) {
  let msg_subject = get_header_value(msg.payload.headers, "Subject");
  let msg_date = new Date(parseInt(msg.internalDate));

  let parts = msg.payload.parts;

  // pull out text and html parts of the message (and deal with
  // potentially multipart messages)
  let text = null;
  let html = null;
  if (!parts && msg.payload.body.data) {
    if (msg.payload.mimeType == "text/plain") {
      text = Buffer.from(msg.payload.body.data, "base64").toString("ascii");
    } else if (msg.payload.mimeType == "text/html") {
      html = Buffer.from(msg.payload.body.data, "base64").toString("ascii");
    }
  } else if (parts) {
    for (let part of parts) {
      if (!part.body.data) {
        continue;
      }
      if (part.mimeType == "text/plain") {
        text = Buffer.from(part.body.data, "base64").toString("ascii");
      } else if (part.mimeType == "text/html") {
        html = Buffer.from(part.body.data, "base64").toString("ascii");
      }
    }
  } else {
    slogger.warn('msg no parts no payload', msg);
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
