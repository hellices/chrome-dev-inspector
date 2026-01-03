/**
 * Message handling for communication between content and inpage scripts
 */

import { MESSAGE_TYPES } from '../config/constants.js';
import { getXPath, findElementByXPath } from './domHelpers.js';

/**
 * Create a message handler for the content script
 * @param {Function} updateOverlayCallback - Callback to update overlay
 * @param {Function} getCurrentTarget - Function to get current target element
 * @returns {Function} Message event handler
 */
export function createContentMessageHandler(updateOverlayCallback, getCurrentTarget) {
  return function handleMessage(event) {
    if (event.source !== window) return;

    const { type, data } = event.data;

    switch (type) {
      case MESSAGE_TYPES.COMPONENT_INFO_RESPONSE:
        handleComponentInfoResponse(event.data, updateOverlayCallback, getCurrentTarget);
        break;

      case MESSAGE_TYPES.UPDATE_SUCCESS:
        refreshOverlay(getCurrentTarget);
        break;

      case MESSAGE_TYPES.UPDATE_ERROR:
        // Silent fail - error details are logged in inpage.js
        break;
    }
  };
}

/**
 * Handle component info response
 */
function handleComponentInfoResponse(
  { componentInfo, reactComponentXPath },
  updateOverlayCallback,
  getCurrentTarget
) {
  const currentTarget = getCurrentTarget();
  if (currentTarget) {
    const mouseX = currentTarget._mouseX || null;
    const mouseY = currentTarget._mouseY || null;
    updateOverlayCallback(currentTarget, componentInfo, mouseX, mouseY, reactComponentXPath);
  }
}

/**
 * Refresh overlay for current target
 */
function refreshOverlay(getCurrentTarget) {
  const currentTarget = getCurrentTarget();
  if (currentTarget) {
    const xpath = getXPath(currentTarget);
    postMessage(MESSAGE_TYPES.GET_COMPONENT_INFO, { targetPath: xpath });
  }
}

/**
 * Send a message to inpage script
 * @param {string} type - Message type
 * @param {Object} data - Message data
 */
export function postMessage(type, data = {}) {
  window.postMessage({ type, ...data }, '*');
}

/**
 * Request component info for an element
 * @param {HTMLElement} element - Target element
 * @param {string} inspectionMode - Inspection mode ('auto', 'react', 'html', etc.)
 */
export function requestComponentInfo(element, inspectionMode = 'auto') {
  if (!element) {
    return;
  }
  
  const xpath = getXPath(element);
  if (!xpath) {
    return;
  }
  
  postMessage(MESSAGE_TYPES.GET_COMPONENT_INFO, { targetPath: xpath, inspectionMode });
}

/**
 * Invalidate cache for an element
 * @param {HTMLElement} element - Target element
 */
export function invalidateCache(element) {
  if (!element) return;
  
  const xpath = getXPath(element);
  if (!xpath) return;
  
  postMessage(MESSAGE_TYPES.INVALIDATE_CACHE, { targetPath: xpath });
}

/**
 * Update a hook value
 * @param {HTMLElement} element - Target element
 * @param {number} hookIndex - Hook index
 * @param {*} newValue - New value
 */
export function updateHook(element, hookIndex, newValue) {
  if (!element) return;
  
  const xpath = getXPath(element);
  if (!xpath) return;
  
  postMessage(MESSAGE_TYPES.UPDATE_HOOK, { targetPath: xpath, hookIndex, newValue });
}

/**
 * Update a state value
 * @param {HTMLElement} element - Target element
 * @param {string} stateKey - State key
 * @param {*} newValue - New value
 */
export function updateState(element, stateKey, newValue) {
  if (!element) return;
  
  const xpath = getXPath(element);
  if (!xpath) return;
  
  postMessage(MESSAGE_TYPES.UPDATE_STATE, { targetPath: xpath, stateKey, newValue });
}
