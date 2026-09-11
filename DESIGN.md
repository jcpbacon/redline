---
name: Redline
description: A printed agreement on a teal laminate table, with highlighter strokes and plastic index tabs; the tab is the flag.
colors:
  paper: "#ffffff"
  paper-shade: "#f3f2ee"
  ink: "#161616"
  ink-soft: "#4a4a4a"
  table: "#2b7a78"
  table-deep: "#1f5d5b"
  rank-1: "#ff5a36"
  rank-2: "#ff9a3c"
  rank-3: "#ffe63b"
  card-rule: "#b9d3e6"
  card-margin: "#e0687a"
typography:
  display:
    fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "28px"
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 86"
  title:
    fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 84"
  action:
    fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 88"
  body:
    fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontVariation: "'wdth' 100"
  body-compact:
    fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, 'Arial Narrow', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 90"
  contract:
    fontFamily: "'Times New Roman', Times, 'Nimbus Roman', serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  contract-title:
    fontFamily: "'Times New Roman', Times, 'Nimbus Roman', serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  none: "0"
  stamp: "3px"
  tab: "7px"
  scrollbar: "8px"
spacing:
  clause: "14px"
  card-rule-pitch: "28px"
  tab-gutter: "16px"
  tab-inset: "22px"
  paper-inline: "56px"
  paper-top: "88px"
  sheet-heading-gap: "40px"
components:
  index-tab-rank-1:
    backgroundColor: "{colors.rank-1}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.tab}"
    padding: "12px 16px 13px 22px"
    width: "262px"
  index-tab-rank-2:
    backgroundColor: "{colors.rank-2}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.tab}"
    padding: "12px 16px 13px 22px"
    width: "262px"
  index-tab-rank-3:
    backgroundColor: "{colors.rank-3}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.tab}"
    padding: "12px 16px 13px 22px"
    width: "262px"
  index-tab-body:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.tab}"
    padding: "14px 16px 14px 22px"
  action-tab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.tab}"
    padding: "18px 26px 19px 26px"
  action-tab-hover:
    backgroundColor: "#000000"
    textColor: "{colors.paper}"
  highlighter-rank-1:
    backgroundColor: "rgba(255, 90, 54, 0.62)"
    textColor: "{colors.ink}"
    padding: "0.08em 0.34em 0.06em 0.26em"
  highlighter-rank-2:
    backgroundColor: "rgba(255, 154, 60, 0.7)"
    textColor: "{colors.ink}"
    padding: "0.08em 0.34em 0.06em 0.26em"
  highlighter-rank-3:
    backgroundColor: "rgba(255, 230, 59, 0.82)"
    textColor: "{colors.ink}"
    padding: "0.08em 0.34em 0.06em 0.26em"
  index-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.none}"
    padding: "18px 20px 22px 34px"
    width: "340px"
  paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.contract}"
    rounded: "{rounded.none}"
    padding: "88px 56px 72px"
    width: "780px"
  stamp:
    backgroundColor: "transparent"
    textColor: "rgba(70, 70, 70, 0.75)"
    rounded: "{rounded.stamp}"
    padding: "4px 10px 6px"
---

# Design System: Redline

## Overview

**Creative North Star: "The Tabbed Contract"**

Redline's world is a real object, not an interface: a printed agreement lying on a saturated teal laminate kitchen table, three sentences struck with highlighter, three plastic index tabs stuck to the paper's right edge pointing at them. The tab is the flag. Everything the product does (find the sentence, name the danger, rank it) is already legible in the physical arrangement before a word of interface copy is read. The composition refuses the category layout (headline, subhead, button, screenshot, feature tiles) and instead lets the artifact make the argument.

