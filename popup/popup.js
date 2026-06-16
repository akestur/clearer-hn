/* Clearer HN — popup settings */
(function () {
  "use strict";
  var DEFAULTS = {
    enabled: true, theme: "auto", style: "clearer",
    comments: true, inbox: true, submit: true, readState: true, paging: true
  };
  var TOGGLES = ["enabled", "comments", "inbox", "submit", "readState", "paging"];
  var settings = Object.assign({}, DEFAULTS);

  function load(cb) {
    chrome.storage.local.get("phnSettings", function (res) {
      if (res && res.phnSettings) settings = Object.assign({}, DEFAULTS, res.phnSettings);
      cb();
    });
  }
  function save() { chrome.storage.local.set({ phnSettings: settings }); }

  function paint() {
    TOGGLES.forEach(function (k) {
      var elx = document.getElementById(k);
      if (elx) elx.checked = !!settings[k];
    });
    var theme = document.getElementById("theme");
    if (theme) theme.value = settings.theme;
  }

  function wire() {
    TOGGLES.forEach(function (k) {
      var elx = document.getElementById(k);
      if (!elx) return;
      elx.addEventListener("change", function () {
        settings[k] = elx.checked;
        save();
      });
    });
    var theme = document.getElementById("theme");
    if (theme) theme.addEventListener("change", function () {
      settings.theme = theme.value;
      save();
    });
  }

  load(function () { paint(); wire(); });
})();
