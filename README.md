# HoverComp Dev Inspector

A Chrome extension (Manifest V3) that enables hover-based component inspection for React, Vue, Angular, and Web Components in development builds.

## 🎯 Features

- **Hover Detection**: Instantly displays component information when hovering over UI elements
- **Multi-Framework Support**:
  - React (with DevTools hooks)
  - Vue 2 & Vue 3
  - Angular (Ivy)
  - Web Components
- **Keyboard Toggle**: Press `Alt+Shift+C` to enable/disable the inspector
- **Performance Optimized**: Built-in throttling and caching for smooth performance
- **Dev-Mode Only**: Designed to work with development builds (does not support production builds)
- **Minimal UI**: Clean overlay with component name and framework information

## 🚀 Installation

### Load as Unpacked Extension

1. Clone this repository:

   ```bash
   git clone https://github.com/hellices/chrome-dev-inspector.git
   cd chrome-dev-inspector
   ```

2. Install dependencies and run tests:

   ```bash
   npm install
   npm test
   ```

3. Open Chrome and navigate to `chrome://extensions/`

4. Enable "Developer mode" (toggle in the top-right corner)

5. Click "Load unpacked" and select the extension directory

6. The extension will now be active on `localhost`, `127.0.0.1`, and `*.local` domains

## 📖 Usage

1. Open a web application running in development mode (React, Vue, Angular, or Web Components)

2. The extension is enabled by default - simply hover over any UI element

3. An overlay will appear showing:
   - Framework name (e.g., "React", "Vue 3", "Angular", "Web Component")
   - Component name (e.g., "MyComponent", "App", "HeaderComponent")
   - Additional details (if available)

4. Press `Alt+Shift+C` to toggle the inspector on/off

### Example Output

```
React: MyButton (functional)
Vue 3: TodoList
Angular: AppComponent
Web Component: custom-button (Shadow DOM)
```

## 🏗️ Architecture

### File Structure

```
chrome-dev-inspector/
├── manifest.json           # Chrome extension manifest (MV3)
├── src/
│   ├── content.js         # Content script (hover handling, overlay)
│   ├── inpage.js          # In-page script (framework detection)
│   └── utils/
│       ├── throttle.js    # Throttle utility
│       └── frameworkDetect.js  # Framework detection logic
├── styles/
│   └── overlay.css        # Overlay styling (light/dark theme)
├── tests/
│   ├── utils/
│   │   ├── throttle.test.js
│   │   └── frameworkDetect.test.js
│   └── content.overlay.test.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### How It Works

1. **Content Script** (`content.js`):
   - Listens for hover events on the page
   - Calculates element position for overlay
   - Communicates with in-page script via `postMessage`

2. **In-Page Script** (`inpage.js`):
   - Runs in the main world context with access to framework globals
   - Accesses DevTools hooks (`__REACT_DEVTOOLS_GLOBAL_HOOK__`, `__vue__`, etc.)
   - Maps DOM nodes to framework components
   - Returns component information to content script

3. **Overlay**:
   - Displays component information in a non-intrusive manner
   - Positioned relative to the hovered element
   - Auto-hides when moving away from elements

## 🧪 Testing

The extension includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

- **Unit Tests**: `throttle.js`, `frameworkDetect.js`
- **Integration Tests**: Overlay functionality, message handling
- **Coverage**: 98.7% (exceeds 80% requirement)

## 🔍 Framework Detection

### React

- Uses `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`
- Traverses Fiber tree to find component names
- Extracts `displayName`, `name`, or `constructor.name`

### Vue 2

- Accesses `node.__vue__` instance
- Reads `$options.name` or `_componentTag`

### Vue 3

- Checks `node.__vueParentComponent` or `node.__vnode`
- Extracts `type.name` or `__name`

### Angular (Ivy)

- Uses `window.ng.getComponent(node)` in dev mode
- Falls back to `node.__ngContext__`

### Web Components

- Checks for custom element tag names (contains hyphen)
- Uses `window.customElements.get(tagName)`
- Detects Shadow DOM presence

## ⚙️ Development

### Prerequisites

- Node.js 14+
- npm 6+
- Chrome browser

### Setup

```bash
# Install dependencies
npm install

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Project Scripts

- `npm test` - Run all tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## ⚠️ Limitations

### Development Builds Only

This extension **only works with development builds** of applications. Production builds typically:

- Remove debug information
- Minify component names
- Strip DevTools hooks
- Obfuscate code

### Browser Support

- Chrome (Manifest V3)
- Chromium-based browsers (Edge, Brave, etc.)

### Domain Restrictions

By default, the extension only runs on:

- `http://localhost/*`
- `http://127.0.0.1/*`
- `http://*.local/*`

This can be modified in `manifest.json` under `host_permissions` and `content_scripts.matches`.

### Framework Requirements

- React: Requires React DevTools hook (present in dev builds)
- Vue: Requires instance attachment to DOM nodes
- Angular: Requires Ivy renderer and dev mode
- Web Components: Works in all modes

## 🔐 Security & Privacy

- **Read-Only Access**: Only reads DOM and framework metadata
- **No Data Storage**: No user data is collected or stored
- **Local Only**: Designed for local development environments
- **No Network Requests**: All processing happens locally

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. All tests pass (`npm test`)
2. Code is linted (`npm run lint`)
3. Code is formatted (`npm run format`)
4. Test coverage remains above 80%

## 📚 Additional Resources

- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/mv3/)
- [React DevTools](https://github.com/facebook/react/tree/main/packages/react-devtools)
- [Vue DevTools](https://github.com/vuejs/devtools)
- [Angular DevTools](https://angular.io/guide/devtools)

## 🐛 Troubleshooting

### Extension Not Working?

1. **Check you're in development mode**: Production builds won't work
2. **Verify the domain**: Extension only runs on localhost by default
3. **Check console for errors**: Open DevTools and look for extension logs
4. **Toggle the extension**: Try pressing `Alt+Shift+C`
5. **Reload the extension**: Go to `chrome://extensions/` and reload

### No Component Names Showing?

- Ensure your framework is running in development mode
- Check that DevTools extensions are enabled for your framework
- Some HOCs or wrapped components may not expose names properly

### Performance Issues?

- The extension uses throttling (50ms) to prevent performance issues
- If experiencing lag, try disabling the extension when not needed
- Component detection is cached for 1 second per element
