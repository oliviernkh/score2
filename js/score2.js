/* =============================================================================
   SCORE2 & SCORE2-OP — moteur de calcul du risque cardiovasculaire à 10 ans
   -----------------------------------------------------------------------------
   Algorithme officiel du groupe de travail SCORE2 / SCORE2-OP (ESC 2021) :

     • SCORE2 working group. "SCORE2 risk prediction algorithms: new models to
       estimate 10-year risk of cardiovascular disease in Europe."
       Eur Heart J. 2021;42(25):2439-2454.
     • SCORE2-OP working group. "SCORE2-OP risk prediction algorithms: estimating
       incident cardiovascular event risk in older persons in four geographical
       risk regions." Eur Heart J. 2021;42(25):2455-2467.
     • Recommandations ESC 2021 de prévention cardiovasculaire (catégories de
       risque par tranche d'âge) — réaffirmées par les guidelines ESC 2023.

   Coefficients issus du supplément officiel (Updated Supplementary Material,
   p.9), reproduits à l'identique. Le modèle prédit le risque à 10 ans
   d'événement cardiovasculaire fatal ET non fatal (IDM, AVC), chez des sujets
   APPAREMMENT SAINS, sans antécédent cardiovasculaire ni diabète.

   France = région à BAS RISQUE ("Low") dans la classification ESC 2021.

   IMPORTANT — variable lipidique : contrairement à une idée répandue, le modèle
   SCORE2 n'utilise PAS le seul cholestérol non-HDL : il fait intervenir le
   cholestérol TOTAL et le HDL comme deux variables distinctes (les abaques
   couleur de l'ESC, indexées sur le non-HDL, sont une simplification qui peut
   classer différemment du modèle sous-jacent). Le HDL est donc indispensable au
   calcul rigoureux. On saisit ici le non-HDL (= paramètre clinique de référence)
   et le HDL ; le cholestérol total du modèle est reconstitué : CT = non-HDL + HDL.
   ========================================================================== */

