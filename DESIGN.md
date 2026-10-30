# Wheel Raid design system

## Overview

Wheel Raid is a cooperative game for one to four friends, with immediately playable historical practice and a slower live mode. The visual idea is a small illustrated garden arena: tiny hamster adventurers face an oversized mechanical wheel. The art, compact battle controls, and shared HP carry the game; there is no separate marketing landing page.

The implementation uses React, TypeScript and plain CSS. Its reusable styles and tokens live in `src/styles.css`; the page composition is `src/App.tsx`. The original vector scene is `src/Arena.tsx`, and the shared line icons are `src/Icons.tsx`.

## Colors

Canonical CSS values are hexadecimal. Use the semantic custom properties rather than adding a competing palette.

| Token | Value | Implemented role |
| --- | --- | --- |
| `--paper` | `#f5f3eb` | Page and room-control background |
| `--surface` | `#fffef9` | Battle surface, fields and dialogs |
| `--ink` | `#29362c` | Primary text and icons |
| `--muted` | `#647060` | Supporting text, source labels and disabled move text |
| `--line` | `#dcded2` | Structural dividers and battle boundary |
| `--accent` | `#d5ef7f` | Primary action, selected move and brand wheel |
| `--accent-hover` | `#c5df70` | Primary/selected hover treatment |
| `--soft` | `#e9eddd` | Arena caption background |
| `--focus` | `#3c5c2c` | Three-pixel keyboard outline |
| `--warning` | `#7a4525` | Recoverable error text |
| `--error-bg` | `#f8e9df` | Recoverable error surface |

The health component also defines the rendered graphic colors in `.health-track`: track `#e9eadd`, team fill `#6d8848`, boss fill `#566b57`. The SVG illustration has its own muted fur, metal and garden paints; these are art colors, not extra interface themes. Status dots always have a text label; selected moves have a check mark as well as a colored fill.

Measured rendered text pairs in the taste probe: ink/paper **11.40:1**, muted/paper **4.69:1**, ink/accent **9.94:1**. The visual runner confirmed the rendered team/track colors; their WCAG contrast is **3.28:1** (boss/track **4.75:1**). These are identified solid-color pairs, not a claim that every SVG paint or every interaction state was automatically contrast-audited.

There is one deliberate light theme. Dark-mode theming is not implemented.

## Typography

The interface uses the local system stack `Arial, Helvetica, sans-serif`. Weights are **400** and **700**; there are no web-font downloads. Room IDs and source addresses use `ui-monospace, SFMono-Regular, Consolas, monospace`. Monospace is confined to data.

The five implemented size roles are `--xs: .75rem` (12 px at default), `--sm: .875rem` (14), `--body: 1rem` (16), `--section: 1.25rem` (20), and `--title: 1.75rem` (28). Use xs for data/supporting hints, sm for controls and list text, body for active move names and ordinary headings, section for panel headings, and title for the brand, entry headline and final result. No additional display size is used.

Body copy has unitless `1.5` line height. H1 is `1.1`, H2 `1.2`, H3 `1.4`; headings balance their wrapping. H1 tracking is `-.04em`, H2 `-.025em`, the entry headline `-.035em`; prose uses natural spacing. Inputs stay at 16 px on phones to avoid focus zoom. Timers and HP use tabular numbers. Names and addresses wrap instead of being ellipsized. Root text enlargement to 200% was checked separately from native browser zoom.

## Layout

The header and main share a 1280 px maximum outer width. Desktop horizontal padding is 40 px, with a flexible battle column, 340 px room column and 28 px gap. Under 1000 px, outer padding becomes 24 px, the room becomes 290 px, and the gap becomes 24 px. At 760 px the layout becomes one column with 20 px outer padding; under 359 px the padding becomes 16 px.

On phones, entry and lobby room controls appear before the battle so Create/Join and Start are immediately reachable. During battle the arena and move controls come first. The finished battle replaces its disabled moves with Replay. At 390 px, the entry Create button, the lobby Start button with four longest permitted names, and the battle move buttons were measured inside the first screen.

