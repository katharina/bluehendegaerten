# Blühende Gärten — Dev Guidelines

## CSS Philosophy

We are building a clean design system from scratch. The old style.css was discarded; backup is in `backup/`.

### Semantic classes carry identity, not size

A class like `.botanical-name` defines what something *is* — italic, serif font — not how big it is in any given context. Size and spacing are set by the parent context.

```css
/* base identity — always applied */
.botanical-name {
  font-family: var(--font-serif);
  font-style: italic;
}

/* size adapts to context */
.carousel-card-meta .botanical-name { font-size: var(--hb-font-size-02); }
.plant-modal .botanical-name         { font-size: var(--hb-font-size-06); }
```

The same principle applies to `.observation-place`, `.observation-date`, and any other semantic classes we add.

### Rules

- No inline styles in HTML — ever.
- No `style="..."` attributes. All styling goes in CSS files.
- Use `--hb-*` tokens for all sizes, spacing, colors, and radii (defined in `globals.css`).
- Scope child selectors to their container: `.carousel-card-meta .botanical-name`, not a flat `.botanical-name` with overrides.
- IDs are for JavaScript hooks only, not styling.
- Class names describe what a thing *is* (`.botanical-name`, `.observation-date`), not what it looks like (`.italic-small`, `.grey-text`).

### File structure

- `globals.css` — design tokens, Tailwind bridge, theme variables
- `style.css` — all component and layout styles
- `index.html` — structure only, no inline styles

## Scroll breadcrumb pattern

As the user scrolls deeper into content, compact identity badges stack up in a fixed row at the top-left. Each level of title scrolling away adds one more black rectangle to the bar.

