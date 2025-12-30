/**
 * Constants used throughout the extension
 */

// Timing constants
export const THROTTLE_MS = 50;
export const CACHE_DURATION = 1000; // 1 second

// Z-index for overlay elements
export const OVERLAY_Z_INDEX = 2147483647;

// Layout constants
export const PANEL_MIN_WIDTH = 320;
export const PANEL_MAX_WIDTH = 500;
export const PANEL_MAX_HEIGHT_VH = 95;
export const PANEL_SPACING = 20;
export const PANEL_MARGIN = 10;

// Keyboard shortcuts
export const TOGGLE_SHORTCUT = {
  altKey: true,
  shiftKey: true,
  code: 'KeyC'
};

// Messages
export const MESSAGE_TYPES = {
  GET_COMPONENT_INFO: 'GET_COMPONENT_INFO',
  COMPONENT_INFO_RESPONSE: 'COMPONENT_INFO_RESPONSE',
  UPDATE_HOOK: 'UPDATE_HOOK',
  UPDATE_STATE: 'UPDATE_STATE',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  UPDATE_ERROR: 'UPDATE_ERROR',
  INVALIDATE_CACHE: 'INVALIDATE_CACHE'
};

// CSS selectors and classes
export const CSS_CLASSES = {
  OVERLAY: 'hovercomp-overlay',
  PANEL: 'hovercomp-panel',
  TOGGLE_SECTION: 'toggle-section',
  EDITABLE_HOOK: 'editable-hook',
  EDITABLE_STATE: 'editable-state',
  TOGGLE_CLASS: 'toggle-class',
  DELETE_CLASS: 'delete-class',
  TOGGLE_STYLE: 'toggle-style',
  DELETE_STYLE: 'delete-style',
  ADD_CLASS: 'add-class',
  ADD_INLINE_STYLE: 'add-inline-style',
  COMPUTED_STYLE_ITEM: 'computed-style-item',
  EDITABLE_STYLE: 'editable-style'
};

// Default expanded sections state
export const DEFAULT_EXPANDED_SECTIONS = {
  css: false,
  props: false,
  state: false,
  hooks: false,
  appliedStyles: false
};

// Known framework components to filter out
export const KNOWN_FRAMEWORK_COMPONENTS = [
  'Link', 'Image', 'Script', 'Head', 'ServerRoot', 'HotReload',
  'Router', 'AppRouter', 'ErrorBoundary', 'Boundary', 'Provider', 'Context'
];

// Framework patterns to filter
export const FRAMEWORK_PATTERNS = [
  'Fragment', 'Suspense', 'StrictMode', 'Provider', 'Consumer', 
  'Context', 'Profiler', 'Router', 'AppRouter', 'ErrorBoundary', 
  'Boundary', 'Handler', 'Root', 'ServerRoot'
];

// User code path indicators
export const USER_CODE_PATHS = ['/app/', '\\app\\', '/src/', '\\src\\', '/components/', '\\components\\', '/pages/', '\\pages\\'];

// Score thresholds
export const USER_COMPONENT_SCORE_THRESHOLD = 8;
