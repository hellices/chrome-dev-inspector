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
        console.log('[HoverComp] Value updated successfully');
        refreshOverlay(getCurrentTarget);
        break;
        
      case MESSAGE_TYPES.UPDATE_ERROR:
        console.error('[HoverComp] Update failed:', event.data.error);
        break;
    }
  };
}

/**
 * Handle component info response
 */
function handleComponentInfoResponse({ componentInfo }, updateOverlayCallback, getCurrentTarget) {
  const currentTarget = getCurrentTarget();
  if (currentTarget) {
    const mouseX = currentTarget._mouseX || null;
    const mouseY = currentTarget._mouseY || null;
    updateOverlayCallback(currentTarget, componentInfo, mouseX, mouseY);
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
 */
export function requestComponentInfo(element) {
  const xpath = getXPath(element);
  postMessage(MESSAGE_TYPES.GET_COMPONENT_INFO, { targetPath: xpath });
}

/**
 * Invalidate cache for an element
 * @param {HTMLElement} element - Target element
 */
export function invalidateCache(element) {
  const xpath = getXPath(element);
  postMessage(MESSAGE_TYPES.INVALIDATE_CACHE, { targetPath: xpath });
}

/**
 * Update a hook value
 * @param {HTMLElement} element - Target element
 * @param {number} hookIndex - Hook index
 * @param {*} newValue - New value
 */
export function updateHook(element, hookIndex, newValue) {
  const xpath = getXPath(element);
  postMessage(MESSAGE_TYPES.UPDATE_HOOK, { targetPath: xpath, hookIndex, newValue });
}

/**
 * Update a state value
 * @param {HTMLElement} element - Target element
 * @param {string} stateKey - State key
 * @param {*} newValue - New value
 */
export function updateState(element, stateKey, newValue) {
  const xpath = getXPath(element);
  postMessage(MESSAGE_TYPES.UPDATE_STATE, { targetPath: xpath, stateKey, newValue });
}
