# Shared UI Style Foundation

This folder contains shared visual foundations for all apps.

## Files
- `tokens.css`: global design tokens (colors, radii, shadows, transitions)
- `base.css`: global reset + body defaults
- `components.css`: reusable primitive classes

## Usage in app styles
At the top of each app stylesheet:

```css
@import "../../renderer/styles/tokens.css";
@import "../../renderer/styles/base.css";
@import "../../renderer/styles/components.css";
```

Then keep only app-specific overrides in each app `style.css` / `styles.css`.