Two registers share one sheet. The Document speaks in its own face, Times New Roman, justified and hyphenated the way a contract prints. Redline speaks in Archivo: condensed, 800-weight, uppercase on tabs, headings, the wordmark and the action; regular width and weight for statements. Rank is carried by size (the 1st tab's heading is set larger), by color (red-orange, orange, yellow), and always by a word (the ordinal), so no reader depends on color alone. Density is that of a page, not a dashboard; whitespace is paper margin, not padding.

Materials are honest to the metaphor: paper casts a soft shadow onto the table; highlighter is translucent and multiplies into the type; tabs carry a plastic sheen, a dark spine where they meet the page, and their own cast shadow. The build confirms these visual rejections: no cards-on-cards, no icon tiles, no decorative gradients (every gradient in the build is a material: table light, tab sheen, card rules), no browser-frame screenshots, no named severity levels.

**Key Characteristics:**
- One physical scene (table, paper, card, tabs) rather than a layout of panels.
- Two typefaces with strictly separated jobs: Times New Roman for the Document, Archivo for Redline.
- Rank is triply carried: type size, rank color, and an ordinal word.
- Materials with real optics: multiply-blended highlighter, sheened plastic tabs, offset paper shadows.
- One authored motion sequence on load ("the pull"), fully disabled under reduced motion.
- Black, not a brand color, is the action.

## Colors

Office-paper white and near-black ink on a saturated teal field, with three highlighter/tab colors reserved for rank and two ruling colors that exist only on the index card.

### Primary
- **Laminate Teal** (`table`): The table itself, full-bleed behind everything on the landing surface; also the `body` background. Carries a faint radial light fall from the top-left (`rgba(255,255,255,0.12)` to transparent at 60%), which is material, not decoration.
- **Deep Laminate** (`table-deep`): The scrollbar thumb and `scrollbar-color`. Not used on any surface element yet; reserved as the darker shade of the table.

### Secondary (rank)
- **Rank 1 Red-Orange** (`rank-1`): The most severe Flag. Solid on the 1st index tab; at 62% alpha for its highlighter stroke.
- **Rank 2 Orange** (`rank-2`): The 2nd index tab; at 70% alpha for its stroke.
- **Rank 3 Highlighter Yellow** (`rank-3`): The 3rd index tab; at 82% alpha for its stroke. Also the text-selection color, so selecting text on any page reads as highlighting it.

### Tertiary (ruling)
- **Card Rule Blue** (`card-rule`): The 1px horizontal rules on the index card, repeating every 28px.
- **Card Margin Red** (`card-margin`): The single 1px vertical margin line on the index card, 22px from its left edge.

### Neutral
- **Paper** (`paper`): The Document page, the index card, the tab body, the second sheet, and the action tab's text.
- **Paper Shade** (`paper-shade`): The scrollbar track. Not used on any surface yet; the only off-white in the system.
- **Ink** (`ink`): All running text, the action tab's fill, the focus ring, the `:target` outline.
- **Soft Ink** (`ink-soft`): Secondary text: the signature lines on the paper and the meta line inside an open tab.
- **Stamp Grey** (`rgba(70, 70, 70, 0.55)` border, `rgba(70, 70, 70, 0.75)` text): The SAMPLE stamp only, multiplied into the paper so it reads as rubber-stamped rather than printed.

### Named Rules
**The Rank-Only Rule.** Red-orange, orange and yellow exist to say "1st, 2nd, 3rd". They never decorate, never mark a button, never signal success or a link. If it isn't a Flag or its Source Sentence, it isn't a rank color.

**The Word-With-Color Rule.** Rank is never carried by color alone. Every rank color sits beside its ordinal ("1ST", "2ND", "3RD") and, on the open tab, a sentence ("Ranked 1st of 3 by how badly it can hurt you.").

**The Black Action Rule.** The one action is ink-black paper-white, never a brand color. Hover deepens it to pure black (`#000`); it never gets a rank color.

**The Multiply Rule.** Anything that sits on paper as a mark (highlighter, stamp) uses `mix-blend-mode: multiply` so the type stays fully legible beneath it. Highlighter colors are rank colors at partial alpha, never opaque.

## Typography

**Display Font:** Archivo, variable, `wdth` axis loaded (with Arial Narrow, Arial, sans-serif). Exposed as `--voice`.
**Body Font:** Archivo at 100% width (same stack).
**Contract Font:** Times New Roman (with Times, Nimbus Roman, serif). Exposed as `--contract`.

**Character:** Two voices on one desk. Times New Roman is the contract's own voice: justified, hyphenated, bold clause titles, a letterspaced uppercase title. Archivo is Redline's: compressed to 84–90% width at 800 weight for anything that shouts (tab, heading, wordmark, action), stretched to 125% for the wordmark, and left at normal width and 400 weight for anything that explains.

### Hierarchy
- **Display / Wordmark** (800, 30px, 28px line, `wdth` 125, -0.02em, uppercase): "REDLINE" on the index card only. The 28px line height matches the card's rule pitch so the wordmark sits on a rule.
- **Headline / Sheet heading** (800, 28px → 24px at ≤760, line 1, `wdth` 86, -0.01em, uppercase): Section headings on the second sheet, 40px above and 6px below.
- **Title / Tab heading** (800, 19px, line 1.02, `wdth` 84, -0.005em, uppercase, balanced): The plain-English heading on an index tab. The 1st-rank tab sets it at 24px (21px at ≤760). Size is billing.
- **Action** (800, 20px, line 1, `wdth` 88, 0.01em, uppercase): The black action tab, both instances.
- **Label / Rank ordinal** (800, 13px, line 1, `wdth` 90, 0.06em, uppercase): "1ST / 2ND / 3RD" on the tab face, baseline-aligned to the heading.
- **Stamp** (800, 15px → 12px, `wdth` 110, 0.14em, uppercase) with a note line (500, 11.5px, 0.04em, no transform): The SAMPLE stamp only.
- **Body / Statement** (400, 18px → 17px at ≤760, line 1.5, max 62ch): Second-sheet prose.
- **Body compact** (400, 15px, line 1.4): Tab meaning; the index-card hook uses 15px on a 28px line to sit on the card's rules.
- **Meta** (400, 13px, line 1.4, soft ink): "Ranked 2nd of 3…" line inside an open tab, with an underlined link (1.5px thickness, 3px offset).
- **Contract body** (Times, 400, 16.5px → 15px at ≤760, line 1.5, justified with `hyphens: auto` on desktop, left-aligned unhyphenated at ≤760): Every Document sentence, including every Source Sentence.
- **Contract title** (Times, 700, 19px → 16px, 0.08em, uppercase, centered): The agreement's title.
- **Contract clause title** (Times, 700, inline): "3. License." run in at the head of its paragraph.

### Named Rules
**The Two Voices Rule.** Every Document word, including every Source Sentence wherever it is quoted, is Times New Roman. Every Redline word is Archivo. Nothing is set in both, and no third face is introduced.

**The Compressed Shout Rule.** Uppercase Archivo is always 800 weight and always narrowed (84–90% width); Archivo at normal width is always mixed case and never shouts. The wordmark is the single wide (125%) exception.

**The Size Is Billing Rule.** Rank order is visible in type scale before color is read: the 1st tab's heading is one step larger than the others.

## Layout

The landing surface is a desk, not a grid of sections. On desktop the `desk` is a centered two-column grid: a paper column of `minmax(0, 780px)` and a 290px tab column, with `clamp(140px, 12vw, 180px)` of table above the paper (room for the index card) and 96px below. The paper is rotated -1.2° about a point 40% across and 30% down so its top-right corner drops slightly; the index card sits absolutely at the top-left of the table (`top clamp(20px, 3vw, 40px)`, `left clamp(16px, 3vw, 44px)`, width `min(340px, 100% - 32px)`), rotated +1.6° against it. Tabs are absolutely positioned on each flagged clause, `top: 0` of the clause, their left edge at the paper's right padding edge minus 34px so they overlap the page by 34px and protrude 228px past it. The black action tab sits at `right: -228px; bottom: 54px` of the paper, below the ranked run. The second sheet is a full-width paper band with a 62ch column, 64px top and 88px bottom padding.

Paper interior: 88px top / 56px sides / 72px bottom on desktop; clauses separated by 14px paragraph margins; signature line 34px below the last clause. Tab interior: 22px left inset (clearing the 3px spine), 16px right, 12/13px vertical on the face; the body repeats the 22/16 insets with 14px top and 14px bottom.

Responsive:
- **≤1080px**: single column (`minmax(0, 1fr)`), paper padding 56/32/64, tabs 210px wide overlapping the page by 30px, action at `right: -170px`. Tabs still protrude off the page's right edge.
- **≤760px**: the index card enters flow at the top of the table (`margin: 20px 16px 0`, rotated -1°); the desk becomes a block with 28px/12px padding; paper padding 44/18/28, body 15px, rotation -0.6°, clause text left-aligned and unhyphenated. Each tab becomes a block in flow directly under its sentence, `calc(100% + 14px)` wide with `margin: -4px -14px 18px 0`, so it still pokes 14px past the paper's right edge and nowhere else. The action does the same, full width, centered text, 28px above. Sheet body 17px, headings 24px, 48px top padding.

The page overflow is clipped horizontally (`overflow-x: clip`) so protruding tabs never create a scrollbar.

## Elevation & Depth

Depth is physical: things lie on the table or on the paper and cast shadows downward onto whatever is beneath them. Shadows are soft, dual-layer (one long low-alpha cast, one tight contact shadow), never hard-offset, never colored. Tabs add a 3px inset spine on their left edge so they read as stuck to the page; the second sheet casts its shadow upward onto the table it emerges from beneath. Opacity is also used as depth: when one tab is engaged the other strokes fall to 30%.

### Shadow Vocabulary
- **Paper on table** (`box-shadow: 0 26px 48px -18px rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.18)`): The Document page.
- **Card on table** (`box-shadow: 0 14px 28px -10px rgba(0,0,0,0.45), 0 2px 5px rgba(0,0,0,0.18)`): The index card; shorter cast than the page because it is smaller.
- **Tab on paper** (`box-shadow: 0 10px 18px -8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.25), inset 3px 0 0 rgba(0,0,0,0.14)`): Index tab face; the inset is the dark spine. The open tab body carries the first layer only.
- **Action on table** (`box-shadow: 0 12px 22px -8px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.3), inset 3px 0 0 rgba(255,255,255,0.18)`): The black tab at the paper's edge; a light spine instead of a dark one because the tab is black.
- **Action on paper** (`box-shadow: 0 12px 22px -8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.2)`): The same tab on the second sheet; lighter because it casts onto white.
- **Sheet from beneath** (`box-shadow: 0 -22px 44px -24px rgba(0,0,0,0.5)`): The second sheet's upward shadow onto the table.

### Named Rules
**The Cast Shadow Rule.** A shadow is always the object above darkening the surface below: two layers, straight down, black at partial alpha, blurred. No hard offsets, no colored glows, no shadows as borders.

**The Spine Rule.** A tab meets the page with a 3px inset spine (dark on colored tabs, light on the black one). That spine is what makes it a tab and not a button.

## Shapes

Rectangles with one rounded edge. Paper and the index card are sharp-cornered rectangles, slightly rotated (paper -1.2°, card +1.6°, stamp -7°). Index tabs and the action tab are square where they meet the page and rounded on the outer edge (`0 7px 7px 0`), the open tab body continuing with `0 0 7px 0`. The stamp is a 2px bordered box with 3px corners. Highlighter strokes are irregular blobs: asymmetric elliptical corners (`0.9em 0.25em 0.7em 0.2em / 0.5em 0.3em 0.45em 0.25em`), negative horizontal margins so the stroke overruns the word, `box-decoration-break: clone` so each wrapped line gets its own stroke ends, and a 2.5% fade at either end. There are no pill shapes, no circles, no cards with rounded corners.

## Components

### Index Tab (signature)
A plastic index tab stuck to the paper's right edge at the height of its Source Sentence. It is the Flag.
- **Shape:** 262px wide (210px at ≤1080, full width plus 14px at ≤760); face rounded on the outer edge only (7px).
- **Face:** rank color fill under a sheen gradient (white 42% at top to transparent at 46% to black 6% at bottom); ink text; a two-column grid with the ordinal label at left and the heading at right, baseline-aligned, 4px/12px gaps; padding 12/16/13/22.
- **Body:** paper-white, collapsible via `grid-template-rows: 0fr → 1fr` (360ms), rounded bottom-right; holds the meaning (15px/1.4) and a soft-ink meta line with a link to the sentence's anchor.
- **States:** hover, focus-within, or `[data-open]` slides the whole tab 10px right (6px at ≤760) over 320ms, raises it to z-index 4, opens the body, and dims every other highlighter stroke on the page to 30% (260ms). Focus ring is the global 3px ink outline offset 3px.
- **Semantics:** the face is a `<button aria-expanded aria-controls>`; the body is a plain `div`, never `display: none`.
- **Motion:** slides in from 36px left of rest with opacity 0 → 1 over 560ms, `backwards` fill, delayed 1400 / 1560 / 1720ms by rank.

### Highlighter Mark (signature)
A translucent highlighter stroke over exactly one Source Sentence, in that Flag's rank color.
- **Style:** a `<mark id>` carrying `data-rank`; background is a horizontal gradient of the stroke color fading over the first and last 2.5%; multiply-blended; irregular rounded ends; 0.08em/0.06em vertical and 0.34em/0.26em horizontal padding with matching negative margins.
- **Colors:** rank-1 at 62%, rank-2 at 70%, rank-3 at 82% alpha (yellow needs more opacity to read on white).
- **States:** dims to 30% when another tab is engaged; `:target` (after following a tab's link) gets a 2px dashed ink outline offset 2px.
- **Motion:** draws left-to-right via `background-size: 0% → 100%` over 620ms, delayed 200 / 480 / 760ms by rank.

### Action Tab
The one action, as a black tab at the paper's lower-right edge and again at the end of the second sheet.
- **Shape:** rounded outer edge only (7px).
- **Primary:** ink fill, paper text, Action type (800 / 20px / 88% width / uppercase); padding 18/26/19/26 on the paper edge, 18/28/19 on the sheet.
- **Hover:** background to `#000`, slides 8px right (320ms). **Active:** 4px right.
- **Motion:** the paper-edge instance slides in at 1900ms, after the last tab. The sheet instance does not animate.
- No secondary, ghost or tertiary button exists in the build.

### Index Card
A ruled white card on the table carrying the wordmark and the one-line hook.
- **Background:** paper with a 1px card-rule line every 28px (offset 14px so the wordmark sits on a rule) and a 1px card-margin line 22px from the left; text starts at 34px.
- **Shadow:** card-on-table.
- **Rotation:** +1.6° (−1° at ≤760, where it enters flow).
- **Type:** wordmark (Display) then the hook at 15px on a 28px line so each line rests on a rule.
- **Motion:** settles (18px rise, opacity, rotates in from 0°) over 700ms.

### Paper
The Document, set in the contract's own face.
- **Background:** paper; **shadow:** paper-on-table; rotation −1.2°.
- **Padding:** 88/56/72 desktop, 44/18/28 at ≤760.
- **Contents:** centered uppercase Times title, justified hyphenated clauses with bold run-in numbers and titles, a soft-ink signature row, one Highlighter Mark per flagged sentence, one Index Tab per flag, the Action Tab.
- **Stamp:** the SAMPLE stamp, absolutely at top 24px / right 30px (12/14 at ≤760), rotated −7°, multiplied, grey 2px border with 3px corners; Archivo 800 at 110% width with a 500-weight note line.
- **Motion:** settles over 900ms after an 80ms delay.

### Second Sheet
A full-width plain paper band under the table for statements.
- **Background:** paper; **shadow:** upward onto the table.
- **Column:** 62ch centered, 64px/88px vertical padding, `clamp(20px, 5vw, 48px)` sides.
- **Type:** Headline sheet headings; 18px/1.5 Archivo body paragraphs with 8px between them; ends with the Action Tab 44px below.

### Browser surfaces
- **Selection:** rank-3 yellow background, ink text.
- **Focus:** 3px solid ink outline, 3px offset, on every `:focus-visible`.
- **Scrollbar:** 12px; deep-laminate thumb with a 3px paper-shade border and 8px radius on a paper-shade track; `color-scheme: light`.

### Motion (system-wide)
One authored load sequence, "the pull": card and paper settle (700 / 900ms, `cubic-bezier(0.16, 1, 0.3, 1)`), strokes draw in rank order (200 / 480 / 760ms, 620ms each, `cubic-bezier(0.22, 1, 0.36, 1)`), tabs slide in (1400 / 1560 / 1720ms, 560ms each), the action follows at 1900ms. All entrance animations use `backwards`/`both` fill so nothing flashes at rest position first. Interaction transitions are 320ms for slides, 360ms for the body reveal, 260ms for stroke dimming, 160ms for color. Under `prefers-reduced-motion: reduce` every animation and transition on card, paper, mark, tab, body and action is removed; everything renders in its final state and the tab opens instantly.

**Carry-over guidance (not built).** The app-shell brief intends the same world in Operate mode: the teal field recedes to a border and gutters, paper owns the working area, tabs become the Flag list's own component, inputs are ruled lines on paper, buttons are black tabs, the question box is a ruled index card. None of that exists in code; treat it as direction, and document it only once it ships.

### Not built
No inputs, fields, navigation, chips or dialogs exist yet. Do not infer their styling from this file; the brief above gives the intended direction, and the first built instance should be documented here when it lands.

## Do's and Don'ts

### Do:
- **Do** set every Document word and every Source Sentence in Times New Roman, justified and hyphenated on desktop, left-aligned at ≤760px (The Two Voices Rule).
- **Do** carry rank three ways at once: type size, rank color, and the ordinal word (The Word-With-Color Rule, The Size Is Billing Rule).
- **Do** give every mark on paper `mix-blend-mode: multiply` and use rank colors at partial alpha (.62 / .70 / .82) for highlighter strokes (The Multiply Rule).
- **Do** build shadows as two straight-down black layers, one long and diffuse plus one tight contact shadow, scaled to the object's size (The Cast Shadow Rule).
- **Do** give tabs a 3px inset spine on the page edge and round only the outer edge (7px) (The Spine Rule).
- **Do** make the action a black tab with paper text; hover to `#000` and slide 8px (The Black Action Rule).
- **Do** keep uppercase Archivo at 800 weight and 84–90% width; keep normal-width Archivo mixed-case (The Compressed Shout Rule).
- **Do** keep the ruled index card's text on its rules: 28px line height, 14px rule offset, text inset 34px past the 22px margin line.
- **Do** disable every entrance animation and interaction transition under `prefers-reduced-motion: reduce` and render the final state.
- **Do** keep interactive tab bodies in the DOM (collapsed via `grid-template-rows`), with `aria-expanded` and `aria-controls` on the face.

### Don't:
- **Don't** use a rank color for anything that is not a Flag or its Source Sentence (The Rank-Only Rule).
- **Don't** name a severity level. Rank is an ordinal ("1st of 3") until the product decides level names.
- **Don't** add cards-on-cards, icon tiles, browser-frame screenshots or feature grids; the desk is the layout.
- **Don't** add a decorative gradient. Gradients in this world are materials only: the table's light fall, the tab's sheen, the card's ruling.
- **Don't** use hard-offset, colored, or border-like shadows.
- **Don't** introduce a third typeface, a display face for Redline copy, or Times New Roman for anything Redline says.
- **Don't** round the page, the card, or the page-side edge of any tab; the only radii are the tab's outer edge (7px), the stamp (3px) and the scrollbar thumb.
- **Don't** let protruding tabs create horizontal scroll; the table clips overflow-x.
