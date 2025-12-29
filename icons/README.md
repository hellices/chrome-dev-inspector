# Icon Placeholder Note

This directory should contain three icon files:

- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

For testing purposes, you can use any simple icon images. A proper icon would show a stylized "H" or component inspection symbol on a blue background.

To generate these icons from the SVG:

```bash
# Using ImageMagick (if available)
convert -background none -size 16x16 icon.svg icon16.png
convert -background none -size 48x48 icon.svg icon48.png
convert -background none -size 128x128 icon.svg icon128.png
```

Or use any online SVG to PNG converter with the icon.svg file provided.
