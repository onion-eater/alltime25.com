# Fidelity ledger

Date: 2026-07-23

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
| Visual language | Matches the accepted flat, editorial sports-game direction: warm white field, ink borders, navy panels, orange accent, yellow result highlight, and no gradients, decorative curves, or pill controls. |
| Information hierarchy | The logo, single task heading, compact progress, comparison data, and three vote actions retain the accepted order. Ranking results retain the heading, completion state, list, and actions. |
| Desktop comparison | Two bordered player cards use the accepted side-by-side layout, centered VS marker, compact stat grid, fixed bottom vote bar, and visible progress rail. |
| Mobile comparison | The cards collapse into one shared-label comparison table. Both values remain visible in every row without duplicating labels, and the vote bar remains fully visible. |
| Ranking result | Revealed player-image placeholders, ranks, names, eras, pagination strip, and result actions match the accepted composition. |
| Responsive behavior | Verified at 1440 × 900 and 390 × 844. There is no horizontal overflow. At both sizes, `main` ends at the viewport edge and the 70 px footer starts immediately below it. |
| Interaction | Verified first-run help, help reopen, Player A, Player B, Tie, Undo, persisted reload, completion, revealed names/image placeholders, review, share, export, and start over. |
| Copy | No marketing copy was added above the fold. Labels are the accepted short forms. `Top 10`, `10 / 10`, and `1 / 10` are generated from the ten-player development fixture instead of falsely claiming the production 100-player pool is present. |

## Intentional deviations

- The development catalog has 10 source-documented fixture players, not the final 100. The UI derives all totals from the catalog so it cannot misrepresent the available pool.
- The fixture statistics are frozen through the 2023–24 season. A licensed, reproducible production source must replace them before the 100-player launch.
- Neutral development placeholders are stored locally in the canonical player asset directory. Production image usage and attribution must be resolved before launch.
- The prototype-only preview navigation is not part of the application.

## Verification method

The live React application was exercised against the live FastAPI and SQLite stack in the in-app browser. Its screenshot surface produced scaled mobile pixels, so Chrome DevTools Protocol was used only for accurate final pixel captures. The accepted concepts and final renders were then inspected at original resolution.
