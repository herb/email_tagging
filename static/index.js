$(document).ready(function() {
  var nb_detected = 0;
  var nb_scanned = 0;
  var nb_estimated = 0;

  var next_page_token = null;

  function do_one_batch(cb) {
    $("#nb_detected").text(nb_detected);
    $("#nb_scanned").text(nb_scanned);
    $("#nb_estimated").text(nb_estimated);

    data = {};
    if (next_page_token) {
      data.next_page_token = next_page_token;
    }

    $("#loading-spinner").toggleClass("lds-ring");

    $.ajax({
      type: "get",
      url: "/detect",
      data: data
    }).done(function(one_batch_result) {
      $("#loading-spinner").toggleClass("lds-ring");

      console.log("detect result", one_batch_result);
      if (one_batch_result.error) {
        alert("failed: ", one_batch_result.error);
        return;
      }

      // append results
      for (var index in one_batch_result.data.founds) {
        var found = one_batch_result.data.founds[index];
        var $new_result = $("<tr></tr>");

        $new_result.append("<td>" + found.date + "</td>");

        var $meta = $('<ul class="list-group"></ul>');
        $meta.append(
          '<li class="list-group-item">' + "<b>To:</b>" + found.to + "</li>"
        );
        $meta.append(
          '<li class="list-group-item">' + "<b>From:</b>" + found.from + "</li>"
        );
        $meta.append(
          '<li class="list-group-item">' +
            "<b>Subject:</b>" +
            found.subject +
            "</li>"
        );
        var $meta_td = $("<td></td>");
        $meta_td.append($meta);
        $new_result.append($meta_td);

        var detect_td_str = "<td><ul>";
        for (var i = 0; i < found.detections.length; i++) {
          var detect = found.detections[i];
          detect_td_str +=
            '<li>in "' +
            detect.source +
            '" detected "' +
            detect._type +
            '" from "' +
            detect.description +
            '": ' +
            detect.snippet +
            "</li>";
        }
        detect_td_str += "</td>";
        $new_result.append($(detect_td_str));

        $("#results").append($new_result);
      }

      // update counters
      nb_detected += one_batch_result.data.nb_detected;
      nb_scanned += one_batch_result.data.nb_scanned;
      nb_estimated += one_batch_result.data.nb_estimated;

      // remember next page
      next_page_token = one_batch_result.data.next_page_token;

      cb();
    });
  }

  function do_check(cb) {
    if (next_page_token) {
      return cb(null, true);
    } else {
      return cb(null, false);
    }
  }

  async.doWhilst(do_one_batch, do_check, function(err) {
    console.log("done", err);
  });
});
