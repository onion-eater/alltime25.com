# Center Ledger Comparison Design

## Status

Approved direction, pending written-specification review before implementation.

The accepted visual reference is the
[corrected neutral center-ledger concept](../../design/concepts/center-ledger-neutral-v2.png).
That image establishes the scan pattern, not pixel-exact production spacing.
This specification is authoritative where the image and text differ.

## Objective

Replace the active dual-résumé comparison with one horizontally centered
comparison ledger. The ledger must make anonymous player A and player B equally
easy to scan, preserve neutral presentation, fit the primary experience inside
the viewport, and leave the vote behavior unchanged.

The current dual-card implementation must remain available as inactive
historical reference code in a separate repository folder.

## Scope

This change includes:

- a centered, shared-label comparison ledger for normal viewport shapes;
- a compact, shared-label fallback for very short landscape viewports;
- regular-season and playoff 3PT%;
- an inactive archive of the replaced comparison components;
- responsive, interaction, API-contract, and data-validation coverage;
- architecture documentation and enforcement for the archive boundary.

This change does not include:

- player names or photos during an active comparison;
- leader colors, leader shading, arrows, checkmarks, or winner counts;
- era-adjusted, peak, per-season, or advanced statistics;
- ranking-algorithm or vote-semantics changes;
- player-side randomization;
- new copy, routes, or controls;
- production player-data sourcing.

## Visual and Interaction Design

### Centered shell

The title/progress row, ledger, and vote controls use the same centered content
width. The layout must have equal available space to the left and right of the
ledger at every supported width.

The ledger has an exact vertical center spine. Player A occupies the left value
column, the shared stat label occupies the center column, and player B occupies
the right value column:

```text
PLAYER A VALUE | SHARED STAT LABEL | PLAYER B VALUE
```

The left and right value columns have equal width. Their text aligns toward the
center label column so the eye can compare a pair without traveling across
unrelated content. Stat labels remain centered on the page axis.

### Header

The ledger begins with two equal player headers meeting at the center divider.
Each header shows only:

- player code, `A` or `B`;
- prominent decade.

Each complete player block is horizontally and vertically centered inside its
half. Its center aligns with the center of the corresponding value column
below. The two blocks mirror each other around the page centerline.

Both headers use identical type, spacing, background, and border treatment.
Neither side may receive a visual advantage.

### Sections and rows

The ledger uses four section bands in this order:

1. Career
2. Regular Season
3. Playoffs
4. Honors

Rows within each section are fixed:

| Section | Rows |
| --- | --- |
| Career | Seasons, Reg. Games, Playoff Games |
| Regular Season | PTS, REB, AST, STL, BLK, FG%, 3PT%, FT% |
| Playoffs | PTS, REB, AST, STL, BLK, FG%, 3PT%, FT% |
| Honors | MVP, All-NBA, DPOY, Titles, Finals MVP |

Section bands span all three columns. Rows use a restrained grid and rules
rather than cards. The layout uses square corners, flat colors, and no
decorative shadows or gradients.

Values on both sides use the same font size and weight. The interface does not
indicate which value is larger. This is intentional: visual emphasis must not
preselect a winner for the user or exaggerate incomparable categories such as
games and awards.

### Vote controls

The existing `Better`, `Tie`, and `Worse` outcomes, keyboard behavior, undo,
saved state, and progress behavior remain unchanged. Controls stay immediately
below the ledger within the centered shell and remain visible without page
scrolling on supported viewports.

## Responsive Design

### Normal viewport shapes

Desktop, tablet, and portrait-phone layouts use the same three-column center
ledger. Width, type size, row height, and section-band height reduce through
existing design tokens and component-scoped breakpoints. The stat order and
labels do not change.

The phone layout retains a visible center spine and equal player columns. No
side may collapse above or below the other.

### Very short landscape viewports

A 24-row ledger cannot remain readable alongside the header and controls at
320–390 CSS pixels of viewport height. At `max-height: 480px` with landscape
orientation, the comparison switches to a compact paired matrix:

- player A remains on the left and player B remains on the right;
- each stat still has one shared centered label;
- the same four sections and row order are preserved;
- each section groups related rows into horizontal clusters to reduce height;
- typography and styling remain strictly neutral;
- the vote controls remain visible.

This is the only intentional layout deviation from the vertical ledger. It
exists to satisfy the one-viewport requirement without overlapping or
illegibly compressing rows.

### Viewport invariant

At every supported viewport:

- there is no horizontal page overflow;
- text does not clip or overlap;
- the ledger does not overlap the header, footer, or vote controls;
- all primary comparison content and controls fit in the viewport;
- only the footer may appear below the fold.

## Data Contract

`CareerStats` gains one nullable field:

```text
three_pct: number | null
```

The field follows the existing `fg_pct` and `ft_pct` convention. It is included
in both regular-season and playoff career-stat objects.

