# Logo Files Required

## Overview
The dynamic theme system requires two logo variants to ensure optimal visibility in both light and dark modes.

## Required Files

### 1. logo-negro.png (Black Logo)
- **Location:** `assets/img/logo-negro.png`
- **Usage:** Light mode (displayed on light backgrounds)
- **Color:** Black or dark charcoal (#1a1612)
- **Specifications:**
  - Transparent background (PNG with alpha channel)
  - Recommended height: 40px for header, 30px for footer
  - High resolution (2x or 3x for retina displays)

### 2. logo-blanco.png (White Logo)
- **Location:** `assets/img/logo-blanco.png`
- **Usage:** Dark mode (displayed on dark backgrounds)
- **Color:** White or off-white (#faf8f5)
- **Specifications:**
  - Transparent background (PNG with alpha channel)
  - Recommended height: 40px for header, 30px for footer
  - High resolution (2x or 3x for retina displays)

## Implementation Status

The JavaScript code in `assets/js/theme.js` has been updated to automatically switch between these two logo files based on the active theme. The `updateLogo()` function:

1. Detects the current theme (light or dark)
2. Finds all logo images in the page
3. Updates the `src` attribute to the appropriate logo file
4. Runs on page load and whenever the theme is toggled

## HTML Updates

The following files have been updated to reference the new logo files:

- **index.html:** Header logo uses `logo-negro.png`, footer logo uses `logo-blanco.png`
- **detalle.html:** Header logo uses `logo-negro.png`
- **cliente/index.html:** No logo in header (navbar only shows user name)

## Next Steps

**ACTION REQUIRED:** Create the two logo image files:

1. Export the MB Eureka logo in black/dark color → Save as `assets/img/logo-negro.png`
2. Export the MB Eureka logo in white/light color → Save as `assets/img/logo-blanco.png`

Until these files are created, you can temporarily:
- Copy `assets/img/logo.png` to `assets/img/logo-negro.png`
- Create a white version and save as `assets/img/logo-blanco.png`

The system will automatically use the correct logo based on the active theme once the files are in place.
