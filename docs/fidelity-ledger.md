# Fidelity ledger

Date: 2026-07-24

## Reference

- Accepted mobile comparison concept: [compare-mobile-v5.png](design/concepts/compare-mobile-v5.png)
- Design source: [design-v5.html](design/source/design-v5.html)
- Final desktop comparison capture: [compare-desktop-final.png](design/renders/compare-desktop-final.png)
- Final mobile comparison capture: [compare-mobile-final.png](design/renders/compare-mobile-final.png)

Ranking captures that embedded uncleared development headshots are excluded
from the repository until licensed images are available.

## Comparison

| Fidelity point | Result |
| --- | --- |
| Visual language | Matches the accepted flat, editorial sports-game direction: warm white field, ink borders, navy panels, orange accent, and no gradients, decorative curves, pill controls, shadows, or first-place highlight. |
| Information hierarchy | The logo, task heading, compact progress, centered comparison ledger, and three vote actions retain a direct scan path. Results use one heading, completion state, paginated list, and two actions. |
| Normal comparison | Equal name and full-height contained-portrait blocks sit over equal value columns. Neither side receives visual priority. |
| Blind comparison | Names and image keys are absent from active responses. Player A/B and session-randomized codes preserve the same neutral ledger geometry. |
| Constrained landscape | One compact matrix keeps identity, statistics, and all three vote actions visible without reducing the statistical comparison. |
| Ranking result | Ranks, names, eras, contained portraits, pagination, Share, and Start Over use the accepted composition. The two tablet actions split the bar evenly. |
| Modes | One square-edged dialog offers Top 10, Top 25, or Top 50 and Normal or Blind. A replacement session is created before existing progress is removed. |
| Share image | A deterministic 1080×1350 PNG matches the site style, preserves tie labels, includes exactly the nominal N players, and uses no special treatment for rank 1. |
| Responsive behavior | Automated geometry covers the required phone, landscape, tablet, laptop, and desktop viewport matrix with overlap, clipping, overflow, centering, and action-width assertions. |
| Interaction | Automated coverage includes Help, Methodology, all six mode combinations, Player A, Player B, Tie, Undo, persisted reload, tab conflict, completion, sharing, and Start Over. |
| Copy | No marketing copy was added above the fold. Help and Methodology counts follow the selected mode. |

## Intentional deviations

- The checked-in development catalog has 10 source-documented fixture players,
  not the licensed 100. End-to-end verification generates a deterministic,
  ignored 100-player catalog with the real preset mappings.
- The fixture statistics are frozen through the 2023–24 season. A licensed, reproducible production source must replace them before the 100-player launch.
- Neutral development placeholders are stored locally in the canonical player asset directory. Production image usage and attribution must be resolved before launch.
- The prototype-only preview navigation is not part of the application.

## Verification method

The live React application is exercised against the live FastAPI and SQLite
stack with Playwright and axe. Browser assertions inspect geometry at each
required viewport, and the share test downloads the real PNG and verifies its
signature and 1080×1350 dimensions. Generated normal-mode, Modes-dialog, and
share-image captures are also inspected at original resolution.
