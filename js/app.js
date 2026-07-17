/* =============================================================================
   SCORE2 / SCORE2-OP — interface (calcul + simulation pédagogique LDL)
   Dépend de js/score2.js (objet global Score2).
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Score2;

  // Auto-tests en console (traçabilité de l'implémentation).
  try {
    var st = S.selfTest();
    var okAll = st.every(function (t) { return t.ok; });
    console.log("%cSCORE2 auto-tests : " + (okAll ? "OK" : "ÉCHEC"),
      "color:" + (okAll ? "#10b981" : "#dc2626") + ";font-weight:bold", st);
  } catch (e) { console.warn("Auto-tests SCORE2 indisponibles", e); }

  /* --- État ---------------------------------------------------------------- */
  var state = {
    sex: "male",
    age: 55,
    smoker: 0,
    sbp: 140,
    hdl: 0.50,      // g/L
    nonHDL: 1.60,   // g/L
    ldl: 1.30,      // g/L
    region: "Low",
    ldlTarget: 1.30 // g/L (cible simulée)
  };

  // Cibles LDL de référence ESC 2019/2021 (g/L) selon catégorie de risque.
  var LDL_TARGETS = [
    { ldl: 1.00, label: "Cible risque modéré (< 1,00 g/L)" },
    { ldl: 0.70, label: "Cible risque élevé (< 0,70 g/L)" },
    { ldl: 0.55, label: "Cible risque très élevé (< 0,55 g/L)" }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var els = {};

  function fmtPct(x) {
    return (Math.round(x * 10) / 10).toString().replace(".", ",");
  }
  function fmtG(x) {
    return (Math.round(x * 100) / 100).toFixed(2).replace(".", ",");
  }

  /* --- Segments / boutons -------------------------------------------------- */
  function bindSeg(containerId, key, cast) {
    var c = $(containerId);
    c.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var val = cast ? cast(b.dataset.val) : b.dataset.val;
      state[key] = val;
      Array.prototype.forEach.call(c.querySelectorAll("button"), function (btn) {
        btn.setAttribute("aria-pressed", btn === b ? "true" : "false");
      });
      recompute();
    });
  }

  /* --- Lecture des champs numériques -------------------------------------- */
  function num(el, fallback) {
    var v = parseFloat(String(el.value).replace(",", "."));
    return isNaN(v) ? fallback : v;
  }

  // LDL "ancre" effectivement utilisé : ne peut dépasser le non-HDL
  // (non-HDL = LDL + VLDL, VLDL ≥ 0). On ne réécrit pas la saisie de
  // l'utilisateur : on borne seulement la valeur servant au calcul.
  function anchorLdl() { return Math.min(state.ldl, state.nonHDL); }

  /* --- Recalcul global ----------------------------------------------------- */
  function recompute() {
    var warn = els.ldlWarn;
    if (state.ldl > state.nonHDL + 1e-9) {
      warn.classList.add("show");
      warn.textContent = "Le LDL saisi dépasse le non-HDL (" + fmtG(state.nonHDL) +
        " g/L) : la simulation utilise " + fmtG(state.nonHDL) + " g/L.";
    } else {
      warn.classList.remove("show");
    }

    // Non-HDL + CT reconstitué (affichage).
    var ct = state.nonHDL + state.hdl;
    els.derived.innerHTML =
      "Cholestérol total reconstitué : <b>" + fmtG(ct) + " g/L</b> · " +
      "non-HDL <b>" + fmtG(state.nonHDL) + " g/L</b> (= " +
      fmtG(S.cholGLtoMmol(state.nonHDL)) + " mmol/L)";

    var res = S.compute({
      sex: state.sex, age: state.age, smoker: state.smoker, sbp: state.sbp,
      nonHDL: state.nonHDL, hdl: state.hdl, region: state.region
    });

    renderResult(res);
    renderEducation(res);
  }

  /* --- Affichage du résultat ---------------------------------------------- */
  function renderResult(res) {
    $("resultPlaceholder").style.display = "none";
    $("resultBody").style.display = "block";

    els.modelBadge.textContent = res.model + (res.model === "SCORE2-OP" ? " · ≥ 70 ans" : " · 40–69 ans");
    els.riskBig.innerHTML = fmtPct(res.risk) + " <small>% à 10 ans</small>";

    var cat = res.category;
    var badge = els.catBadge;
    badge.className = "cat-badge cat-" + cat.key;
    badge.innerHTML = '<span class="dot"></span>' + cat.label;

    els.riskCap.textContent =
      "Risque d'événement cardiovasculaire (fatal ou non fatal) à 10 ans — région à bas risque (France).";

    renderGauge(res);
  }

  function renderGauge(res) {
    var b = res.bounds;                 // { lowMax, highMax }
    var max = Math.max(b.highMax * 2, Math.ceil(res.risk * 1.15), b.highMax + 5);
    var pos = Math.min(100, (res.risk / max) * 100);
    var lowW = (b.lowMax / max) * 100;
    var midW = ((b.highMax - b.lowMax) / max) * 100;
    var hiW = 100 - lowW - midW;

    els.gaugeTrack.innerHTML =
      '<span style="width:' + lowW + '%;background:var(--ok)"></span>' +
      '<span style="width:' + midW + '%;background:var(--warn)"></span>' +
      '<span style="width:' + hiW + '%;background:var(--danger)"></span>' +
      '<span class="gauge-marker" style="left:calc(' + pos + '% - 1.5px)"></span>';

    els.gaugeScale.innerHTML =
      "<span>0 %</span>" +
      "<span>" + fmtPct(b.lowMax) + " %</span>" +
      "<span>" + fmtPct(b.highMax) + " %</span>" +
      "<span>" + fmtPct(max) + " %</span>";
  }

  /* --- Section pédagogique LDL -------------------------------------------- */
  function renderEducation(res) {
    // Cible par défaut = LDL actuel si non encore touchée.
    var tgt = state.ldlTarget;
    var newRisk = S.riskForLDL({
      sex: state.sex, age: state.age, smoker: state.smoker, sbp: state.sbp,
      nonHDL: state.nonHDL, hdl: state.hdl, region: state.region
    }, anchorLdl(), tgt);

    var absDelta = newRisk - res.risk;                        // points de %
    var relDelta = res.risk > 0 ? (absDelta / res.risk) * 100 : 0;

    els.simLdlVal.textContent = fmtG(tgt) + " g/L";
    els.simRiskVal.innerHTML = fmtPct(newRisk) + " <small>%</small>";

    var pill = els.simDelta;
    if (Math.abs(absDelta) < 0.05) {
      pill.className = "delta-pill";
      pill.textContent = "= risque inchangé";
    } else if (absDelta < 0) {
      pill.className = "delta-pill";
      pill.innerHTML = "▼ " + fmtPct(Math.abs(absDelta)) + " pt · " +
        Math.round(Math.abs(relDelta)) + " % de risque relatif en moins";
    } else {
      pill.className = "delta-pill up";
      pill.innerHTML = "▲ " + fmtPct(absDelta) + " pt · +" +
        Math.round(relDelta) + " % de risque relatif";
    }

    renderChart(res);
  }

  /* --- Graphique risque = f(LDL) ------------------------------------------ */
  function renderChart(res) {
    var W = 520, H = 240;
    var padL = 42, padR = 14, padT = 16, padB = 34;
    var x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;

    var ldlMin = 0.30;
    var ldlMax = state.nonHDL; // le LDL ne peut dépasser le non-HDL
    if (ldlMax - ldlMin < 0.4) ldlMax = ldlMin + 0.4;

    var params = {
      sex: state.sex, age: state.age, smoker: state.smoker, sbp: state.sbp,
      nonHDL: state.nonHDL, hdl: state.hdl, region: state.region
    };
    var anchor = anchorLdl();
    var pts = S.ldlSeries(params, anchor, ldlMin, ldlMax, (ldlMax - ldlMin) / 60);

    var rMax = 0;
    pts.forEach(function (p) { if (p.risk > rMax) rMax = p.risk; });
    rMax = Math.max(rMax * 1.15, res.risk * 1.2, 2);
    // Arrondi joli
    var step = rMax > 40 ? 20 : rMax > 20 ? 10 : rMax > 10 ? 5 : rMax > 5 ? 2 : 1;
    rMax = Math.ceil(rMax / step) * step;

    var sx = function (ldl) { return x0 + (ldl - ldlMin) / (ldlMax - ldlMin) * (x1 - x0); };
    var sy = function (r) { return y0 - (r / rMax) * (y0 - y1); };

    var svg = [];
    svg.push('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Courbe du risque cardiovasculaire à 10 ans en fonction du LDL cholestérol">');

    // Grille horizontale + libellés Y
    var yticks = [];
    for (var r = 0; r <= rMax + 1e-9; r += step) yticks.push(r);
    yticks.forEach(function (r) {
      var y = sy(r);
      svg.push('<line class="grid-line" x1="' + x0 + '" y1="' + y.toFixed(1) +
        '" x2="' + x1 + '" y2="' + y.toFixed(1) + '"/>');
      svg.push('<text class="axis-txt" x="' + (x0 - 6) + '" y="' + (y + 3.5).toFixed(1) +
        '" text-anchor="end">' + fmtPct(r) + '</text>');
    });

    // Aire + courbe
    var line = pts.map(function (p, i) {
      return (i ? "L" : "M") + sx(p.ldl).toFixed(1) + " " + sy(p.risk).toFixed(1);
    }).join(" ");
    var area = "M" + sx(pts[0].ldl).toFixed(1) + " " + y0 + " " +
      pts.map(function (p) { return "L" + sx(p.ldl).toFixed(1) + " " + sy(p.risk).toFixed(1); }).join(" ") +
      " L" + sx(pts[pts.length - 1].ldl).toFixed(1) + " " + y0 + " Z";
    svg.push('<path class="area" d="' + area + '"/>');
    svg.push('<path class="curve" d="' + line + '"/>');

    // Lignes de cibles ESC (verticales)
    LDL_TARGETS.forEach(function (t) {
      if (t.ldl < ldlMin || t.ldl > ldlMax) return;
      var x = sx(t.ldl);
      svg.push('<line class="target-line" x1="' + x.toFixed(1) + '" y1="' + y1 +
        '" x2="' + x.toFixed(1) + '" y2="' + y0 + '"/>');
      svg.push('<text class="target-txt" x="' + x.toFixed(1) + '" y="' + (y1 + 9) +
        '" text-anchor="middle">' + fmtG(t.ldl).replace(",", ",") + '</text>');
    });

    // Point actuel
    var pcx = sx(anchor), pcy = sy(S.riskForLDL(params, anchor, anchor));
    svg.push('<circle class="pt-current" cx="' + pcx.toFixed(1) + '" cy="' + pcy.toFixed(1) + '" r="4.5"/>');

    // Point cible
    var ptx = sx(state.ldlTarget), pty = sy(S.riskForLDL(params, anchor, state.ldlTarget));
    svg.push('<circle class="pt-target" cx="' + ptx.toFixed(1) + '" cy="' + pty.toFixed(1) + '" r="6"/>');

    // Libellés axes
    svg.push('<text class="axis-txt" x="' + ((x0 + x1) / 2) + '" y="' + (H - 6) +
      '" text-anchor="middle">LDL-cholestérol (g/L)</text>');
    // graduations X
    var xt = [ldlMin, (ldlMin + ldlMax) / 2, ldlMax];
    xt.forEach(function (v) {
      svg.push('<text class="axis-txt" x="' + sx(v).toFixed(1) + '" y="' + (y0 + 15) +
        '" text-anchor="middle">' + fmtG(v) + '</text>');
    });

    svg.push('</svg>');
    els.chart.innerHTML = svg.join("");
  }

  /* --- Initialisation ------------------------------------------------------ */
  function init() {
    els.derived = $("derived");
    els.modelBadge = $("modelBadge");
    els.riskBig = $("riskBig");
    els.catBadge = $("catBadge");
    els.riskCap = $("riskCap");
    els.gaugeTrack = $("gaugeTrack");
    els.gaugeScale = $("gaugeScale");
    els.ldl = $("ldl");
    els.ldlWarn = $("ldlWarn");
    els.simLdlVal = $("simLdlVal");
    els.simRiskVal = $("simRiskVal");
    els.simDelta = $("simDelta");
    els.chart = $("chart");

    bindSeg("sexSeg", "sex");
    bindSeg("smokeSeg", "smoker", function (v) { return parseInt(v, 10); });

    // Champs numériques
    $("age").addEventListener("input", function () {
      state.age = Math.max(40, Math.min(89, Math.round(num(this, state.age))));
      recompute();
    });
    $("age").addEventListener("blur", function () { this.value = state.age; });

    $("sbp").addEventListener("input", function () {
      state.sbp = num(this, state.sbp); recompute();
    });
    $("hdl").addEventListener("input", function () {
      state.hdl = num(this, state.hdl); recompute();
    });
    $("nonhdl").addEventListener("input", function () {
      state.nonHDL = num(this, state.nonHDL);
      // La cible ne peut dépasser le non-HDL ; on resynchronise le curseur.
      state.ldlTarget = Math.min(state.ldlTarget, state.nonHDL);
      syncTargetSlider();
      recompute();
    });
    els.ldl.addEventListener("input", function () {
      state.ldl = num(this, state.ldl);
      state.ldlTarget = anchorLdl();               // repart de la valeur actuelle
      syncTargetSlider();
      recompute();
    });

    $("region").addEventListener("change", function () {
      state.region = this.value; recompute();
    });

    // Curseur cible LDL
    var slider = $("ldlSlider");
    slider.addEventListener("input", function () {
      state.ldlTarget = parseFloat(this.value);
      this.style.setProperty("--pct", pctOfSlider(this) + "%");
      recompute();
    });
    els.ldlSlider = slider;

    // Valeurs initiales dans le DOM
    $("age").value = state.age;
    $("sbp").value = state.sbp;
    $("hdl").value = fmtG(state.hdl);
    $("nonhdl").value = fmtG(state.nonHDL);
    els.ldl.value = fmtG(state.ldl);
    syncTargetSlider();

    recompute();
  }

  function syncTargetSlider() {
    var slider = $("ldlSlider");
    slider.min = 0.30;
    slider.max = Math.max(state.nonHDL, state.ldl).toFixed(2);
    slider.step = 0.05;
    slider.value = state.ldlTarget;
    slider.style.setProperty("--pct", pctOfSlider(slider) + "%");
  }
  function pctOfSlider(s) {
    var mn = parseFloat(s.min), mx = parseFloat(s.max), v = parseFloat(s.value);
    return mx > mn ? ((v - mn) / (mx - mn)) * 100 : 50;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
