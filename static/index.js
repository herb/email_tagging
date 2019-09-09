$(document).ready(function() {
  var nb_detected = 0;
  var nb_scanned = 0;
  var nb_estimated = 0;

  var next_page_token = null;

  function update_counts_ui() {
    $("#nb_detected").text(nb_detected);
    $("#nb_scanned").text(nb_scanned);
    $("#nb_estimated").text(nb_estimated);
  }

  function do_one_batch(cb) {
    update_counts_ui();

    var data = {};
    if (next_page_token) {
      data.next_page_token = next_page_token;
    }

    $.ajax({
      type: "get",
      url: "/detect",
      data: data
    }).done(function(one_batch_result) {
      console.log("detect result", one_batch_result);
      if (one_batch_result.error) {
        alert("failed: ", one_batch_result.error);
        return;
      }

      // append results
      for (var index in one_batch_result.data.founds) {
        var found = one_batch_result.data.founds[index];
        var $new_result = $(one_result_line(found));

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
    update_counts_ui();

    $("#spinner").hide();
    $("#done").show();

    console.log("done", err);
  });
});
