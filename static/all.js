$(document).ready(function() {
  var nb_detected = 0;
  var nb_scanned = 0;
  var nb_estimated = 0;

  class DefaultDict {
    constructor(defaultInit) {
      return new Proxy(
        {},
        {
          get: (target, name) =>
            name in target
              ? target[name]
              : (target[name] =
                  typeof defaultInit === "function"
                    ? new defaultInit().valueOf()
                    : defaultInit)
        }
      );
    }
  }

  class Count {
    email_hash = undefined;
    nb_detected = 0;
    nb_scanned = 0;
    nb_estimated = 0;
  }

  var next_page_token_by_email = {};
  // FIXME: this is more like 'info_by_email'
  var count_by_email = new DefaultDict(Count);

  function update_count_ui() {
    for (var email in count_by_email) {
      var count = count_by_email[email];

      $("#nb_detected_" + count.email_hash).text(count.nb_detected);
      $("#nb_scanned_" + count.email_hash).text(count.nb_scanned);
      $("#nb_estimated_" + count.email_hash).text(count.nb_estimated);
    }
  }

  function do_one_batch(cb) {
    // update count ui
    update_count_ui();

    $.ajax({
      type: "get",
      url: "/detect_all",
      data: next_page_token_by_email
    }).done(function(one_batch_results) {
      console.log("detect results", one_batch_results);

      if (one_batch_results.error) {
        alert("failed: ", one_batch_results.error);
        return;
      }

      for (var batch_index in one_batch_results.data) {
        var one_batch_result = one_batch_results.data[batch_index];
        var email = one_batch_result.email;

        if (one_batch_result.next_page_token) {
          next_page_token_by_email[email] = one_batch_result.next_page_token;
        } else {
          next_page_token_by_email[email] = "done-done";
        }

        for (var found_index in one_batch_result.founds) {
          var found = one_batch_result.founds[found_index];
          found.email = email;
          var $new_result = $(one_result_line(found));

          $("#results").append($new_result);
        }

        // update counters
        count_by_email[email].email_hash = one_batch_result.email_hash;
        count_by_email[email].nb_detected += one_batch_result.nb_detected;
        count_by_email[email].nb_scanned += one_batch_result.nb_scanned;
        if (one_batch_result.nb_estimated) {
          count_by_email[email].nb_estimated = one_batch_result.nb_estimated;
        }
      }

      cb();
    });
  }

  function do_check(cb) {
    if (next_page_token_by_email) {
      return cb(null, true);
    } else {
      return cb(null, false);
    }
  }

  async.doWhilst(do_one_batch, do_check, function(err) {
    $("#spinner").hide();
    $("#done").show();
    console.log("done", err);
  });
});
