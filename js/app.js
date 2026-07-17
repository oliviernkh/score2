/* =============================================================================
   SCORE2 / SCORE2-OP — interface
   - Calcul du risque patient
   - Simulation multi-paramètres : LDL · pression systolique · tabac
   - Module mode de vie : poids · IMC · régime méditerranéen (js/lifestyle.js)
   Dépend de js/score2.js (Score2) et js/lifestyle.js (Lifestyle).
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Score2;
  var L = window.Lifestyle;

  // Auto-tests en console (traçabilité de l'implémentation).
  try {
    var st = S.selfTest();
    var okAll = st.every(function (t) { return t.ok; });
    console.log("%cSCORE2 auto-tests : " + (okAll ? "OK" : "ÉCHEC"),
      "color:" + (okAll ? "#10b981" : "#dc2626") + ";font-weight:bold", st);
  } catch (e) { console.warn("Auto-tests SCORE2 indisponibles", e); }

  /* --- État ---------------------------------------------------------------- */
  var state = {
    // Patient
    sex: "male",
    age: 55,
    smoker: 0,
    sbp: 140,
    hdl: 0.50,      // g/L
    nonHDL: 1.60,   // g/L
    ldl: 1.30,      // g/L
    region: "Low",

    // Simulation facteurs de risque
    ldlTarget: 1.30, // g/L (cible LDL simulée)
    simSbp: 140,     // mmHg (PAS simulée)
    simSmoker: 0,    // tabac simulé

    // Mode de vie
    weight: 85,      // kg
    height: 172,     // cm
    weightTarget: 85,// kg (cible)
    diet: 0          // 0 habituel · 1 modérée · 2 élevée
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
  function fmt1(x) {
    return (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");
  }

  /* --- Segments / boutons -------------------------------------------------- */
  function bindSeg(containerId, key, cast, after) {
    var c = $(containerId);
    c.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var val = cast ? cast(b.dataset.val) : b.dataset.val;
      state[key] = val;
      Array.prototype.forEach.call(c.querySelectorAll("button"), function (btn) {
        btn.setAttribute("aria-pressed", btn === b ? "true" : "false");
      });
      if (after) after(val);
      recompute();
    });
  }
  function setSegPressed(containerId, val) {
    var c = $(containerId);
    Array.prototype.forEach.call(c.querySelectorAll("button"), function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.val) === String(val) ? "true" : "false");
    });
  }

  /* --- Lecture des champs numériques -------------------------------------- */
  function num(el, fallback) {
    var v = parseFloat(String(el.value).replace(",", "."));
    return isNaN(v) ? fallback : v;
  }

  // LDL "ancre" effectivement utilisé : ne peut dépasser le non-HDL
  // (non-HDL = LDL + VLDL, VLDL ≥ 0). On ne réécrit pas la saisie : on borne
  // seulement la valeur servant au calcul.
  function anchorLdl() { return Math.min(state.ldl, state.nonHDL); }

  // Paramètres SCORE2 du patient (situation réelle).
  function patientParams() {
    return {
      sex: state.sex, age: state.age, smoker: state.smoker, sbp: state.sbp,
      nonHDL: state.nonHDL, hdl: state.hdl, region: state.region
    };
  }
  // Paramètres de la courbe simulée : mêmes lipides mais PAS et tabac choisis.
  function simChartParams() {
    return {
      sex: state.sex, age: state.age, smoker: state.simSmoker, sbp: state.simSbp,
      nonHDL: state.nonHDL, hdl: state.hdl, region: state.region
    };
  }

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

    var res = S.compute(patientParams());

    renderResult(res);
    renderEducation(res);
    renderLifestyle(res);
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

    if (res.model === "SCORE2-OP") {
      els.opNote.classList.add("show");
      els.opNote.innerHTML =
        "<b>Modèle SCORE2-OP appliqué.</b> À partir de 70 ans, le calcul bascule " +
        "automatiquement sur l'algorithme dédié aux personnes âgées (Older Persons), " +
        "distinct de SCORE2 (40–69 ans).";
    } else {
      els.opNote.classList.remove("show");
    }

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

  /* --- Simulation multi-paramètres (LDL · PAS · tabac) --------------------- */
  // Risque simulé : SCORE2 avec LDL cible, PAS et tabac choisis.
  function simulatedRisk() {
    var anchor = anchorLdl();
    var nonHDLsim = Math.max(0.1, state.nonHDL + (state.ldlTarget - anchor));
    return S.compute({
      sex: state.sex, age: state.age, smoker: state.simSmoker, sbp: state.simSbp,
      nonHDL: nonHDLsim, hdl: state.hdl, region: state.region
    }).risk;
  }

  function renderEducation(res) {
    var simRisk = simulatedRisk();
    var absDelta = simRisk - res.risk;                        // points de %
    var relDelta = res.risk > 0 ? (absDelta / res.risk) * 100 : 0;

    els.simLdlVal.textContent = fmtG(state.ldlTarget) + " g/L";
    els.simSbpVal.textContent = Math.round(state.simSbp) + " mmHg";
    els.simBaseVal.innerHTML = fmtPct(res.risk) + " <small>%</small>";
    els.simRiskVal.innerHTML = fmtPct(simRisk) + " <small>%</small>";
    setSegPressed("simSmokeSeg", state.simSmoker);

    var pill = els.simDelta;
    if (Math.abs(absDelta) < 0.05) {
      pill.className = "delta-pill";
      pill.textContent = "= risque inchangé vs situation actuelle";
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

  /* --- Graphique risque = f(LDL) : courbe actuelle + courbe simulée -------- */
  function renderChart(res) {
    var W = 520, H = 240;
    var padL = 42, padR = 14, padT = 16, padB = 34;
    var x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;

    var ldlMin = 0.30;
    var ldlMax = state.nonHDL; // le LDL ne peut dépasser le non-HDL
    if (ldlMax - ldlMin < 0.4) ldlMax = ldlMin + 0.4;

    var baseP = patientParams();
    var simP = simChartParams();
    var anchor = anchorLdl();
    var step = (ldlMax - ldlMin) / 60;
    var basePts = S.ldlSeries(baseP, anchor, ldlMin, ldlMax, step);
    var simPts  = S.ldlSeries(simP,  anchor, ldlMin, ldlMax, step);

    var rMax = 0;
    basePts.concat(simPts).forEach(function (p) { if (p.risk > rMax) rMax = p.risk; });
    rMax = Math.max(rMax * 1.15, res.risk * 1.2, 2);
    var stp = rMax > 40 ? 20 : rMax > 20 ? 10 : rMax > 10 ? 5 : rMax > 5 ? 2 : 1;
    rMax = Math.ceil(rMax / stp) * stp;

    var sx = function (ldl) { return x0 + (ldl - ldlMin) / (ldlMax - ldlMin) * (x1 - x0); };
    var sy = function (r) { return y0 - (r / rMax) * (y0 - y1); };
    var pathOf = function (pts) {
      return pts.map(function (p, i) {
        return (i ? "L" : "M") + sx(p.ldl).toFixed(1) + " " + sy(p.risk).toFixed(1);
      }).join(" ");
    };

    var svg = [];
    svg.push('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Courbe du risque cardiovasculaire à 10 ans en fonction du LDL cholestérol">');

    // Grille horizontale + libellés Y
    var yticks = [];
    for (var r = 0; r <= rMax + 1e-9; r += stp) yticks.push(r);
    yticks.forEach(function (r) {
      var y = sy(r);
      svg.push('<line class="grid-line" x1="' + x0 + '" y1="' + y.toFixed(1) +
        '" x2="' + x1 + '" y2="' + y.toFixed(1) + '"/>');
      svg.push('<text class="axis-txt" x="' + (x0 - 6) + '" y="' + (y + 3.5).toFixed(1) +
        '" text-anchor="end">' + fmtPct(r) + '</text>');
    });

    // Aire + courbe simulée (solide, accent)
    var area = "M" + sx(simPts[0].ldl).toFixed(1) + " " + y0 + " " +
      simPts.map(function (p) { return "L" + sx(p.ldl).toFixed(1) + " " + sy(p.risk).toFixed(1); }).join(" ") +
      " L" + sx(simPts[simPts.length - 1].ldl).toFixed(1) + " " + y0 + " Z";
    svg.push('<path class="area" d="' + area + '"/>');

    // Courbe actuelle (pointillée) — n'apparaît distincte que si PAS/tabac diffèrent
    var differs = (state.simSbp !== state.sbp) || (state.simSmoker !== state.smoker);
    if (differs) svg.push('<path class="curve-base" d="' + pathOf(basePts) + '"/>');
    svg.push('<path class="curve" d="' + pathOf(simPts) + '"/>');

    // Lignes de cibles ESC (verticales)
    LDL_TARGETS.forEach(function (t) {
      if (t.ldl < ldlMin || t.ldl > ldlMax) return;
      var x = sx(t.ldl);
      svg.push('<line class="target-line" x1="' + x.toFixed(1) + '" y1="' + y1 +
        '" x2="' + x.toFixed(1) + '" y2="' + y0 + '"/>');
      svg.push('<text class="target-txt" x="' + x.toFixed(1) + '" y="' + (y1 + 9) +
        '" text-anchor="middle">' + fmtG(t.ldl) + '</text>');
    });

    // Point actuel (patient) — sur la courbe actuelle
    var pcx = sx(anchor), pcy = sy(S.riskForLDL(baseP, anchor, anchor));
    svg.push('<circle class="pt-base" cx="' + pcx.toFixed(1) + '" cy="' + pcy.toFixed(1) + '" r="4.5"/>');

    // Point cible (simulé) — sur la courbe simulée
    var ptx = sx(state.ldlTarget), pty = sy(S.riskForLDL(simP, anchor, state.ldlTarget));
    svg.push('<circle class="pt-target" cx="' + ptx.toFixed(1) + '" cy="' + pty.toFixed(1) + '" r="6"/>');

    // Libellés axes
    svg.push('<text class="axis-txt" x="' + ((x0 + x1) / 2) + '" y="' + (H - 6) +
      '" text-anchor="middle">LDL-cholestérol (g/L)</text>');
    var xt = [ldlMin, (ldlMin + ldlMax) / 2, ldlMax];
    xt.forEach(function (v) {
      svg.push('<text class="axis-txt" x="' + sx(v).toFixed(1) + '" y="' + (y0 + 15) +
        '" text-anchor="middle">' + fmtG(v) + '</text>');
    });

    svg.push('</svg>');
    els.chart.innerHTML = svg.join("");
  }

  /* --- Module mode de vie (poids · IMC · régime) -------------------------- */
  function renderLifestyle(res) {
    $("lsPlaceholder").style.display = "none";
    $("lsBody").style.display = "block";

    var bNow = L.bmi(state.weight, state.height);
    var bTgt = L.bmi(state.weightTarget, state.height);
    var clsNow = L.bmiClass(bNow);
    var clsTgt = L.bmiClass(bTgt);

    els.bmiNow.innerHTML = fmt1(bNow) + ' <small>kg/m²</small>';
    els.bmiChipNow.className = "bmi-chip bmi-" + clsNow.color;
    els.bmiChipNow.innerHTML = '<span class="dot"></span>' + clsNow.label;

    var changed = Math.abs(state.weightTarget - state.weight) >= 0.5;
    els.bmiArrow.style.display = changed ? "" : "none";
    els.bmiTarget.style.display = changed ? "" : "none";
    els.bmiChipTarget.style.display = changed ? "" : "none";
    if (changed) {
      els.bmiTarget.innerHTML = fmt1(bTgt) + ' <small>kg/m²</small>';
      els.bmiChipTarget.className = "bmi-chip bmi-" + clsTgt.color;
      els.bmiChipTarget.innerHTML = '<span class="dot"></span>' + clsTgt.label;
    }

    var m = L.modifiers({
      weightCurrent: state.weight, weightTarget: state.weightTarget, diet: state.diet
    });

    // Étape 1 : PAS et LDL améliorés (poids + effet mécanistique du régime).
    var newSbp = Math.max(80, Math.min(260, state.sbp + m.dSbp));
    var newNonHDL = Math.max(0.3, state.nonHDL + m.dLdl);
    var rfRisk = S.compute({
      sex: state.sex, age: state.age, smoker: state.smoker, sbp: newSbp,
      nonHDL: newNonHDL, hdl: state.hdl, region: state.region
    }).risk;

    // Étape 2 : bénéfice résiduel du régime méditerranéen (RR PREDIMED).
    var dietRisk = rfRisk * m.rr;

    var scaleMax = Math.max(res.risk, rfRisk, dietRisk, 1);
    var pct = function (v) { return Math.max(2, (v / scaleMax) * 100); };

    els.wfNow.innerHTML = fmtPct(res.risk) + ' <small>%</small>';
    els.wfRf.innerHTML = fmtPct(rfRisk) + ' <small>%</small>';
    els.wfDiet.innerHTML = fmtPct(dietRisk) + ' <small>%</small>';
    els.wfNowBar.style.width = pct(res.risk) + "%";
    els.wfRfBar.style.width = pct(rfRisk) + "%";
    els.wfDietBar.style.width = pct(dietRisk) + "%";

    var absDelta = dietRisk - res.risk;
    var relDelta = res.risk > 0 ? (absDelta / res.risk) * 100 : 0;
    var pill = els.lsDelta;
    if (Math.abs(absDelta) < 0.05) {
      pill.className = "delta-pill";
      pill.textContent = "= risque inchangé vs situation actuelle";
    } else if (absDelta < 0) {
      pill.className = "delta-pill";
      pill.innerHTML = "▼ " + fmtPct(Math.abs(absDelta)) + " pt · " +
        Math.round(Math.abs(relDelta)) + " % de risque relatif en moins";
    } else {
      pill.className = "delta-pill up";
      pill.innerHTML = "▲ " + fmtPct(absDelta) + " pt · +" +
        Math.round(relDelta) + " % de risque relatif";
    }
  }

  /* --- Synchronisation des curseurs --------------------------------------- */
  function syncTargetSlider() {
    var slider = $("ldlSlider");
    slider.min = 0.30;
    slider.max = Math.max(state.nonHDL, state.ldl).toFixed(2);
    slider.step = 0.05;
    slider.value = state.ldlTarget;
    slider.style.setProperty("--pct", pctOfSlider(slider) + "%");
  }
  function syncSbpSlider() {
    var slider = $("sbpSlider");
    slider.min = 80; slider.max = 220; slider.step = 1;
    slider.value = Math.max(80, Math.min(220, state.simSbp));
    slider.style.setProperty("--pct", pctOfSlider(slider) + "%");
  }
  function syncWeightSlider() {
    var slider = $("weightSlider");
    slider.min = Math.max(40, Math.round(state.weight * 0.6));
    slider.max = Math.round(state.weight);
    slider.step = 1;
    slider.value = Math.min(state.weightTarget, state.weight);
    slider.style.setProperty("--pct", pctOfSlider(slider) + "%");
    var d = state.weightTarget - state.weight;
    els.weightTargetLbl.textContent = Math.abs(d) < 0.5
      ? "= poids actuel"
      : Math.round(state.weightTarget) + " kg (" + (d < 0 ? "−" : "+") + Math.abs(Math.round(d)) + " kg)";
  }
  function pctOfSlider(s) {
    var mn = parseFloat(s.min), mx = parseFloat(s.max), v = parseFloat(s.value);
    return mx > mn ? ((v - mn) / (mx - mn)) * 100 : 50;
  }

  /* --- Initialisation ------------------------------------------------------ */
  function init() {
    els.derived = $("derived");
    els.modelBadge = $("modelBadge");
    els.riskBig = $("riskBig");
    els.catBadge = $("catBadge");
    els.riskCap = $("riskCap");
    els.opNote = $("opNote");
    els.gaugeTrack = $("gaugeTrack");
    els.gaugeScale = $("gaugeScale");
    els.ldl = $("ldl");
    els.ldlWarn = $("ldlWarn");
    els.simLdlVal = $("simLdlVal");
    els.simSbpVal = $("simSbpVal");
    els.simBaseVal = $("simBaseVal");
    els.simRiskVal = $("simRiskVal");
    els.simDelta = $("simDelta");
    els.chart = $("chart");
    // Mode de vie
    els.bmiNow = $("bmiNow");
    els.bmiTarget = $("bmiTarget");
    els.bmiChipNow = $("bmiChipNow");
    els.bmiChipTarget = $("bmiChipTarget");
    els.bmiArrow = $("bmiArrow");
    els.weightTargetLbl = $("weightTargetLbl");
    els.wfNow = $("wfNow");
    els.wfRf = $("wfRf");
    els.wfDiet = $("wfDiet");
    els.wfNowBar = $("wfNowBar");
    els.wfRfBar = $("wfRfBar");
    els.wfDietBar = $("wfDietBar");
    els.lsDelta = $("lsDelta");

    // Segments patient — le tabac patient réinitialise le tabac simulé.
    bindSeg("sexSeg", "sex");
    bindSeg("smokeSeg", "smoker", function (v) { return parseInt(v, 10); }, function (v) {
      state.simSmoker = v; setSegPressed("simSmokeSeg", v);
    });
    // Segments simulation / mode de vie
    bindSeg("simSmokeSeg", "simSmoker", function (v) { return parseInt(v, 10); });
    bindSeg("dietSeg", "diet", function (v) { return parseInt(v, 10); });

    // Champs numériques patient
    $("age").addEventListener("input", function () {
      state.age = Math.max(40, Math.min(89, Math.round(num(this, state.age))));
      recompute();
    });
    $("age").addEventListener("blur", function () { this.value = state.age; });

    $("sbp").addEventListener("input", function () {
      state.sbp = num(this, state.sbp);
      state.simSbp = state.sbp;      // la PAS simulée suit la PAS patient
      syncSbpSlider();
      recompute();
    });
    $("hdl").addEventListener("input", function () {
      state.hdl = num(this, state.hdl); recompute();
    });
    $("nonhdl").addEventListener("input", function () {
      state.nonHDL = num(this, state.nonHDL);
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
    $("ldlSlider").addEventListener("input", function () {
      state.ldlTarget = parseFloat(this.value);
      this.style.setProperty("--pct", pctOfSlider(this) + "%");
      recompute();
    });
    // Curseur PAS simulée
    $("sbpSlider").addEventListener("input", function () {
      state.simSbp = parseInt(this.value, 10);
      this.style.setProperty("--pct", pctOfSlider(this) + "%");
      recompute();
    });
    // Réinitialisation de la simulation sur le patient
    $("simReset").addEventListener("click", function () {
      state.ldlTarget = anchorLdl();
      state.simSbp = state.sbp;
      state.simSmoker = state.smoker;
      syncTargetSlider(); syncSbpSlider();
      setSegPressed("simSmokeSeg", state.simSmoker);
      recompute();
    });

    // Champs mode de vie
    $("weight").addEventListener("input", function () {
      state.weight = Math.max(35, Math.min(250, num(this, state.weight)));
      state.weightTarget = Math.min(state.weightTarget, state.weight);
      syncWeightSlider();
      recompute();
    });
    $("height").addEventListener("input", function () {
      state.height = Math.max(130, Math.min(220, num(this, state.height)));
      recompute();
    });
    $("weightSlider").addEventListener("input", function () {
      state.weightTarget = parseFloat(this.value);
      this.style.setProperty("--pct", pctOfSlider(this) + "%");
      syncWeightSlider();
      recompute();
    });

    // Valeurs initiales dans le DOM
    $("age").value = state.age;
    $("sbp").value = state.sbp;
    $("hdl").value = fmtG(state.hdl);
    $("nonhdl").value = fmtG(state.nonHDL);
    els.ldl.value = fmtG(state.ldl);
    $("weight").value = state.weight;
    $("height").value = state.height;
    syncTargetSlider();
    syncSbpSlider();
    syncWeightSlider();

    recompute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
