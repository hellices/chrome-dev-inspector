# HoverComp Dev Inspector

> Lightweight Chrome DevTools extension for instant component inspection on hover

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/react-supported-61dafb" alt="React">
  <img src="https://img.shields.io/badge/vue-supported-42b883" alt="Vue">
  <img src="https://img.shields.io/badge/svelte-supported-ff3e00" alt="Svelte">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

A Chrome extension that provides real-time component inspection for modern web frameworks. Simply hover over any element to see component details, edit state, toggle styles, and more—without opening DevTools.

## Features

### Instant Inspection

Point at any element to see its component details—no clicking, no DevTools panel switching.

### Framework-Aware

- **React**: Component tree, props, state, hooks (with live editing)
- **Vue**: Component hierarchy and reactive data
- **Svelte**: Component detection and reactive state
- **Plain HTML**: DOM structure, attributes, styles

### Live Editing

- Modify hook values and state directly in the overlay
- Toggle CSS classes and styles with one click
- Add new classes and inline styles on the fly
- Disable computed styles to test layout changes

### Flexible Modes

Switch between Auto (framework detection), React, HTML, Vue, or Svelte modes depending on your needs.

### Keyboard Shortcuts

- `Alt+Shift+C` — Toggle inspector
- `Alt+Shift+M` — Open mode selector
- `Alt+Click` — Pin overlay  
  💡 _Tip: Use Alt+Shift+C to toggle • Alt+Shift+M for menu • Alt+Click to unpin_

## Installation

### From Chrome Web Store

_Coming soon: The extension will be available on the Chrome Web Store._

### Manual Installation (For Testing or Development)

```bash
git clone https://github.com/hellices/chrome-dev-inspector.git
cd chrome-dev-inspector
npm install
npm test
```

### Load in Chrome

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-dev-inspector` directory

Once installed, the extension works on all websites automatically.

## Usage

Hover over any element on your page. A panel appears with component information.

### Mode Selection

Press `Alt+Shift+M` to open the mode selector:

- **Auto**: Detects frameworks automatically
- **React**: React components only
- **HTML**: Raw DOM inspection
- **Vue/Svelte**: Available when detected

### Editing

**React Mode:**

- Click state/hook values to edit (Enter to save, Esc to cancel)
- Click class names to toggle them
- Click inline styles to disable/enable

**HTML Mode:**

- Click text content to edit
- Click attribute values to modify
- Toggle classes and styles same as React mode

### Pinning

`Alt+Click` anywhere on the page to pin the overlay in place. Click again to unpin.

## Screenshots

**React Component Inspection**

```
⚛️ MovieCard (User Component)
Hierarchy: App → MovieList → MovieCard

Props (3) 🔒
  title: "Inception"
  rating: 8.8
  onClick: [Function]

Hooks (2) ✏️
  Hook 0: false    [Click to edit]
  Hook 1: "saved"  [Click to edit]

Classes (2) ✏️
  ✓ movie-card
  ✓ featured

Computed Styles (5) ✏️
  display: flex
  padding: 16px
  border-radius: 8px
```

**HTML Mode**

```
📄 DIV
Parent: main.container → section.content

Attributes (2) ✏️
  id: "search-box"
  data-active: "true"

Classes (1) ✏️
  ✓ search-wrapper

Inline Styles ✏️
  ✓ margin: 10px
  ✓ display: block
```

## How It Works

The extension uses a three-script architecture:

**Content Script** (`content.js`)  
Listens for hover events and manages the UI overlay. Handles mode switching and communicates with the in-page script.

**In-Page Script** (`inpage.js`)  
Runs in the page context with access to framework internals. Detects React/Vue/Svelte components via DevTools hooks and extracts component data.

**Overlay Manager**  
Renders the inspection panel with component details. Handles user interactions like editing state and toggling styles.

### Framework Detection

- **React**: Uses `__REACT_DEVTOOLS_GLOBAL_HOOK__` and fiber tree traversal
- **Vue**: Accesses `__vue__` (v2) or `__vueParentComponent` (v3)
- **Svelte**: Detects via `__svelte_*` keys, Svelte's `$$` instance property, and `data-svelte-h` attributes
- **Web Components**: Detects custom elements and Shadow DOM

The extension prioritizes user components over framework internals for cleaner inspection.

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

Tests validate manifest structure, file existence, and module exports.

## Configuration

### Permissions

The extension requires `host_permissions` for `<all_urls>` to function on all websites. This permission is necessary because:

- The extension needs to inject content scripts to detect framework components on any website
- Component inspection works by analyzing the DOM and framework internals of the visited page
- Without broad host permissions, the extension would need to request permission for each individual site

**Privacy and Security:**
- The extension does **not** collect, store, or transmit any data from websites you visit
- All component inspection happens locally in your browser
- No network requests are made by the extension
- The extension only activates when you explicitly hover over elements
- All code is open source and auditable in this repository

You can customize permissions in `manifest.json` if needed:

```json
"host_permissions": [
  "http://*/*",
  "https://*/*"
]
```

These settings allow the extension to inspect components on any HTTP or HTTPS website.

## Known Issues

- **Production builds**: Component names may be minified or unavailable
- **HOCs**: Higher-order components might not display the wrapped component name
- **Performance**: Heavy component trees may slow down inspection

## License

MIT

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss the proposal.

Run `npm test` before submitting to ensure all checks pass.