The dominant spacing steps are 8/12 px between controls, 16/20 px within panels, and 24/28/32 px between larger groups. Battle interior padding is 28 px on desktop, 20 px on phones and 14 px on narrow phones. The SVG uses a responsive 840 × 320 viewBox without text clipping. Action buttons use `auto-fit` with an 80 px minimum at the default root size; they naturally stack when text is enlarged. There are no fixed overlays or sticky controls obscuring the game.

Native dialogs have a width of `min(560px, viewport - 32px)` and maximum height `100dvh - 48px`; their contents scroll. The rule/source text stays in that readable-width dialog instead of crowding the first screen. Reflow was checked at 320, 390, 760, 1000 and 1440 px.

## Elevation & Depth

The page is intentionally flat: whitespace groups the room controls, one border defines the arena, and dividers separate the roster and history. No surface combines a border and shadow. The modal uses the browser top layer and a translucent `#29362c80` backdrop. There are no gradients, nested card stacks, or animated page entrances.

## Shapes

The battle has an 18 px radius; dialogs use 16 px; move buttons 10 px; ordinary fields and buttons 8 px. Avatars and the brand wheel are circles. Health tracks use a 3 px radius. Borders communicate control/selection or structural boundaries. Only the illustration and health tracks clip their graphic contents; names, transaction links and required control text remain reachable.

## Components

| Component / pattern | Source | Behavior |
| --- | --- | --- |
| `Icon` | `src/Icons.tsx` | One currentColor SVG set; decorative icons are hidden from assistive technology |
| `Arena` / `Hamster` | `src/Arena.tsx` | Original scalable art, with a static victory pose and party illustration |
| `Health` | `src/App.tsx` | Shared label/number layout and named progressbar; distinct team/boss fills |
| `.primary`, `.secondary`, `.text-button` | `src/styles.css` | One primary fill per active decision; explicit hover, disabled and focus states |
| `.mode-picker` | `src/App.tsx` | Native labeled radio buttons; arrow-key selection and visible label focus |
| `.move` | `src/App.tsx` | Native button locks on selection; selected check mark, `aria-pressed`, and immutable disabled state |
| `Modal` | `src/App.tsx` | Native `dialog.showModal()`, keyboard trapping, Escape, close control and focus return |
| Roster / `.players` | `src/App.tsx` | Real participants, four maximum, full wrapping names, text readiness state |
| Battle log / leaderboard | `src/App.tsx` | Reverse chronological real round evidence, transaction link, clearly scoped room scores |
| `.form-feedback`, `.messages` | `src/App.tsx` | Entry feedback beside the form; recoverable errors with retry/dismiss; polite stable battle announcements |

All primary controls are native elements. Keyboard focus is a 3 px outline offset 4 px. The header's icon-only phone help button has an explicit accessible name. Live errors preserve HP and choices and offer Retry source. Empty history explains which action fills it. Loading direct invites retains a descriptive button label. Leave uses a native confirmation dialog and preserves the local save.

Motion is limited to 120 ms color changes, a 250 ms health-width transition and scale `.96` on press. The width/press motion is enabled only under `prefers-reduced-motion: no-preference`; no animation runs endlessly. Actual reduced-motion rendering was checked.

## Do's and Don'ts

- Reuse the shared alignment edges and type roles before introducing a new size or container.
- Keep the current primary game action above explanatory text on phones. Preserve room-first lobby and battle-first active play ordering.
- Use text and icons along with color for locks, live status and results. Keep names and HP readable at the maximum values.
- Describe archived play as historical practice. Describe the leaderboard as room data. Preserve source-outage and recovery states.
- Add a future panel with the existing section heading, ordinary surface/divider and native controls; keep source details in the rule dialog when they do not help the immediate move.
- Do not add external fonts, runtime art URLs, gratuitous animation, wallet chrome, invented live counters, or global-score claims.

The six-domain review and coverage limitations are recorded in `VALIDATION.md`, with an artifact copy in `artifacts/validation.md`. Guidance attribution and the supplied notices are retained in `THIRD_PARTY_NOTICES.md` and `licenses/design-guidance.txt`.
