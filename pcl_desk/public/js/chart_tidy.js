/* PCL chart tidy — v5, 22 Sep 2026.
   Frappe Charts lays pie/donut legends out in fixed 150px columns, puts one column too
   many on each row, and never shortens a label, so long names run into each other and
   the last one falls off the card. Bar charts cut their x-axis labels to a few letters
   ("Privat ...") and a blank group shows no label at all.
   This watches the page for charts and, after Frappe draws one, re-lays its legend to
   fit the card, wraps axis labels onto two lines, and names the blank group "Not set".
   Full labels stay available on hover. It never changes the data. */
(function () {
  if (window.__pclChartFix2) return;
  window.__pclChartFix2 = 1;

  var NS = "http://www.w3.org/2000/svg";
  var BLANK = "Not set";

  // Keep each chart's own labels next to its element, so an axis label that Frappe cut
  // short can be written out in full.
  function wrapChart() {
    if (!window.frappe || !frappe.Chart || frappe.Chart.__pcl) return !!(window.frappe && frappe.Chart);
    var Orig = frappe.Chart;
    var Wrapped = function (parent, options) {
      var c = new Orig(parent, options);
      try {
        var el = typeof parent === "string" ? document.querySelector(parent) : parent;
        if (el && el.jquery) el = el[0];
        if (el) el.__pclChart = c;
      } catch (e) {}
      return c;
    };
    Wrapped.prototype = Orig.prototype;
    Object.setPrototypeOf(Wrapped, Orig);
    Wrapped.__pcl = 1;
    frappe.Chart = Wrapped;
    return true;
  }

  function labelsFor(svg) {
    var el = svg.parentNode;
    for (var i = 0; i < 4 && el; i++) {
      if (el.__pclChart) {
        var c = el.__pclChart;
        return (c.data && c.data.labels) || (c.state && c.state.labels) || null;
      }
      el = el.parentNode;
    }
    return null;
  }

  function textWidth(t, s) {
    var fs = parseFloat(t.getAttribute("font-size")) || 12;
    return s.length * fs * 0.56;
  }
  function measure(t) {
    try { var w = t.getComputedTextLength(); if (w > 0) return w; } catch (e) {}
    return textWidth(t, t.textContent || "");
  }
  function setTitle(node, s) {
    var old = node.querySelector("title");
    if (old) old.remove();
    var tt = document.createElementNS(NS, "title");
    tt.textContent = s;
    node.appendChild(tt);
  }
  function fitText(t, full, maxW) {
    t.textContent = full;
    if (measure(t) <= maxW) return;
    var s = full;
    while (s.length > 1) {
      s = s.slice(0, -1);
      t.textContent = s.replace(/[\s/(\-–,]+$/, "") + "…";
      if (measure(t) <= maxW) return;
    }
  }
  function translateOf(g) {
    var m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(g.getAttribute("transform") || "");
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  }

  // Pie / donut / percentage legends. Never changes the chart's size: Frappe redraws a
  // chart whose box changes size, and growing it here would loop forever.
  function fixLegend(svg) {
    var leg = svg.querySelector("g.chart-legend");
    if (!leg) return;
    var items = [].filter.call(leg.children, function (n) { return n.tagName === "g"; });
    if (!items.length || !items[0].querySelector(".legend-dataset-label")) return;
    var W = parseFloat(svg.getAttribute("width")) || svg.getBoundingClientRect().width;
    var H = parseFloat(svg.getAttribute("height")) || 240;
    var lt = translateOf(leg);
    var avail = W - lt[0] - 8;
    var n = items.length;
    var oneRow = avail / n >= 96 || lt[1] + 44 > H - 4;
    var per = oneRow ? n : Math.ceil(n / 2);
    var colW = avail / per;
    items.forEach(function (g, i) {
      var lab = g.querySelector(".legend-dataset-label");
      var val = g.querySelector(".legend-dataset-value");
      if (!lab.__pclFull) {
        var lt0 = (lab.textContent || "").trim();
        lab.__pclFull = (!lt0 || /^(null|none|undefined)$/i.test(lt0)) ? BLANK : lt0;
        lab.__pclVal = val ? (val.textContent || "").trim() : "";
      }
      var x = (i % per) * colW, y = Math.floor(i / per) * 22;
      g.setAttribute("transform", "translate(" + x.toFixed(1) + ", " + y + ")");
      lab.setAttribute("font-size", "13px");
      if (oneRow) {
        if (val) val.style.display = "";
        fitText(lab, lab.__pclFull, colW - 28);
      } else {
        if (val) val.style.display = "none";
        fitText(lab, lab.__pclFull + (lab.__pclVal ? "  " + lab.__pclVal : ""), colW - 28);
      }
      setTitle(g, lab.__pclFull + (lab.__pclVal ? ": " + lab.__pclVal : ""));
    });
  }

  // Bar / line x-axis labels.
  function fixAxis(svg) {
    var ax = svg.querySelector("g.x.axis");
    if (!ax) return;
    var ticks = [].filter.call(ax.children, function (n) { return n.tagName === "g"; });
    if (ticks.length < 1) return;
    var labels = labelsFor(svg);
    if (labels && labels.length !== ticks.length) labels = null;
    var xs = ticks.map(function (g) { return translateOf(g)[0]; });
    var unit = ticks.length > 1 ? (xs[xs.length - 1] - xs[0]) / (ticks.length - 1)
                                : (parseFloat(svg.getAttribute("width")) || 300) / 2;
    var twoLines = false;
    ticks.forEach(function (g, i) {
      var t = g.querySelector("text");
      if (!t) return;
      if (t.__pclFull === undefined) {
        var shown = (t.textContent || "").trim();
        var full = labels ? String(labels[i] == null ? "" : labels[i]).trim() : shown;
        if (/^(null|none|undefined)$/i.test(full)) full = "";
        if (!full && (!shown || /^(null|none|undefined|nu\.\.)$/i.test(shown))) full = BLANK;
        if (!full) full = shown;
        t.__pclFull = full;
        t.__pclCut = !labels ? / \.\.\.$|…$/.test(shown) : full !== shown;
        // Drawn before this script was loaded, so the full names are unknown here.
        if (!labels && t.__pclCut) needRedraw = true;
      }
      var full = t.__pclFull;
      // Month axes in a narrow card: "Oct", with the year under the first month and
      // under each January.
      var mm = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ -](\d{4})$/.exec(full);
      if (mm && unit < 64) {
        setTitle(g, full);
        while (t.firstChild) t.removeChild(t.firstChild);
        var m1 = document.createElementNS(NS, "tspan");
        m1.setAttribute("x", "0");
        m1.textContent = mm[1];
        t.appendChild(m1);
        if (i === 0 || mm[1] === "Jan") {
          var y1 = document.createElementNS(NS, "tspan");
          y1.setAttribute("x", "0");
          y1.setAttribute("dy", "1.15em");
          y1.textContent = mm[2];
          t.appendChild(y1);
        }
        return;
      }
      if (!t.__pclCut && full !== BLANK) return;
      setTitle(g, full);
      if (unit < 36) { fitText(t, full, Math.max(unit - 4, 20)); return; }
      var maxW = unit - 6;
      while (t.firstChild) t.removeChild(t.firstChild);
      t.textContent = full;
      if (measure(t) <= maxW) return;
      // Two lines, broken at a space or slash.
      var words = full.split(/(\s+|\/)/).filter(function (w) { return w !== "" && !/^\s+$/.test(w); });
      var line1 = "", k = 0;
      for (; k < words.length; k++) {
        var tryS = line1 ? line1 + (words[k] === "/" || /\/$/.test(line1) ? "" : " ") + words[k] : words[k];
        t.textContent = tryS;
        if (measure(t) > maxW && line1) break;
        line1 = tryS;
      }
      var rest = words.slice(k).join(" ").replace(/\s*\/\s*/g, " / ").trim();
      t.textContent = "";
      var a = document.createElementNS(NS, "tspan");
      a.setAttribute("x", "0");
      t.appendChild(a);
      fitText(a, line1, maxW);
      if (rest) {
        var b = document.createElementNS(NS, "tspan");
        b.setAttribute("x", "0");
        b.setAttribute("dy", "1.15em");
        t.appendChild(b);
        fitText(b, rest, maxW);
        twoLines = true;
      }
    });
    if (twoLines) {
      var sb = svg.getBoundingClientRect(), ab = ax.getBoundingClientRect();
      if (sb.height && ab.bottom > sb.bottom - 1) {
        // No room below the axis: back to one line, shortened, full name on hover.
        ticks.forEach(function (g) {
          var t = g.querySelector("text");
          if (t && t.querySelector("tspan")) fitText(t, t.__pclFull, unit - 6);
        });
      }
    }
  }

  function fresh(svg) {
    var l = svg.querySelectorAll(".legend-dataset-label, g.x.axis > g > text");
    for (var i = 0; i < l.length; i++) if (l[i].__pclFull === undefined) return true;
    return false;
  }

  // A chart drawn before this script loaded cannot give its full labels back. Redraw the
  // workspace once (per page, per load) so its charts are rebuilt through the wrapper.
  var needRedraw = false, redrawn = {};
  function redrawOnce() {
    needRedraw = false;
    var ws = window.frappe && frappe.workspace;
    var key = location.pathname;
    var rt = frappe.get_route ? frappe.get_route() : [];
    if (!rt || rt[0] !== "Workspaces") return;
    if (!ws || !ws._page || redrawn[key] || !frappe.Chart || !frappe.Chart.__pcl) return;
    redrawn[key] = 1;
    try { ws.show_page(ws._page); } catch (e) {}
  }

  function sweep() {
    var svgs = document.querySelectorAll("svg.frappe-chart");
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      if (!svg.isConnected || !svg.getBoundingClientRect().width || !fresh(svg)) continue;
      try { fixLegend(svg); } catch (e) {}
      try { fixAxis(svg); } catch (e) {}
    }
    if (needRedraw) redrawOnce();
  }

  // One sweep at a time. Changes made during a sweep ask for one more pass afterwards;
  // that pass finds nothing new to fix, so it changes nothing and the chain stops.
  var timer = null, busy = false, pending = false;
  function schedule() {
    if (busy) { pending = true; return; }
    clearTimeout(timer);
    timer = setTimeout(function () {
      busy = true;
      try { sweep(); } finally {
        setTimeout(function () {
          busy = false;
          if (pending) { pending = false; schedule(); }
        }, 0);
      }
    }, 180);
  }

  if (!wrapChart()) {
    var n = 0, iv = setInterval(function () { n++; if (wrapChart() || n > 120) clearInterval(iv); }, 250);
  }
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var tg = muts[i].target;
      if (tg && tg.closest && tg.closest("svg.frappe-chart, .chart-container, .widget")) { schedule(); return; }
      var add = muts[i].addedNodes;
      for (var j = 0; j < add.length; j++) {
        if (add[j].nodeType === 1 && (add[j].matches("svg.frappe-chart, .chart-container") ||
            (add[j].querySelector && add[j].querySelector("svg.frappe-chart")))) { schedule(); return; }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  schedule();
})();
