(function () {
  var pref = "system";
  try {
    var stored = window.localStorage.getItem("luyen-jlpt:theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      pref = stored;
    }
  } catch (e) {
    pref = "system";
  }

  var isDark = false;
  if (pref === "dark") {
    isDark = true;
  } else if (pref === "system") {
    try {
      isDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      isDark = false;
    }
  }

  var root = document.documentElement;
  if (root && root.classList) {
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
})();
