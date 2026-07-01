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

## TODOs

- **Plant card dot z-index**: the colored dot should sit below the text (z-index behind text layer).
- **Shared plant modal HTML**: modal markup is duplicated in index.html and garden.html — consolidate into a shared template.

- **Plant changelog not showing**: `plant_edits` table inserts appear to fail silently. Server logs `[logEdits]` errors but root cause (table schema mismatch?) unresolved. `GET /api/plant-edits/:slug` returns `[]`. Investigate Supabase `plant_edits` table columns.

- **Garden-scoped plant identification via CLIP embeddings**: Replace/augment PlantNet with visual similarity search against labeled observations in the same garden. Needed because rare species (e.g. Echinacea tennesseensis) never appear in PlantNet results. Plan: (1) enable pgvector in Supabase + add `embedding vector(512)` column to observations, (2) generate CLIP embeddings via HuggingFace API (HF_TOKEN env var) on upload, (3) similarity endpoint scoped to garden, (4) show suggestions in obs form alongside PlantNet, (5) backfill existing labeled observations. Gets smarter as observations accumulate — every correction is implicit training data.