(function (global) {
  "use strict";

  /* --- Coefficients SCORE2 (40–69 ans), log hazard ratios, par sexe --------- */
  const SCORE2 = {
    male: {
      age: 0.3742, smoke: 0.6012, sbp: 0.2777, diab: 0.6457,
      chol: 0.1458, hdl: -0.2698,
      age_smoke: -0.0755, age_sbp: -0.0255, age_chol: -0.0281,
      age_hdl: 0.0426, age_diab: -0.0983,
      baseline: 0.9605
    },
    female: {
      age: 0.4648, smoke: 0.7744, sbp: 0.3131, diab: 0.8096,
      chol: 0.1002, hdl: -0.2606,
      age_smoke: -0.1088, age_sbp: -0.0277, age_chol: -0.0226,
      age_hdl: 0.0613, age_diab: -0.1272,
      baseline: 0.9776
    }
  };

  /* --- Coefficients SCORE2-OP (≥70 ans), par sexe --------------------------- */
  const SCORE2_OP = {
    male: {
      age: 0.0634, diab: 0.4245, smoke: 0.3524, sbp: 0.0094,
      chol: 0.0850, hdl: -0.3564,
      age_diab: -0.0174, age_smoke: -0.0247, age_sbp: -0.0005,
      age_chol: 0.0073, age_hdl: 0.0091,
      baseline: 0.7576, offset: 0.0929
    },
    female: {
      age: 0.0789, diab: 0.6010, smoke: 0.4921, sbp: 0.0102,
      chol: 0.0605, hdl: -0.3040,
      age_diab: -0.0107, age_smoke: -0.0255, age_sbp: -0.0004,
      age_chol: -0.0009, age_hdl: 0.0154,
      baseline: 0.8082, offset: 0.229
    }
  };

  /* --- Facteurs de recalibration par région [scale1, scale2] ---------------- */
  const SCALES = {
    young: { // 40–69 ans (SCORE2)
      Low:         { male: [-0.5699, 0.7476], female: [-0.7380, 0.7019] },
      Moderate:    { male: [-0.1565, 0.8009], female: [-0.3143, 0.7701] },
      High:        { male: [ 0.3207, 0.9360], female: [ 0.5710, 0.9369] },
      "Very high": { male: [ 0.5836, 0.8294], female: [ 0.9412, 0.8329] }
    },
    old: { // ≥70 ans (SCORE2-OP)
      Low:         { male: [-0.34, 1.19], female: [-0.52, 1.01] },
      Moderate:    { male: [ 0.01, 1.25], female: [-0.10, 1.10] },
      High:        { male: [ 0.08, 1.15], female: [ 0.38, 1.09] },
      "Very high": { male: [ 0.05, 0.70], female: [ 0.38, 0.69] }
    }
  };

  /* --- Conversions d'unités (France : g/L) ---------------------------------- */
  // Cholestérol : 1 g/L = 100 mg/dL ; mmol/L = mg/dL / 38.67  →  ×(100/38.67).
  const CHOL_GL_TO_MMOL = 100 / 38.67;   // ≈ 2.5860
  function cholGLtoMmol(gL) { return gL * CHOL_GL_TO_MMOL; }
  function cholMmolToGL(mmol) { return mmol / CHOL_GL_TO_MMOL; }

  /* --------------------------------------------------------------------------
     Cœur du calcul.
     params :
       sex      : "male" | "female"
       age      : années (40–89)
       smoker   : 0 | 1 (tabagisme actif)
       sbp      : PAS en mmHg
       nonHDL   : cholestérol non-HDL en g/L
       hdl      : HDL en g/L
       diabetes : 0 | 1 (0 par défaut — SCORE2 n'est pas destiné aux diabétiques)
       region   : "Low" (France) | "Moderate" | "High" | "Very high"
     retourne : risque à 10 ans, en fraction (0–1)
     -------------------------------------------------------------------------- */
  function riskFraction(params) {
    const sex = params.sex === "female" ? "female" : "male";
    const age = params.age;
    const smoker = params.smoker ? 1 : 0;
    const diabetes = params.diabetes ? 1 : 0;
    const sbp = params.sbp;
    const region = params.region || "Low";

    // Modèle sur cholestérol total + HDL. CT = non-HDL + HDL.
    const cholMmol = cholGLtoMmol(params.nonHDL + params.hdl);
    const hdlMmol = cholGLtoMmol(params.hdl);

    let uncal, scale;

    if (age < 70) {
      const c = SCORE2[sex];
      const cage = (age - 60) / 5;
      const csbp = (sbp - 120) / 20;
      const cchol = (cholMmol - 6);        // /1
      const chdl = (hdlMmol - 1.3) / 0.5;

      const lp =
        c.age * cage +
        c.smoke * smoker +
        c.sbp * csbp +
        c.diab * diabetes +
        c.chol * cchol +
        c.hdl * chdl +
        c.age_smoke * cage * smoker +
        c.age_sbp * cage * csbp +
        c.age_chol * cage * cchol +
        c.age_hdl * cage * chdl +
        c.age_diab * cage * diabetes;

      uncal = 1 - Math.pow(c.baseline, Math.exp(lp));
      scale = SCALES.young[region][sex];
    } else {
      const c = SCORE2_OP[sex];
      const cage = (age - 73);
      const csbp = (sbp - 150);
      const cchol = (cholMmol - 6);
      const chdl = (hdlMmol - 1.4);

      const lp =
        c.age * cage +
        c.diab * diabetes +
        c.smoke * smoker +
        c.sbp * csbp +
        c.chol * cchol +
        c.hdl * chdl +
        c.age_diab * cage * diabetes +
        c.age_smoke * cage * smoker +
        c.age_sbp * cage * csbp +
        c.age_chol * cage * cchol +
        c.age_hdl * cage * chdl;

      uncal = 1 - Math.pow(c.baseline, Math.exp(lp - c.offset));
      scale = SCALES.old[region][sex];
    }

    // Recalibration région-spécifique (échelle log(-log)).
    const s1 = scale[0], s2 = scale[1];
    return 1 - Math.exp(-Math.exp(s1 + s2 * Math.log(-Math.log(1 - uncal))));
  }

  /* --- Catégorie de risque ESC 2021 (par tranche d'âge) --------------------- */
  // Renvoie { key, label } — clé technique + libellé officiel français.
  function riskCategory(age, riskPct) {
    let key;
    if (age < 50)       key = riskPct < 2.5 ? "low" : riskPct < 7.5 ? "high" : "veryhigh";
    else if (age <= 69) key = riskPct < 5   ? "low" : riskPct < 10  ? "high" : "veryhigh";
    else                key = riskPct < 7.5 ? "low" : riskPct < 15  ? "high" : "veryhigh";

    const labels = {
      low: "Risque faible à modéré",
      high: "Risque élevé",
      veryhigh: "Risque très élevé"
    };
    return { key: key, label: labels[key] };
  }

  // Bornes des catégories (pour affichage) selon la tranche d'âge.
  function categoryBounds(age) {
    if (age < 50) return { lowMax: 2.5, highMax: 7.5 };
    if (age <= 69) return { lowMax: 5, highMax: 10 };
    return { lowMax: 7.5, highMax: 15 };
  }

  /* --- Calcul complet -------------------------------------------------------- */
  function compute(params) {
    const frac = riskFraction(params);
    const pct = Math.round(frac * 1000) / 10; // 1 décimale
    return {
      risk: pct,                                   // %
      riskFraction: frac,
      model: params.age < 70 ? "SCORE2" : "SCORE2-OP",
      category: riskCategory(params.age, pct),
      bounds: categoryBounds(params.age)
    };
  }

  /* --------------------------------------------------------------------------
     Simulation pédagogique : variation du risque selon le LDL.
     Hypothèse physiologique : abaisser le LDL (statine, ézétimibe, anti-PCSK9)
     abaisse le non-HDL du même montant absolu, à HDL et triglycérides (donc
     VLDL) constants. On a en effet non-HDL = LDL + VLDL, VLDL restant fixe :
        Δ(non-HDL) = Δ(LDL).
     `ldlSeries` renvoie, pour une grille de valeurs de LDL, le risque associé.
     -------------------------------------------------------------------------- */
  function riskForLDL(params, ldlCurrent, ldlTarget) {
    const deltaNonHDL = ldlTarget - ldlCurrent;            // g/L
    const p = Object.assign({}, params, {
      nonHDL: Math.max(0.1, params.nonHDL + deltaNonHDL)
    });
    return riskFraction(p) * 100;
  }

  function ldlSeries(params, ldlCurrent, from, to, step) {
    const pts = [];
    for (let ldl = from; ldl <= to + 1e-9; ldl += step) {
      const v = Math.round(ldl * 100) / 100;
      pts.push({ ldl: v, risk: Math.round(riskForLDL(params, ldlCurrent, v) * 10) / 10 });
    }
    return pts;
  }

  /* --- Auto-tests (cohérence numérique de l'implémentation) ----------------- */
  // Cas de référence calculés à la main à partir des équations publiées.
  function selfTest() {
    const results = [];
    const approx = (a, b, tol) => Math.abs(a - b) <= tol;

    // Cas 1 — Homme 60 ans, non fumeur, PAS 120, CT 6.0 / HDL 1.3 mmol/L, Low.
    //  (non-HDL = 6.0-1.3 = 4.7 mmol/L = 1.818 g/L ; HDL = 1.3 mmol/L = 0.503 g/L)
    const r1 = riskFraction({
      sex: "male", age: 60, smoker: 0, sbp: 120, diabetes: 0, region: "Low",
      nonHDL: cholMmolToGL(4.7), hdl: cholMmolToGL(1.3)
    }) * 100;
    results.push({ name: "H60 réf.", got: +r1.toFixed(1), expected: 5.0, ok: approx(r1, 5.0, 0.2) });

    // Cas 2 — Homme 60 ans, fumeur, PAS 140, CT 6.2 / HDL 1.0 mmol/L, Low.
    const r2 = riskFraction({
      sex: "male", age: 60, smoker: 1, sbp: 140, diabetes: 0, region: "Low",
      nonHDL: cholMmolToGL(6.2 - 1.0), hdl: cholMmolToGL(1.0)
    }) * 100;
    results.push({ name: "H60 fumeur", got: +r2.toFixed(1), expected: 10.8, ok: approx(r2, 10.8, 0.3) });

    return results;
  }

  global.Score2 = {
    riskFraction: riskFraction,
    riskCategory: riskCategory,
    categoryBounds: categoryBounds,
    compute: compute,
    riskForLDL: riskForLDL,
    ldlSeries: ldlSeries,
    cholGLtoMmol: cholGLtoMmol,
    cholMmolToGL: cholMmolToGL,
    selfTest: selfTest,
    _coef: { SCORE2: SCORE2, SCORE2_OP: SCORE2_OP, SCALES: SCALES }
  };
})(typeof window !== "undefined" ? window : globalThis);
