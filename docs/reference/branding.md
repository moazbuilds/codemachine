# Branding Guidelines

## Gemini UI Theme
- Inspiration: Gemini UI — calm, focused blue gradient and minimal chrome.
- Primary gradient: use a left-to-right or 135° sweep from `--brand-blue-600` → `--brand-blue-400` → `--brand-blue-200`.
- Fallback: when gradients are not supported, render using `primary` from palette tokens (see `docs/reference/cli-ui.md`).

```css
/* Tokens: override in theming layer; safe defaults shown */
:root {
  --brand-blue-200: #A7C4FF; /* light accent */
  --brand-blue-400: #5B8EFF; /* mid */
  --brand-blue-600: #2B6BFF; /* base */

  /* Derived */
  --brand-gradient: linear-gradient(135deg,
    var(--brand-blue-600) 0%,
    var(--brand-blue-400) 50%,
    var(--brand-blue-200) 100%
  );
}
```

Notes
- Keep backgrounds neutral; reserve gradient for hero areas: ASCII banner, major section transitions, or success finale.
- Provide CLI knob `--no-gradient` or env `BRAND_GRADIENT=0` to disable.

## ASCII Banner
- Usage: only at first entry to flows and major phase transitions; never repeat on every minor step.
- Width: ≤ 72 columns; center align; surround with `banner()` helper for consistent spacing.
- Contrast: color with `primary`; if gradient-capable, apply a top-to-bottom two-stop blend across lines.
- Accessibility: always log a plain-text title immediately before/after rendering art.

Example (monochrome-first)
```
  ____          _                _           
 / ___|___   __| | ___ _ __ ___ (_)_ __ ___  
| |   / _ \ / _` |/ _ \ '_ ` _ \| | '__/ _ \ 
| |__| (_) | (_| |  __/ | | | | | | | | (_) |
 \____\___/ \__,_|\___|_| |_| |_|_|_|  \___/ 
```

Guidelines
- Keep height ≤ 6 lines. Prefer rounded-letter FIGlet fonts (e.g., Standard) for readability.
- Provide `--no-banner` to skip; respect non-TTY environments by auto-falling back to plain headings.

## Typography
- Font: monospace only (terminal-controlled). Use UPPERCASE for banners and Section titles (`section()` helper underlines).
- Emphasis: do not rely on italics/bold; use palette tokens to encode meaning:
  - `primary` for calls-to-action, key headings.
  - `secondary` for gutters/labels.
  - `success`, `warning`, `error` for statuses.
- Copy style: concise, action-first. Max line length 80 chars. Avoid emoji; prefer explicit words.

## CLI Layout Rules
- Structure: Banner → Status Summary → Commands → Specifications prompt (see `docs/reference/cli-ui.md`).
- Gutters: 2 spaces left padding for content blocks; 1 empty line between sections; use `divider()` between unrelated groups.
- Key/Value lists: pad keys to 24 chars using `formatKeyValue()`; align values vertically.
- Spinners/progress: right-align within the content width; avoid mixing with multi-line wrapped text.
- Errors: prefix with "Error:" and color with `error`; provide one actionable fix per message.

## Palette Tokens & Controls
- Tokens: `primary`, `secondary`, `success`, `warning`, `error` (defined in `docs/reference/cli-ui.md`).
- Brand tokens (additive): `--brand-blue-200`, `--brand-blue-400`, `--brand-blue-600`, `--brand-gradient`.
- Controls: `--no-banner`, `--no-gradient`, and environment `BRAND_GRADIENT=0` for CI/screen readers.

Cross-References
- CLI UI Guidelines: docs/reference/cli-ui.md
- This guide underpins the "Gemini UI" look used in menus and banners.