The API exposes `three_pct` for each anonymous active-comparison résumé. It does
not expose player identity. OpenAPI remains the canonical frontend contract and
the generated TypeScript types must be regenerated after the Pydantic schema
changes.

The development catalog adds `three_pct` to every regular-season and playoff
stat object. A genuinely unavailable value is stored as `null`, never zero.
Development-fixture values remain subject to the existing production-source
verification policy.

Percentages render to one decimal place with a percent sign, matching FG% and
FT%. A missing value renders as an em dash.

## Frontend Structure

`CompareScreen.tsx` remains the screen-level owner of heading, progress,
comparison orchestration, and vote controls.

The active comparison display becomes:

```text
features/ranking/components/
└── CenterComparisonLedger.tsx

features/ranking/styles/
└── CenterComparisonLedger.module.css
```

`CenterComparisonLedger` renders both the normal ledger and the short-landscape
presentation from the same stat-definition data. It must not duplicate arrays
of stat labels or accessors between responsive variants.

`statDefinitions.ts` remains the canonical definition of displayed statistics
and gains the two 3PT% entries through its regular-season and playoff groups.
Stat formatting remains centralized there.

Once the replacement is verified, the active
`DesktopResumeCard` and `MobileComparisonTable` components and their style
modules are removed from `apps/web`. They must not remain as unused active
source.

## Inactive Code Archive

The exact pre-replacement source from commit `9ec3c15` is stored under:

```text
archive/comparison-layouts/dual-resume-v1/
├── README.md
├── CompareScreen.tsx
├── CompareScreen.module.css
├── DesktopResumeCard.tsx
├── DesktopResumeCard.module.css
├── MobileComparisonTable.tsx
├── MobileComparisonTable.module.css
└── statDefinitions.ts
```

The archive README records:

- source commit `9ec3c15`;
- the original active paths;
- that the files are historical reference only;
- that active application code may not import them.

The top-level `archive/` directory is outside `apps/`, TypeScript compilation,
lint input, and production bundles. `docs/architecture.md` adds `archive/` as
the one canonical location for inactive code. The architecture check rejects
imports from an active application into `archive/`.

## Data Flow

1. The Python catalog validates both regular-season and playoff `three_pct`.
2. The ranking service continues to produce the same anonymous comparison.
3. The API serializer includes `three_pct` in each career-stat object.
4. Generated TypeScript types carry the field into the ranking feature.
5. `CompareScreen` passes both anonymous résumés to
   `CenterComparisonLedger`.
6. The ledger reads the canonical stat definitions and renders the appropriate
   responsive arrangement.
7. Voting sends the same `better`, `tie`, or `worse` value as before.

No comparison or ranking decision moves into React.

## Missing and Invalid Data

- `null` 3PT% renders as `—`.
- `0` is a valid measured percentage and renders as `0.0%`.
- Percentages below zero or above 100 are rejected by catalog validation.
- A missing `three_pct` key is rejected so newly added catalog records cannot
  silently omit the field.
- Existing API failure, retry, and undo behavior remains unchanged.

## Verification

### Backend

- Domain and catalog tests accept nullable `three_pct`.
- Catalog tests reject a missing field and values outside `0–100`.
- API integration tests verify that both anonymous résumés expose regular and
  playoff `three_pct`.
- API tests continue to verify that active comparisons reveal no player
  identity.
- OpenAPI export and generated frontend contracts match.

### Frontend

- Component tests verify all four sections and their fixed order.
- Component tests verify that 3PT% appears once in Regular Season and once in
  Playoffs.
- Component tests verify that a null percentage renders as `—`.
- Existing vote and undo tests continue to pass without changed outcome
  mapping.
- The archive is not imported by active code.

### Browser

The live React-to-FastAPI hookup is exercised at:

- 320×568
- 360×640
- 375×667
- 390×844
- 430×932
- 568×320
- 700×900
- 701×900
- 768×600
- 768×1024
- 844×390
- 1024×600
- 1024×768
- 1280×720
- 1366×768
- 1440×900
- 1536×864
- 1920×1080

Each viewport is checked for overflow, clipping, overlap, center alignment, and
visible vote controls. One vote, one tie, and undo are exercised through the
live API.

### Repository checks

The complete backend test suite, Ruff, frontend type check, ESLint, Vitest,
production build, generated-contract check, and architecture check must pass.

## Acceptance Criteria

The change is complete when:

- the active comparison is a visually centered shared-label ledger;
- A and B have exactly equal visual treatment;
- Regular Season and Playoffs both show 3PT%;
- all required comparison content fits without overlap at every listed
  viewport;
- the short-landscape fallback activates only for the specified constrained
  shape;
- vote, tie, undo, progress, anonymity, and ranking behavior are unchanged;
- the replaced UI source is preserved only in the documented inactive archive;
- no active code imports or builds the archive;
- all verification checks pass.
