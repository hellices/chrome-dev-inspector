# HoverComp Dev Inspector

> Chrome DevTools extension for instant component inspection on hover with advanced tracking and profiling

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/react-supported-61dafb" alt="React">
  <img src="https://img.shields.io/badge/vue-supported-42b883" alt="Vue">
  <img src="https://img.shields.io/badge/svelte-supported-ff3e00" alt="Svelte">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

Hover over any element to instantly inspect components from React, Vue, Svelte, or plain HTML—without opening DevTools. Edit state, toggle styles, and explore component hierarchies in real-time.

## Features

### 🎯 Instant Inspection
Hover over any element to see component details, hierarchy, props, state, and styles—no clicking required.

### ⚛️ Framework Support
- **React**: Component tree, props, state, hooks with live editing
- **Vue**: Component hierarchy and reactive data (Vue 2 & 3)
- **Svelte**: Component detection and reactive state
- **HTML**: DOM structure, attributes, and styles

### ✏️ Live Editing
- Edit state and hook values directly
- Toggle CSS classes and inline styles
- Add new classes and styles on the fly
- Test layout changes instantly

### ⌨️ Keyboard Shortcuts
- `Alt+Shift+C` — Toggle inspector
- `Alt+Shift+M` — Switch inspection modes
- `Alt+Click` — Pin/unpin overlay

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/hellices/chrome-dev-inspector.git
   cd chrome-dev-inspector
   npm install
   npm run build
   ```

2. Load in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `chrome-dev-inspector` directory

## Usage

Hover over any element to see component information. Press `Alt+Shift+M` to switch between Auto, React, Vue, Svelte, or HTML modes.

**Editing:**
- Click values to edit (Enter to save, Esc to cancel)
- Click classes/styles to toggle
- `Alt+Click` to pin/unpin overlay

## How It Works

The extension injects scripts to detect framework components and extract data:
- **React**: Uses DevTools hook and fiber tree
- **Vue**: Accesses component instances (v2/v3)
- **Svelte**: Detects via component markers and state

All inspection happens locally in your browser.

## Development

```bash
npm test          # Run tests
npm run lint      # Lint code
npm run build     # Build extension
```

## Privacy

The extension requires `<all_urls>` permission to inject scripts on any website. All inspection happens locally—no data is collected or transmitted.

## Known Issues

- Component names may be minified in production builds
- Heavy component trees may affect performance

## License

MIT

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/hellices/chrome-dev-inspector/issues) on GitHub.

Pull requests are welcome! Please run `npm test` and `npm run lint` before submitting.
