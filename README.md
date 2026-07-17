# SCORE 2 — Risque cardiovasculaire (SCORE2 & SCORE2-OP)

Outil web du portail **Dr ONKH** calculant le risque cardiovasculaire à 10 ans
selon les algorithmes **SCORE2** (40–69 ans) et **SCORE2-OP** (≥ 70 ans) de la
Société européenne de cardiologie (ESC 2021, réaffirmés ESC 2023), calibrés pour
la **France** (région à bas risque). Il propose en plus une **simulation
pédagogique** de l'effet d'une baisse du LDL cholestérol, en appui à l'éducation
thérapeutique en consultation.

## Ce que fait l'outil

- Estime le risque d'un **premier événement cardiovasculaire fatal ou non fatal**
  (infarctus, AVC) à 10 ans, chez un sujet **apparemment sain**.
- Bascule automatiquement entre SCORE2 (40–69 ans) et SCORE2-OP (≥ 70 ans).
- Classe le risque selon les catégories ESC 2021 (dépendantes de l'âge).
- **Simulation multi-paramètres** : fait varier en direct le **LDL**, la **pression
  artérielle systolique** et le **tabagisme**, et chiffre la variation absolue
  (points de %) et relative du SCORE2. La courbe risque = f(LDL) trace la situation
  actuelle du patient (pointillé) et la situation simulée (PAS/tabac choisis), avec
  les cibles LDL de l'ESC.
- **Module mode de vie** (pédagogique) : traduit une évolution du **poids**, de
  l'**IMC** et de l'adhérence au **régime méditerranéen** en variation de risque,
  sous forme d'une cascade « risque actuel → facteurs de risque améliorés → +
  bénéfice résiduel du régime ».
- **Affichage responsive** : la mise en page s'ajuste à la largeur de l'écran
  (aucun débordement horizontal sur smartphone).

## Modèle scientifique

Les équations sont celles publiées par les groupes de travail SCORE2 et
SCORE2-OP, coefficients repris du supplément officiel (Updated Supplementary
Material, p. 9) :

- SCORE2 working group & ESC Cardiovascular Risk Collaboration. *SCORE2 risk
  prediction algorithms: new models to estimate 10-year risk of cardiovascular
  disease in Europe.* **Eur Heart J. 2021;42(25):2439-2454.**
- SCORE2-OP working group. *SCORE2-OP risk prediction algorithms: estimating
  incident cardiovascular event risk in older persons in four geographical risk
  regions.* **Eur Heart J. 2021;42(25):2455-2467.**
- ESC Guidelines on cardiovascular disease prevention in clinical practice, 2021.
- ESC/EAS Guidelines for the management of dyslipidaemias, 2019 (cibles LDL).

### Points de méthode

- **Variable lipidique.** Le modèle SCORE2 utilise le **cholestérol total et le
  HDL** comme deux variables distinctes (le HDL est indispensable au calcul
  rigoureux). Les abaques couleur de l'ESC, indexées sur le non-HDL, sont une
  simplification qui peut classer différemment du modèle sous-jacent. On saisit
  ici le **non-HDL** et le **HDL** ; le cholestérol total est reconstitué :
  `CT = non-HDL + HDL`.
- **Unités.** Saisie en **g/L** (usage français) ; conversion vers mmol/L par
  `× 100 / 38,67 ≈ × 2,586`.
- **Recalibration France.** Facteurs de la région à **bas risque**.
- **Simulation LDL.** `non-HDL = LDL + VLDL` ; à HDL et triglycérides (donc VLDL)
  constants, `Δnon-HDL = ΔLDL`. La courbe recalcule le risque pour chaque valeur
  de LDL.
- **Simulation PAS / tabac.** Ces deux variables étant des paramètres directs de
  SCORE2, la simulation recalcule simplement l'algorithme avec la valeur choisie.
- **Module mode de vie (illustratif, hors SCORE2).** SCORE2 n'intègre **ni** le
  poids, **ni** l'IMC, **ni** l'alimentation. Le module traduit une perte de poids
  et l'adhérence au régime méditerranéen en variations plausibles de la **PAS** et
  du **LDL** (recalculées par SCORE2), puis applique un **bénéfice résiduel** propre
  au régime méditerranéen. Ordres de grandeur retenus :
  - perte de poids → PAS : ≈ 1 mmHg/kg (*Neter et al., Hypertension 2003*) ;
  - perte de poids → LDL : ≈ 0,005 g/L par kg (effet modeste) ;
  - régime méditerranéen : baisse de quelques mmHg de PAS et de ~0,05–0,10 g/L de
    LDL selon l'adhérence, plus un **RR résiduel ≈ 0,85** (forte adhérence), fraction
    conservatrice du bénéfice de l'essai **PREDIMED** (*Estruch et al., NEJM 2018*,
    HR global ≈ 0,70).

  Il s'agit d'**ordres de grandeur pédagogiques**, non d'une prédiction individuelle.
  Un modèle dédié à la trajectoire au long cours (*LIFE-CVD*) pourrait être intégré
  ultérieurement.

### Catégories de risque (ESC 2021)

| Âge         | Faible-modéré | Élevé       | Très élevé |
|-------------|---------------|-------------|------------|
| 40–49 ans   | < 2,5 %       | 2,5–7,5 %   | ≥ 7,5 %    |
| 50–69 ans   | < 5 %         | 5–10 %      | ≥ 10 %     |
| ≥ 70 ans    | < 7,5 %       | 7,5–15 %    | ≥ 15 %     |

L'implémentation embarque des **auto-tests** (`Score2.selfTest()`, exécutés au
chargement, visibles en console) comparant deux cas de référence calculés à la
main à partir des équations publiées.

## Limites d'usage

SCORE2 / SCORE2-OP ne s'appliquent **pas** en cas de maladie cardiovasculaire
établie, de diabète (→ *SCORE2-Diabetes*), d'insuffisance rénale chronique,
d'hypercholestérolémie familiale ou de grossesse. Outil d'aide à la décision : il
ne remplace ni le jugement clinique ni les recommandations en vigueur.

## Structure

```
index.html        Interface + verrou d'accès SSO du portail Dr ONKH
css/style.css     Styles (thème clair/sombre, mise en page responsive)
js/score2.js      Moteur de calcul SCORE2 / SCORE2-OP (+ auto-tests)
js/lifestyle.js   Couche pédagogique poids / IMC / régime méditerranéen
js/app.js         Interface, jauge, simulations (LDL · PAS · tabac · mode de vie)
```

## Déploiement

Site **statique** (aucune dépendance de build), déployé sur Vercel comme les
autres outils du portail. L'accès est protégé par le portail Dr ONKH
(authentification unifiée SSO) : un jeton `?t=<jwt>` est déposé par le portail,
stocké en `localStorage`, et vérifié côté client.

## Intégration au portail

La carte « SCORE 2 » est ajoutée au portail (`SITES`) et l'origine du site est
autorisée dans la liste SSO (`SSO_ALLOWED`).
