# Graph Report - /workspace/score2  (2026-07-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 73 nodes · 86 edges · 31 communities (6 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 563 input · 328 output

## Graph Freshness
- Built from commit: `4541e159`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Chart Rendering Logic
- Cardiovascular Risk Guidelines
- Risk Calculation Engine
- UI Rendering Utilities
- Age Input Field
- Risk Category Display
- LDL Risk Visualization
- Diet Adherence Control
- Risk Gauge Component
- HDL Input Field
- Height Input Field
- LDL Input Field
- LDL Simulation Control
- Model Selection Badge
- Non-HDL Input Field
- Region Selector
- Risk Result Output
- Primary Risk Display
- Blood Pressure Input
- BP Simulation Control
- Sex Selection Control
- Simulation Reset
- Smoking Simulation Control
- Smoking Status Input
- Weight Input Field
- Weight Target Control
- Diet Impact Visualization
- Current Risk Visualization
- Risk Improvement Visualization

## God Nodes (most connected - your core abstractions)
1. `init()` - 11 edges
2. `SCORE2 & SCORE2-OP README` - 10 edges
3. `recompute()` - 8 edges
4. `renderEducation()` - 7 edges
5. `renderChart()` - 7 edges
6. `fmtPct()` - 6 edges
7. `fmtG()` - 5 edges
8. `pctOfSlider()` - 5 edges
9. `riskFraction()` - 5 edges
10. `anchorLdl()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Authentication Logic` --conceptually_related_to--> `SCORE2 & SCORE2-OP README`  [INFERRED]
  index.html → README.md

## Import Cycles
- None detected.

## Communities (31 total, 25 thin omitted)

### Community 0 - "Chart Rendering Logic"
Cohesion: 0.31
Nodes (16): anchorLdl(), bindSeg(), fmtG(), init(), num(), patientParams(), pctOfSlider(), recompute() (+8 more)

### Community 1 - "Cardiovascular Risk Guidelines"
Cohesion: 0.18
Nodes (10): Authentication Logic, SCORE2 & SCORE2-OP README, ESC 2021 Guidelines, ESC 2023 Guidelines, Lifestyle Module (Weight/IMC/Mediterranean Diet), Neter et al. (Hypertension 2003), PREDIMED Trial, SCORE2 Algorithm (+2 more)

### Community 2 - "Risk Calculation Engine"
Cohesion: 0.38
Nodes (9): categoryBounds(), cholGLtoMmol(), cholMmolToGL(), compute(), ldlSeries(), riskCategory(), riskForLDL(), riskFraction() (+1 more)

### Community 3 - "UI Rendering Utilities"
Cohesion: 0.50
Nodes (5): fmt1(), fmtPct(), renderGauge(), renderLifestyle(), renderResult()

## Knowledge Gaps
- **34 isolated node(s):** `SCORE2 Algorithm`, `SCORE2-OP Algorithm`, `LDL/PAS/Tabac Simulation`, `Lifestyle Module (Weight/IMC/Mediterranean Diet)`, `ESC 2021 Guidelines` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `recompute()` connect `Chart Rendering Logic` to `UI Rendering Utilities`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `SCORE2 Algorithm`, `SCORE2-OP Algorithm`, `LDL/PAS/Tabac Simulation` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._