- **Homepage** — nothing fixed at start; BG square fades in when the h1 "Blühende Gärten" scrolls out of view. Tapping it scrolls back to top.
- **Garden page** — BG square is always visible (you're already one level in, coming from home). Garden name badge appears beside it when the garden h1 scrolls away.
- **Plant section on garden page** (not yet built) — when the plant section header sticks, a third rectangle joins: `[BG] [Garden name] [X plants]`.

### Rules for this pattern

- A level's badge appears via `is-visible` on an IntersectionObserver watching that level's in-flow title element.
- `visibility: hidden` — never `display: none` — when hiding a stuck header's label text. This preserves layout height so nothing jumps.
- The fixed container (`.highlight-header-fixed`, `.garden-header-fixed`) is a flex row with `gap: 2px`. Each badge is a sibling, not a child of the previous badge.
- Each black rectangle uses the same base token values (`padding: var(--hb-space-300)`, `background: #000`, `color: #fff`).
- Every badge must be the same height as `.hamburger`. Both share `padding: var(--hb-space-300)`, so text badges must set `line-height: var(--hb-badge-line-height)` (defined at `:root` in `style.css`) instead of `line-height: 1` — `1` at 16px font renders taller than the hamburger's icon content and breaks the alignment. Any new badge added to the bar reuses this same token; don't hardcode a px value.

## Rules — check before every commit

### Display rules

- **Garden obs always show garden name.** If `obs.garden` is set, display the garden name — never `obs.place`, never a geocoded string. Everywhere: obs cards, modal, list view, edit form. Pattern: `gardenMap.get(obs.garden) || obs.place || ''`. Garden wins. No exceptions.

### Location rules

- **Upload: never prefill location.** When a file is picked from the gallery (`isCam === false`) and has no EXIF GPS, always show an empty search field. Never use the last saved location. Clear `_lat/_lon/_place` before calling `_showLocationSearch()`.
- **Camera: use last saved location as fallback.** When a camera shot has no EXIF GPS, it's fine to prefill from `_loadLastLocation()` — the user is likely still in the same spot.
- **Last location is saved on submit only**, never on form open or file pick.
- Location display only appears after a file is picked — never on form open.

### HTML rules

- HTML must be lean and structural — no presentational markup, no redundant wrappers.
- Class names must be semantic and reusable: they describe what something *is* (`.observation-place`, `.loc-pill`), not where it sits or what it looks like right now.
- Every class should be defined once in `style.css` and reused across contexts. Never create a class for a single one-off use — find or extend an existing one.

## Work in progress — homepage plant list sticky header (2026-07-09)

### What's done
- `.plant-sticky-header` is `position: sticky; top: 0` inside `.homepage-sidebar`
- `#plants-section` has `min-height: calc(100svh + 300px)` to keep the sticky locked (do not remove)
- `align-content: start` on `#plant-list` prevents cards from stretching into the min-height space
- On filter input, `scrollIntoView({ block: 'start' })` on `#plants-section` resets scroll so first card is visible below the header
- Plant list only shows plants with connected observations (`/api/plants/observed` endpoint, `obsSlugSet` passed to `renderPlantList`)
- Plant count updates on filter via `plant:filter` event

### In progress — mobile badge (NOT YET WORKING)
When the plant filter header scrolls to its stuck position on mobile, a count badge should appear beside the BG square — same pattern as `.garden-name-sticky` on the garden page.

**HTML** (`index.html`): `.highlight-sticky` is now wrapped in `.highlight-header-fixed` (flex container), with `.plant-count-sticky#plant-count-sticky` as a sibling — same structure as `.garden-header-fixed` on `garden.html`.

**CSS** (style.css):
- `.highlight-header-fixed`: `position: fixed; top: var(--hb-space-400); left: var(--page-pad); display: flex; gap: 2px` (like `.garden-header-fixed`)
- `.highlight-header-fixed .highlight-sticky`: `position: static` (overrides the standalone fixed positioning)
- `.plant-count-sticky`: black badge, `opacity: 0`, fades in via `.is-visible` class (like `.garden-name-sticky`)
- On mobile when `.plant-sticky-header.is-stuck`: h3 is `visibility: hidden` (not `display: none` — preserves layout height) so the count "moves" to the badge

**JS** (`app.js`): IntersectionObserver on a sentinel at the top of `#plants-section` — when sentinel exits viewport from the top, adds `is-visible` to badge and `is-stuck` to plant header.

**Known bugs still open**:
1. `plant:filter` listener must be registered BEFORE `renderPlantList` is called — otherwise badge text is never initialized (the event fires on first render before the listener exists). Fixed in working tree but not yet committed.
2. Need to verify the badge doesn't visually overlap the sticky header when both are at top of viewport.

**Do not remove** the `plant:filter` listener that's now placed before `renderPlantList` in `app.js`.

## TODOs

- **Plant card dot z-index**: the colored dot should sit below the text (z-index behind text layer).
- **Shared plant modal HTML**: modal markup is duplicated in index.html and garden.html — consolidate into a shared template.

- **Plant changelog not showing**: `plant_edits` table inserts appear to fail silently. Server logs `[logEdits]` errors but root cause (table schema mismatch?) unresolved. `GET /api/plant-edits/:slug` returns `[]`. Investigate Supabase `plant_edits` table columns.


- **Supabase RLS**: API currently uses service role key (bypasses RLS). Add row-level security policies as a second enforcement layer — ownership rules (`created_by = auth.uid()`) for observations, gardens, and plants. Currently only the API enforces access control.

- **Garden-scoped plant identification via CLIP embeddings**: Replace/augment PlantNet with visual similarity search against labeled observations in the same garden. Needed because rare species (e.g. Echinacea tennesseensis) never appear in PlantNet results. Plan: (1) enable pgvector in Supabase + add `embedding vector(512)` column to observations, (2) generate CLIP embeddings via HuggingFace API (HF_TOKEN env var) on upload, (3) similarity endpoint scoped to garden, (4) show suggestions in obs form alongside PlantNet, (5) backfill existing labeled observations. Gets smarter as observations accumulate — every correction is implicit training data.
