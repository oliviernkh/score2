/* =============================================================================
   Mode de vie — poids, IMC, régime méditerranéen → modulation du risque CV
   -----------------------------------------------------------------------------
   ATTENTION — cadrage scientifique.
   SCORE2 / SCORE2-OP n'intègrent NI le poids, NI l'IMC, NI l'alimentation comme
   variables. Ce module est une couche PÉDAGOGIQUE, distincte du moteur validé
   (js/score2.js), qui traduit une évolution du mode de vie en variations
   plausibles des facteurs de risque effectivement pris en compte par SCORE2
   (pression artérielle systolique et LDL/non-HDL), puis applique un bénéfice
   RÉSIDUEL propre au régime méditerranéen (part de l'effet non expliquée par ces
   facteurs), d'après les essais d'intervention. Les ordres de grandeur sont
   volontairement conservateurs et servent l'illustration, non la prédiction.

   Sources des ordres de grandeur retenus :
     • Perte de poids → PAS : ≈ 1 mmHg de PAS par kg perdu.
       Neter JE et al. Hypertension. 2003;42:878-884 (méta-analyse).
     • Perte de poids → LDL : effet modeste (l'amaigrissement agit surtout sur
       triglycérides et HDL). Ordre de grandeur retenu ≈ 0,005 g/L de LDL par kg.
       Poobalan A et al. Obes Rev. 2004 (revue systématique).
     • Régime méditerranéen → PAS et LDL : baisse de quelques mmHg et de
       ~0,05–0,10 g/L de LDL selon l'adhérence.
       Estruch R et al. Ann Intern Med. 2006 ; Toledo E et al. 2013.
     • Bénéfice résiduel (RR) du régime méditerranéen sur les événements CV,
       au-delà des seuls facteurs de risque : essai PREDIMED, HR ≈ 0,70 pour
       une forte adhérence (Estruch R et al. N Engl J Med. 2018;378:e34). On ne
       retient ici qu'une FRACTION de ce bénéfice comme « résiduelle » (le reste
       transitant déjà par la PAS et le LDL), d'où RR ≈ 0,85 (forte adhérence).
   ========================================================================== */

(function (global) {
  "use strict";

  var K_SBP_PER_KG = 1.0;    // mmHg de PAS gagnés par kg perdu
  var K_LDL_PER_KG = 0.005;  // g/L de LDL gagnés par kg perdu

  /* Régime méditerranéen selon niveau d'adhérence.
     dSbp / dLdl : décalages appliqués aux facteurs SCORE2 (mmHg, g/L).
     rr          : risque relatif RÉSIDUEL (au-delà de PAS + LDL). */
  var DIET = {
    0: { key: "low",  label: "Habituel / faible",       dSbp: 0,    dLdl: 0,     rr: 1.00 },
    1: { key: "mod",  label: "Adhérence modérée",       dSbp: -1.5, dLdl: -0.05, rr: 0.93 },
    2: { key: "high", label: "Adhérence élevée",        dSbp: -3.0, dLdl: -0.10, rr: 0.85 }
  };

  function bmi(weightKg, heightCm) {
    var h = heightCm / 100;
    return h > 0 ? weightKg / (h * h) : 0;
  }

  // Classification IMC (OMS), avec clé de couleur pour l'affichage.
  function bmiClass(b) {
    if (b < 18.5) return { key: "low",    color: "low",    label: "Insuffisance pondérale" };
    if (b < 25)   return { key: "normal", color: "normal", label: "Corpulence normale" };
    if (b < 30)   return { key: "over",   color: "over",   label: "Surpoids" };
    if (b < 35)   return { key: "ob1",    color: "ob",     label: "Obésité modérée (I)" };
    if (b < 40)   return { key: "ob2",    color: "ob",     label: "Obésité sévère (II)" };
    return              { key: "ob3",    color: "ob",     label: "Obésité morbide (III)" };
  }

  /* Décalages appliqués aux facteurs SCORE2 + RR résiduel régime.
     opts : { weightCurrent, weightTarget, diet } (diet = 0|1|2) */
  function modifiers(opts) {
    var dw = (opts.weightTarget - opts.weightCurrent);   // <0 = perte de poids
    var diet = DIET[opts.diet] || DIET[0];
    return {
      deltaWeight: dw,
      dSbp: K_SBP_PER_KG * dw + diet.dSbp,   // mmHg (négatif = baisse)
      dLdl: K_LDL_PER_KG * dw + diet.dLdl,   // g/L  (négatif = baisse)
      rr: diet.rr,
      diet: diet
    };
  }

  global.Lifestyle = {
    bmi: bmi,
    bmiClass: bmiClass,
    modifiers: modifiers,
    DIET: DIET,
    K_SBP_PER_KG: K_SBP_PER_KG,
    K_LDL_PER_KG: K_LDL_PER_KG
  };
})(typeof window !== "undefined" ? window : globalThis);
