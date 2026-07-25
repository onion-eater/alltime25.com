# Fidelity ledger

Date: 2026-07-24

## Reference

- Accepted mobile comparison concept: [compare-mobile-v5.png](design/concepts/compare-mobile-v5.png)
- Design source: [design-v5.html](design/source/design-v5.html)
- Final desktop comparison capture: [compare-desktop-final.png](design/renders/compare-desktop-final.png)
- Final mobile comparison capture: [compare-mobile-final.png](design/renders/compare-mobile-final.png)

The references preserve the approved visual direction. Current behavior is
defined by the React application and browser tests.

## Comparison

| Fidelity point | Result |
| --- | --- |
| Visual language | Matches the accepted flat, editorial sports-game direction: warm white field, ink borders, navy panels, orange accent, and no gradients, decorative curves, pill controls, shadows, or first-place highlight. |
| Information hierarchy | The logo, task heading, compact progress, centered comparison ledger, and three vote actions retain a direct scan path. Results use one heading, completion state, one scrollable list, and two actions. |
| Normal comparison | Equal name and full-height contained-portrait blocks sit over equal value columns. Neither side receives visual priority. |
| Blind comparison | Names and image keys are absent from active responses. Player A/B and session-randomized codes preserve the same neutral ledger geometry. |
| Constrained landscape | One compact matrix keeps identity, statistics, and all three vote actions visible without reducing the statistical comparison. |
| Ranking result | Ranks, names, eras, contained portraits, scrolling, Share, and Start Over use the accepted composition. The two tablet actions split the bar evenly. |
| Restart | One square-edged dialog defaults to Top 25 / Normal and offers Top 10, Top 25, or Top 50 with Normal or Blind. A replacement session is created before existing progress is removed. |
| Share image | A deterministic, text-only 1080×1350 PNG matches the site style, preserves tie labels, includes exactly the nominal N players, uses the `ALLTIME 25 .COM` mark, and gives rank 1 no special treatment. |
| Responsive behavior | Automated geometry covers the required phone, landscape, tablet, laptop, and desktop viewport matrix with overlap, clipping, overflow, centering, and action-width assertions. |
| Interaction | Automated coverage includes Help, Restart, Ranking preview, all six mode combinations, Player A, Player B, Tie, Undo, persisted reload, tab conflict, completion, sharing, and Start Over. |
| Copy | No marketing copy was added above the fold. Help follows the selected identity mode. |

## Intentional deviations

- The immutable 10-player development catalog remains only as a test fixture.
- End-to-end verification generates a separate deterministic 100-player catalog
  with the real preset mappings.
- The editable design prototype is historical and may include superseded
  interactions; it is excluded from the application build.

## Verification method

The live React application is exercised against FastAPI with Playwright and
axe. Browser assertions inspect geometry at each required viewport, and the
share test downloads the real PNG and verifies its signature and 1080×1350
dimensions. PostgreSQL integration tests separately verify transactional
session behavior.
