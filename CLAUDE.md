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
