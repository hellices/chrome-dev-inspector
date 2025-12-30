/**
 * Content script for HoverComp Dev Inspector
 * Handles hover events, overlay rendering, and communication with inpage script
 */

(function () {
  'use strict';

  // State
  let isEnabled = true;
  let overlay = null;
  let currentTarget = null;
  let lastHoverTime = 0;
  let isPinned = false;
  let pinnedPosition = null;
  const THROTTLE_MS = 50;

  // Inject inpage script
  function injectInPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/inpage.js');
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Create overlay element
  function createOverlay() {
    const div = document.createElement('div');
    div.id = 'hovercomp-overlay';
    div.className = 'hovercomp-overlay';
    div.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      pointer-events: none;
      display: none;
      background: rgba(0, 123, 255, 0.1);
      border: 2px solid rgba(0, 123, 255, 0.8);
      box-sizing: border-box;
    `;

    const panel = document.createElement('div');
    panel.className = 'hovercomp-panel';
    panel.style.cssText = `
      position: fixed;
      background: rgba(20, 20, 20, 0.98);
      color: white;
      padding: 16px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 11px;
      line-height: 1.5;
      border-radius: 8px;
      white-space: pre-wrap;
      min-width: 320px;
      max-width: 500px;
      max-height: 95vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 2147483647;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.2);
    `;

    div.appendChild(panel);
    document.body.appendChild(div);
    return div;
  }

  // Get XPath for an element
  function getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = element.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = element.nodeName.toLowerCase();
      const pathIndex = index ? `[${index + 1}]` : '';
      parts.unshift(tagName + pathIndex);

      element = element.parentNode;
    }

    return parts.length ? '/' + parts.join('/') : null;
  }

  // Update overlay position and content
  function updateOverlay(element, componentInfo, mouseX, mouseY) {
    if (!overlay) {
      overlay = createOverlay();
    }

    if (!componentInfo) {
      if (!isPinned) {
        overlay.style.display = 'none';
      }
      return;
    }

    const rect = element.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const panel = overlay.querySelector('.hovercomp-panel');
    
    // Helper function to adjust panel position
    function adjustPanelPosition() {
      const panelRect = panel.getBoundingClientRect();
      const margin = 10;
      
      // Check if panel is cut off at bottom
      if (panelRect.bottom > window.innerHeight - margin) {
        let newTop = parseInt(panel.style.top) || 0;
        const overflow = panelRect.bottom - (window.innerHeight - margin);
        newTop = newTop - overflow - 20; // Extra 20px buffer
        
        // Make sure it doesn't go above viewport
        if (newTop < margin) {
          newTop = margin;
          const maxHeight = window.innerHeight - margin * 2;
          panel.style.maxHeight = `${maxHeight}px`;
          panel.style.overflowY = 'auto';
        }
        
        panel.style.top = `${newTop}px`;
      }
    }
    
    // Position panel based on pinned state
    if (isPinned && pinnedPosition) {
      panel.style.left = `${pinnedPosition.x}px`;
      panel.style.top = `${pinnedPosition.y}px`;
      panel.style.transform = 'none';
      panel.style.transition = 'border 0.2s ease';
      panel.style.border = '2px solid #4caf50';
    } else if (mouseX && mouseY) {
      // Position to the right of mouse cursor
      const panelRect = panel.getBoundingClientRect();
      const panelWidth = panelRect.width || 400;
      let panelHeight = panelRect.height || 600;
      const spacing = 20;
      const margin = 10;
      const maxHeight = window.innerHeight - margin * 2;
      
      // Limit panel height to viewport
      if (panelHeight > maxHeight) {
        panelHeight = maxHeight;
        panel.style.maxHeight = `${maxHeight}px`;
        panel.style.overflowY = 'auto';
      }
      
      let left = mouseX + spacing;
      let top = mouseY - 20; // Slightly above mouse cursor
      
      // If not enough space on right, show on left
      if (left + panelWidth > window.innerWidth - margin) {
        left = mouseX - panelWidth - spacing;
      }
      
      // Keep left within bounds
      if (left < margin) {
        left = margin;
      }
      
      // Keep top within bounds - if not enough space below, show above
      if (top + panelHeight > window.innerHeight - margin) {
        // Try to position above mouse cursor
        const topAbove = mouseY - panelHeight - 20;
        if (topAbove >= margin) {
          top = topAbove;
        } else {
          // Not enough space above or below, fit to viewport
          top = margin;
          const availableHeight = window.innerHeight - margin * 2;
          panel.style.maxHeight = `${availableHeight}px`;
          panel.style.overflowY = 'auto';
        }
      }
      
      if (top < margin) {
        top = margin;
      }
      
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.transform = 'none';
      panel.style.transition = 'left 0.15s ease-out, top 0.15s ease-out, border 0.2s ease';
      panel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      
      // Adjust position after a brief delay to allow panel to render
      setTimeout(() => adjustPanelPosition(), 50);
    }
    
    panel.innerHTML = formatComponentInfo(componentInfo, isPinned);
    
    // Adjust position after content is rendered
    setTimeout(() => adjustPanelPosition(), 100);
    
    // Add click handlers for expand/collapse
    panel.querySelectorAll('.toggle-section').forEach(toggle => {
      toggle.style.cursor = 'pointer';
      toggle.onclick = (e) => {
        e.stopPropagation();
        const content = toggle.nextElementSibling;
        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? 'block' : 'none';
        toggle.textContent = toggle.textContent.replace(isCollapsed ? '▶' : '▼', isCollapsed ? '▼' : '▶');
        
        // Reposition panel if it goes off screen after expanding
        if (isCollapsed) {
          setTimeout(() => {
            const panelRect = panel.getBoundingClientRect();
            const margin = 10;
            
            // Check if panel is cut off at bottom
            if (panelRect.bottom > window.innerHeight - margin) {
              let currentTop = parseInt(panel.style.top) || 0;
              const overflow = panelRect.bottom - (window.innerHeight - margin);
              let newTop = currentTop - overflow - 20; // Extra 20px buffer
              
              if (newTop < margin) {
                newTop = margin;
                panel.style.maxHeight = `${window.innerHeight - margin * 2}px`;
                panel.style.overflowY = 'auto';
              } else {
                // Reset max-height if we have space
                panel.style.maxHeight = '95vh';
              }
              
              panel.style.top = `${newTop}px`;
              panel.style.transition = 'top 0.2s ease-out';
              
              // Update pinned position if pinned
              if (isPinned) {
                pinnedPosition = {
                  x: parseInt(panel.style.left),
                  y: newTop
                };
              }
            }
          }, 10);
        }
      };
    });
    
    // Props are read-only - no editing allowed
    
    // Add inline editing for hooks
    panel.querySelectorAll('.editable-hook').forEach(span => {
      span.setAttribute('contenteditable', 'true');
      span.setAttribute('spellcheck', 'false');
      
      // Store original value
      const originalValue = span.textContent;
      
      // Focus handler
      span.onfocus = (e) => {
        e.stopPropagation();
        span.style.background = 'rgba(76,175,80,0.5)';
        span.style.outline = '2px solid #4caf50';
        span.style.boxShadow = '0 0 8px rgba(76,175,80,0.4)';
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      };
      
      // Blur handler - save changes
      span.onblur = (e) => {
        span.style.background = 'rgba(102,187,106,0.1)';
        span.style.outline = 'none';
        span.style.boxShadow = 'none';
        
        const newValue = span.textContent.trim();
        if (newValue !== originalValue) {
          const hookIndex = span.getAttribute('data-hook-index');
          const xpath = getXPath(element);
          window.postMessage({
            type: 'UPDATE_HOOK',
            targetPath: xpath,
            hookIndex: parseInt(hookIndex),
            newValue: newValue
          }, '*');
        }
      };
      
      // Enter key handler - save and blur
      span.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          span.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          span.textContent = originalValue;
          span.blur();
        }
        e.stopPropagation();
      };
      
      // Prevent click from closing overlay
      span.onclick = (e) => e.stopPropagation();
    });
    
    // Add inline editing for state
    panel.querySelectorAll('.editable-state').forEach(div => {
      div.setAttribute('contenteditable', 'true');
      div.setAttribute('spellcheck', 'false');
      
      // Store original value
      const originalValue = div.textContent;
      
      // Focus handler
      div.onfocus = (e) => {
        e.stopPropagation();
        div.style.background = 'rgba(171,71,188,0.5)';
        div.style.outline = '2px solid #ab47bc';
        div.style.boxShadow = '0 0 8px rgba(171,71,188,0.4)';
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(div);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      };
      
      // Blur handler - save changes
      div.onblur = (e) => {
        div.style.background = 'rgba(0,0,0,0.3)';
        div.style.outline = 'none';
        div.style.boxShadow = 'none';
        
        const newValue = div.textContent.trim();
        if (newValue !== originalValue) {
          const stateKey = div.getAttribute('data-state-key');
          const xpath = getXPath(element);
          window.postMessage({
            type: 'UPDATE_STATE',
            targetPath: xpath,
            stateKey: stateKey,
            newValue: newValue
          }, '*');
        }
      };
      
      // Enter key handler - save and blur
      div.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          div.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          div.textContent = originalValue;
          div.blur();
        }
        e.stopPropagation();
      };
      
      // Prevent click from closing overlay
      div.onclick = (e) => e.stopPropagation();
    });
    
    // Add click handlers for CSS class toggle (disable/enable)
    panel.querySelectorAll('.toggle-class').forEach(span => {
      span.onclick = (e) => {
        e.stopPropagation();
        const className = span.getAttribute('data-class');
        const isActive = span.getAttribute('data-active') === 'true';
        
        if (isActive) {
          // Disable (remove class and show as disabled)
          element.classList.remove(className);
          span.setAttribute('data-active', 'false');
          span.style.textDecoration = 'line-through';
          span.style.opacity = '0.5';
          span.style.background = 'rgba(255,255,255,0.05)';
        } else {
          // Enable (add class back)
          element.classList.add(className);
          span.setAttribute('data-active', 'true');
          span.style.textDecoration = 'none';
          span.style.opacity = '1';
          span.style.background = 'rgba(66,165,245,0.2)';
        }
      };
    });
    
    // Add delete handlers for CSS classes
    panel.querySelectorAll('.delete-class').forEach(deleteBtn => {
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        const className = deleteBtn.getAttribute('data-class');
        element.classList.remove(className);
        // Remove the span from DOM
        deleteBtn.parentElement.remove();
        
        // Invalidate cache and refresh overlay
        setTimeout(() => {
          if (currentTarget) {
            const xpath = getXPath(currentTarget);
            window.postMessage({ type: 'INVALIDATE_CACHE', targetPath: xpath }, '*');
            setTimeout(() => {
              window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
            }, 10);
          }
        }, 50);
      };
    });
    
    // Add click handlers for inline style toggle (disable/enable)
    panel.querySelectorAll('.toggle-style').forEach(span => {
      span.onclick = (e) => {
        e.stopPropagation();
        const styleProp = span.getAttribute('data-style-prop');
        const styleValue = span.getAttribute('data-style-value');
        const isActive = span.getAttribute('data-active') === 'true';
        const isImportant = span.getAttribute('data-use-important') === 'true' || styleValue.includes('!important');
        const cleanValue = styleValue.replace('!important', '').trim();
        
        if (isActive) {
          // Disable (remove style property)
          element.style.removeProperty(styleProp);
          span.setAttribute('data-active', 'false');
          span.style.textDecoration = 'line-through';
          span.style.opacity = '0.5';
          span.style.background = 'rgba(255,255,255,0.05)';
        } else {
          // Enable (add style property back)
          if (isImportant) {
            element.style.setProperty(styleProp, cleanValue, 'important');
          } else {
            element.style.setProperty(styleProp, cleanValue);
          }
          span.setAttribute('data-active', 'true');
          span.style.textDecoration = 'none';
          span.style.opacity = '1';
          span.style.background = 'rgba(144,202,249,0.2)';
        }
        
        // Invalidate cache and refresh overlay
        setTimeout(() => {
          if (currentTarget) {
            const xpath = getXPath(currentTarget);
            window.postMessage({ type: 'INVALIDATE_CACHE', targetPath: xpath }, '*');
            setTimeout(() => {
              window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
            }, 10);
          }
        }, 50);
      };
      
      // Right-click to toggle !important
      span.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const styleProp = span.getAttribute('data-style-prop');
        const styleValue = span.getAttribute('data-style-value');
        const isImportant = span.getAttribute('data-use-important') === 'true' || styleValue.includes('!important');
        const cleanValue = styleValue.replace('!important', '').trim();
        
        if (isImportant) {
          // Remove !important
          element.style.setProperty(styleProp, cleanValue);
          span.setAttribute('data-use-important', 'false');
          span.setAttribute('data-style-value', cleanValue);
          const firstSpan = span.querySelector('span:first-child');
          if (firstSpan) {
            firstSpan.innerHTML = `<span style="color: #64b5f6; font-weight: bold;">${escapeHtml(styleProp)}</span>: ${escapeHtml(cleanValue)}`;
          }
        } else {
          // Add !important
          element.style.setProperty(styleProp, cleanValue, 'important');
          span.setAttribute('data-use-important', 'true');
          span.setAttribute('data-style-value', cleanValue + ' !important');
          const firstSpan = span.querySelector('span:first-child');
          if (firstSpan) {
            firstSpan.innerHTML = `<span style="color: #64b5f6; font-weight: bold;">${escapeHtml(styleProp)}</span>: ${escapeHtml(cleanValue + ' !important')}`;
          }
        }
      };
    });
    
    // Add delete handlers for inline styles
    panel.querySelectorAll('.delete-style').forEach(deleteBtn => {
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        const styleProp = deleteBtn.getAttribute('data-style-prop');
        element.style.removeProperty(styleProp);
        // Remove the span from DOM
        deleteBtn.parentElement.remove();
        
        // Invalidate cache and refresh overlay
        setTimeout(() => {
          if (currentTarget) {
            const xpath = getXPath(currentTarget);
            window.postMessage({ type: 'INVALIDATE_CACHE', targetPath: xpath }, '*');
            setTimeout(() => {
              window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
            }, 10);
          }
        }, 50);
      };
    });
    
    // Add click handlers for computed styles (disable/enable)
    panel.querySelectorAll('.computed-style-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const styleProp = item.getAttribute('data-style-prop');
        const styleValue = item.getAttribute('data-style-value');
        const isActive = item.getAttribute('data-active') === 'true';
        
        if (isActive) {
          // Disable by setting to opposite or neutral value with !important
          let disabledValue = 'unset';
          
          // Property-specific disable values
          if (styleProp === 'display') disabledValue = 'none';
          else if (styleProp === 'opacity') disabledValue = '0';
          else if (styleProp === 'visibility') disabledValue = 'hidden';
          else if (styleProp.includes('color') || styleProp.includes('background')) disabledValue = 'transparent';
          else if (styleProp.includes('width') || styleProp.includes('height')) disabledValue = 'auto';
          else if (styleProp.includes('margin') || styleProp.includes('padding')) disabledValue = '0';
          else if (styleProp.includes('border')) disabledValue = 'none';
          
          element.style.setProperty(styleProp, disabledValue, 'important');
          item.setAttribute('data-active', 'false');
          item.setAttribute('data-disabled-value', disabledValue);
          item.style.textDecoration = 'line-through';
          item.style.opacity = '0.5';
          item.style.background = 'rgba(255,255,255,0.05)';
        } else {
          // Enable by removing our override (let original styles apply)
          element.style.removeProperty(styleProp);
          item.setAttribute('data-active', 'true');
          item.style.textDecoration = 'none';
          item.style.opacity = '1';
          item.style.background = 'transparent';
        }
      };
    });
    
    // Add class button
    panel.querySelectorAll('.add-class').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        
        // Create inline input
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Enter class name...';
        input.style.cssText = 'background: rgba(25,118,210,0.2); color: #fff; border: 1px solid #1976d2; padding: 4px 8px; border-radius: 3px; font-size: 10px; width: 100%; margin-top: 4px; outline: none;';
        
        // Replace button with input
        btn.parentNode.insertBefore(input, btn);
        btn.style.display = 'none';
        input.focus();
        
        // Save on Enter
        input.onkeydown = (keyEvent) => {
          if (keyEvent.key === 'Enter') {
            keyEvent.preventDefault();
            const newClass = input.value.trim();
            if (newClass) {
              element.classList.add(newClass);
              // Create a toggleable class element
              const classSpan = document.createElement('span');
              classSpan.className = 'toggle-class';
              classSpan.setAttribute('data-class', newClass);
              classSpan.setAttribute('data-active', 'true');
              classSpan.textContent = newClass;
              classSpan.style.cssText = 'background: rgba(66,165,245,0.2); padding: 2px 6px; border-radius: 2px; margin: 2px; display: inline-block; cursor: pointer; transition: all 0.2s;';
              classSpan.title = 'Click to disable/enable';
              classSpan.onmouseover = () => classSpan.style.opacity = '0.7';
              classSpan.onmouseout = () => classSpan.style.opacity = '1';
              classSpan.onclick = (e) => {
                e.stopPropagation();
                const isActive = classSpan.getAttribute('data-active') === 'true';
                if (isActive) {
                  element.classList.remove(newClass);
                  classSpan.setAttribute('data-active', 'false');
                  classSpan.style.textDecoration = 'line-through';
                  classSpan.style.opacity = '0.5';
                  classSpan.style.background = 'rgba(255,255,255,0.05)';
                } else {
                  element.classList.add(newClass);
                  classSpan.setAttribute('data-active', 'true');
                  classSpan.style.textDecoration = 'none';
                  classSpan.style.opacity = '1';
                  classSpan.style.background = 'rgba(66,165,245,0.2)';
                }
              };
              // Insert before the input
              input.parentNode.insertBefore(classSpan, input);
              input.value = '';
              input.focus();
              
              // Invalidate cache and refresh overlay
              if (currentTarget) {
                const xpath = getXPath(currentTarget);
                window.postMessage({ type: 'INVALIDATE_CACHE', targetPath: xpath }, '*');
                setTimeout(() => {
                  window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
                }, 50);
              }
            } else {
              // Restore button if empty
              btn.style.display = '';
              input.remove();
            }
          }
          if (keyEvent.key === 'Escape') {
            keyEvent.preventDefault();
            btn.style.display = '';
            input.remove();
          }
          keyEvent.stopPropagation();
        };
        
        // Cancel on blur
        input.onblur = () => {
          setTimeout(() => {
            btn.style.display = '';
            input.remove();
          }, 200);
        };
      };
    });
    
    // Edit inline styles - contenteditable
    panel.querySelectorAll('.editable-style').forEach(code => {
      code.setAttribute('contenteditable', 'true');
      code.setAttribute('spellcheck', 'false');
      
      // Store original value
      const originalStyle = code.textContent;
      
      // Focus handler
      code.onfocus = (e) => {
        e.stopPropagation();
        code.style.background = 'rgba(66,165,245,0.5)';
        code.style.outline = '2px solid #42a5f5';
        code.style.boxShadow = '0 0 8px rgba(66,165,245,0.4)';
      };
      
      // Blur handler - save changes
      code.onblur = (e) => {
        code.style.background = 'transparent';
        code.style.outline = 'none';
        code.style.boxShadow = 'none';
        
        const newStyle = code.textContent.trim();
        if (newStyle !== originalStyle) {
          element.style.cssText = newStyle;
          // Refresh overlay
          const xpath = getXPath(element);
          window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
        }
      };
      
      // Enter key handler
      code.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          code.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          code.textContent = originalStyle;
          code.blur();
        }
        e.stopPropagation();
      };
      
      // Prevent click from closing overlay
      code.onclick = (e) => e.stopPropagation();
    });
    
    // Add inline style button
    panel.querySelectorAll('.add-inline-style').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        
        // Create input for property name and value
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'property: value';
        input.style.cssText = 'background: rgba(25,118,210,0.2); color: #90caf9; border: 1px solid #1976d2; padding: 4px 8px; border-radius: 3px; font-size: 10px; width: 100%; margin-top: 4px; outline: none; font-family: monospace;';
        
        // Replace button with input
        btn.parentNode.insertBefore(input, btn);
        btn.style.display = 'none';
        input.focus();
        
        // Save on Enter
        input.onkeydown = (keyEvent) => {
          if (keyEvent.key === 'Enter') {
            keyEvent.preventDefault();
            const newStyle = input.value.trim();
            if (newStyle && newStyle.includes(':')) {
              let [prop, val] = newStyle.split(':').map(s => s.trim());
              if (prop && val) {
                // Check if user wants !important
                const useImportant = keyEvent.shiftKey || val.includes('!important');
                if (!val.includes('!important') && useImportant) {
                  val = val + ' !important';
                }
                
                // Apply style with priority
                if (useImportant) {
                  element.style.setProperty(prop, val.replace('!important', '').trim(), 'important');
                } else {
                  element.style.setProperty(prop, val);
                }
                
                // Log to verify and check if it was actually applied
                const computedValue = window.getComputedStyle(element).getPropertyValue(prop);
                console.log(`[HoverComp] Applied style: ${prop}: ${val}`, 'Computed:', computedValue);
                
                // Check if style was overridden and suggest !important
                const wasOverridden = computedValue && computedValue !== val.replace('!important', '').trim();
                if (wasOverridden && !useImportant) {
                  console.warn(`[HoverComp] Style may be overridden. Try Shift+Enter to add !important`);
                  // Show a brief hint in the UI
                  setTimeout(() => {
                    const hint = document.createElement('div');
                    hint.textContent = '⚠️ Style may not apply. Right-click to add !important';
                    hint.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #ff9800; color: white; padding: 12px 16px; border-radius: 4px; font-size: 11px; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: fadeIn 0.3s;';
                    document.body.appendChild(hint);
                    setTimeout(() => hint.remove(), 3000);
                  }, 100);
                }
                
                // Create a toggleable style element
                const styleSpan = document.createElement('span');
                styleSpan.className = 'toggle-style';
                styleSpan.setAttribute('data-style-prop', prop);
                styleSpan.setAttribute('data-style-value', val);
                styleSpan.setAttribute('data-use-important', useImportant ? 'true' : 'false');
                styleSpan.setAttribute('data-active', 'true');
                styleSpan.innerHTML = `<span style="color: #64b5f6; font-weight: bold;">${escapeHtml(prop)}</span>: ${escapeHtml(val)}`;
                styleSpan.style.cssText = 'background: rgba(144,202,249,0.2); padding: 3px 8px; border-radius: 3px; font-size: 10px; cursor: pointer; transition: all 0.2s; color: #90caf9; display: inline-block; margin: 2px;';
                styleSpan.title = 'Click to disable/enable, Right-click to toggle !important';
                styleSpan.onmouseover = () => styleSpan.style.opacity = '0.7';
                styleSpan.onmouseout = () => styleSpan.style.opacity = '1';
                styleSpan.onclick = (e) => {
                  e.stopPropagation();
                  const isActive = styleSpan.getAttribute('data-active') === 'true';
                  const currentVal = styleSpan.getAttribute('data-style-value');
                  const isImportant = styleSpan.getAttribute('data-use-important') === 'true';
                  
                  if (isActive) {
                    element.style.removeProperty(prop);
                    styleSpan.setAttribute('data-active', 'false');
                    styleSpan.style.textDecoration = 'line-through';
                    styleSpan.style.opacity = '0.5';
                    styleSpan.style.background = 'rgba(255,255,255,0.05)';
                  } else {
                    if (isImportant) {
                      element.style.setProperty(prop, currentVal.replace('!important', '').trim(), 'important');
                    } else {
                      element.style.setProperty(prop, currentVal);
                    }
                    styleSpan.setAttribute('data-active', 'true');
                    styleSpan.style.textDecoration = 'none';
                    styleSpan.style.opacity = '1';
                    styleSpan.style.background = 'rgba(144,202,249,0.2)';
                  }
                };
                styleSpan.oncontextmenu = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const isImportant = styleSpan.getAttribute('data-use-important') === 'true';
                  const currentVal = styleSpan.getAttribute('data-style-value').replace('!important', '').trim();
                  
                  if (isImportant) {
                    // Remove !important
                    element.style.setProperty(prop, currentVal);
                    styleSpan.setAttribute('data-use-important', 'false');
                    styleSpan.setAttribute('data-style-value', currentVal);
                    styleSpan.innerHTML = `<span style="color: #64b5f6; font-weight: bold;">${escapeHtml(prop)}</span>: ${escapeHtml(currentVal)}`;
                  } else {
                    // Add !important
                    element.style.setProperty(prop, currentVal, 'important');
                    styleSpan.setAttribute('data-use-important', 'true');
                    styleSpan.setAttribute('data-style-value', currentVal + ' !important');
                    styleSpan.innerHTML = `<span style="color: #64b5f6; font-weight: bold;">${escapeHtml(prop)}</span>: ${escapeHtml(currentVal + ' !important')}`;
                  }
                };
                // Find or create the inline styles container
                let inlineStylesDiv = btn.parentNode.querySelector('div[style*="flex-wrap"]');
                if (!inlineStylesDiv) {
                  // Create the container if it doesn't exist
                  inlineStylesDiv = document.createElement('div');
                  inlineStylesDiv.style.cssText = 'margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;';
                  btn.parentNode.insertBefore(inlineStylesDiv, btn);
                }
                inlineStylesDiv.appendChild(styleSpan);
                input.value = '';
                input.focus();
                
                // Invalidate cache and refresh overlay to update Applied Styles
                setTimeout(() => {
                  if (currentTarget) {
                    const xpath = getXPath(currentTarget);
                    window.postMessage({ type: 'INVALIDATE_CACHE', targetPath: xpath }, '*');
                    setTimeout(() => {
                      window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
                    }, 10);
                  }
                }, 50);
              }
            } else {
              // Restore button if empty or invalid
              btn.style.display = '';
              input.remove();
            }
          }
          if (keyEvent.key === 'Escape') {
            keyEvent.preventDefault();
            btn.style.display = '';
            input.remove();
          }
          keyEvent.stopPropagation();
        };
        
        // Cancel on blur
        input.onblur = () => {
          setTimeout(() => {
            btn.style.display = '';
            input.remove();
          }, 200);
        };
      };
    });
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function formatComponentInfo(info, pinned) {
    let html = `<div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">`;
    html += `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">`;
    html += `<strong style="color: #61dafb; font-size: 14px;">${info.name}</strong>`;
    if (info.isUserComponent) {
      html += `<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold;">USER</span>`;
    } else {
      html += `<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px;">LIB</span>`;
    }
    if (pinned) {
      html += `<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px;">📍 PINNED</span>`;
    }
    html += `</div>`;
    html += `<div style="color: #888; font-size: 10px;">${info.framework}</div>`;
    
    // Show file path if available
    if (info.fileName) {
      const shortPath = info.fileName.split('/').slice(-3).join('/') || info.fileName.split('\\').slice(-3).join('\\');
      html += `<div style="color: #64b5f6; font-size: 9px; margin-top: 2px; word-break: break-all;" title="${info.fileName}">📁 ${shortPath}</div>`;
    } else if (info.detail) {
      html += `<div style="color: #888; font-size: 9px; margin-top: 2px; word-break: break-all;">${info.detail}</div>`;
    }
    
    // Debug info for troubleshooting
    if (info.isFromNodeModules !== undefined) {
      const debugColor = info.isFromNodeModules ? '#ff5252' : '#69f0ae';
      html += `<div style="color: ${debugColor}; font-size: 8px; margin-top: 2px;">`;
      html += info.isFromNodeModules ? '⚠️ From node_modules/framework' : '✓ From your code';
      html += `</div>`;
    }
    
    html += `</div>`;
    
    // Show all user components found (in hierarchical order)
    if (info.allUserComponents && info.allUserComponents.length > 0) {
      html += `<div style="margin-bottom: 12px; padding: 8px; background: rgba(76, 175, 80, 0.1); border-radius: 4px; border-left: 3px solid #4caf50;">`;
      html += `<div class="toggle-section" style="color: #4caf50; font-size: 10px; font-weight: bold; margin-bottom: 0px; cursor: pointer;">▶ Your Components (${info.allUserComponents.length})</div>`;
      
      html += `<div style="display: none; margin-top: 4px;">`;
      if (info.allUserComponents.length === 1) {
        html += `<div style="font-size: 10px; color: #a5d6a7;">${info.allUserComponents[0]}</div>`;
      } else {
        // Reverse to show outermost first
        const reversed = [...info.allUserComponents].reverse();
        html += `<div style="font-size: 10px; color: #a5d6a7;">`;
        reversed.forEach((comp, i) => {
          const indent = '  '.repeat(i);
          const arrow = i === 0 ? '📦 ' : '└─ ';
          html += `<div style="margin: 2px 0;">${indent}${arrow}${comp}</div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
      html += `</div>`;
    }
    
    // Hierarchy - only show if meaningful
    if (info.hierarchy && info.hierarchy.length > 1 && info.hierarchy.length <= 10) {
      html += `<div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">`;
      html += `<div class="toggle-section" style="color: #888; font-size: 9px; margin-bottom: 0px; cursor: pointer;">▶ Hierarchy (${info.hierarchy.length})</div>`;
      html += `<div style="font-size: 10px; color: #90caf9; display: none; margin-top: 4px;">${info.hierarchy.join(' → ')}</div>`;
      html += `</div>`;
    }
    
    // Props (read-only)
    if (info.props && Object.keys(info.props).length > 0) {
      const propsKeys = Object.keys(info.props).filter(k => k !== 'children');
      if (propsKeys.length > 0) {
        html += `<div class="toggle-section" style="color: #ffa726; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(255,167,38,0.3); cursor: pointer;">▶ Props (${propsKeys.length}) 🔒</div>`;
        html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;
        propsKeys.forEach(key => {
          const value = formatValue(info.props[key]);
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<div style="display: flex; align-items: start; gap: 8px;">`;
          html += `<span style="color: #ce93d8; font-weight: bold; min-width: 60px;">${key}:</span>`;
          html += `<span style="flex: 1; word-break: break-all; color: #ffb74d; opacity: 0.7;" title="Read-only. Edit parent state above to change this.">${value}</span>`;
          html += `</div>`;
          html += `</div>`;
        });
        html += `</div>`;
      }
    }
    
    // State (if exists) - editable like hooks
    if (info.state && typeof info.state === 'object' && Object.keys(info.state).length > 0) {
      const stateKeys = Object.keys(info.state);
      html += `<div class="toggle-section" style="color: #ab47bc; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(171,71,188,0.3); cursor: pointer;">▶ State (${stateKeys.length}) ✏️</div>`;
      html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;
      stateKeys.forEach((key, i) => {
        let displayValue;
        const stateValue = info.state[key];
        
        if (typeof stateValue === 'string') {
          displayValue = `"${stateValue}"`;
        } else if (stateValue === null) {
          displayValue = 'null';
        } else if (stateValue === undefined) {
          displayValue = 'undefined';
        } else if (typeof stateValue === 'number' || typeof stateValue === 'boolean') {
          displayValue = String(stateValue);
        } else {
          try {
            displayValue = JSON.stringify(stateValue, null, 2);
          } catch (err) {
            displayValue = '{Object}';
          }
        }
        
        html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
        html += `<div style="color: #ce93d8; font-weight: bold; margin-bottom: 4px;">${key}:</div>`;
        html += `<div class="editable-state" data-state-key="${key}" contenteditable="true" spellcheck="false" style="color: #ba68c8; font-size: 11px; white-space: pre-wrap; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid transparent; border-radius: 3px; cursor: text; font-family: 'Courier New', monospace; transition: all 0.2s; max-height: 400px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(171,71,188,0.5) rgba(0,0,0,0.3);" title="Edit directly (Enter to save, Esc to cancel)">${escapeHtml(displayValue)}</div>`;
        html += `</div>`;
      });
      html += `</div>`;
    }
    
    // State/Hooks (editable)
    if (info.hooks && info.hooks.length > 0) {
      html += `<div class="toggle-section" style="color: #66bb6a; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(102,187,106,0.3); cursor: pointer;">▶ Hooks (${info.hooks.length}) ✏️</div>`;
      html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;
      info.hooks.forEach((hook, i) => {
        // Format value for display and editing
        let displayValue;
        const hookValue = hook.value;
        
        if (typeof hookValue === 'string') {
          displayValue = `"${hookValue}"`;
        } else if (hookValue === null) {
          displayValue = 'null';
        } else if (hookValue === undefined) {
          displayValue = 'undefined';
        } else if (typeof hookValue === 'number' || typeof hookValue === 'boolean') {
          displayValue = String(hookValue);
        } else {
          // For objects and arrays, show full JSON
          try {
            displayValue = JSON.stringify(hookValue, null, 2);
          } catch (err) {
            displayValue = '{Object}';
          }
        }
        
        html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
        html += `<div style="color: #81c784; font-weight: bold; margin-bottom: 4px;">Hook ${i}:</div>`;
        html += `<div class="editable-hook" data-hook-index="${i}" contenteditable="true" spellcheck="false" style="color: #a5d6a7; font-size: 11px; white-space: pre-wrap; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid transparent; border-radius: 3px; cursor: text; font-family: 'Courier New', monospace; transition: all 0.2s; max-height: 400px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(102,187,106,0.5) rgba(0,0,0,0.3);" title="Edit directly (Enter to save, Esc to cancel)">${escapeHtml(displayValue)}</div>`;
        html += `</div>`;
      });
      html += `</div>`;
    }
    
    // CSS
    if (info.css) {
      const css = info.css;
      const hasClasses = css.classes && css.classes.length > 0;
      const hasInlineStyles = css.inlineStyles && css.inlineStyles.trim().length > 0;
      const hasMatchedRules = css.matchedRules && css.matchedRules.length > 0;
      
      if (hasClasses || hasInlineStyles || hasMatchedRules) {
        html += `<div class="toggle-section" style="color: #42a5f5; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(66,165,245,0.3); cursor: pointer;">▶ CSS</div>`;
        html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;
        
        if (hasClasses) {
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<span style="color: #64b5f6; font-weight: bold;">Classes:</span><br/>`;
          html += `<div style="margin-top: 4px; color: #90caf9;">${css.classes.map(c => `<span class="toggle-class" data-class="${c}" data-active="true" style="background: rgba(66,165,245,0.2); padding: 2px 6px 2px 6px; border-radius: 2px; margin: 2px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s;" title="Click to disable/enable" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'"><span>${c}</span><span class="delete-class" data-class="${c}" style="color: #ff5252; font-weight: bold; font-size: 11px; line-height: 1; padding: 0 2px;" title="Delete" onclick="event.stopPropagation();">×</span></span>`).join('')}</div>`;
          html += `<button class="add-class" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 4px;">+ Add Class</button>`;
          html += `</div>`;
        }
        
        if (hasInlineStyles) {
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<span style="color: #64b5f6; font-weight: bold;">Inline Styles:</span><br/>`;
          
          // Parse inline styles into individual properties
          const styleProps = css.inlineStyles.split(';').filter(s => s.trim());
          html += `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">`;
          styleProps.forEach(prop => {
            const colonIndex = prop.indexOf(':');
            if (colonIndex > 0) {
              const key = prop.substring(0, colonIndex).trim();
              const value = prop.substring(colonIndex + 1).trim();
              if (key && value) {
                const isImportant = value.includes('!important');
                const cleanValue = value.replace('!important', '').trim();
                const escapedKey = escapeHtml(key);
                const escapedValue = escapeHtml(value);
                html += `<span class="toggle-style" data-style-prop="${escapedKey}" data-style-value="${escapedValue}" data-use-important="${isImportant}" data-active="true" style="background: rgba(144,202,249,0.2); padding: 3px 8px 3px 8px; border-radius: 3px; font-size: 10px; cursor: pointer; transition: all 0.2s; color: #90caf9; display: inline-flex; align-items: center; gap: 4px;" title="Click to disable/enable, Right-click to toggle !important" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'"><span><span style="color: #64b5f6; font-weight: bold;">${escapedKey}</span>: ${escapedValue}</span><span class="delete-style" data-style-prop="${escapedKey}" style="color: #ff5252; font-weight: bold; font-size: 12px; line-height: 1; padding: 0 2px;" title="Delete" onclick="event.stopPropagation();">×</span></span>`;
              }
            }
          });
          html += `</div>`;
          html += `<button class="add-inline-style" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 6px;">+ Add Style (Shift+Enter for !important)</button>`;
          html += `</div>`;
        } else {
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<span style="color: #64b5f6; font-weight: bold;">Inline Styles:</span><br/>`;
          html += `<button class="add-inline-style" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 4px;">+ Add Style (Shift+Enter for !important)</button>`;
          html += `</div>`;
        }
        
        // Applied Styles - Chrome DevTools style
        html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
        html += `<div class="toggle-section" style="color: #64b5f6; font-weight: bold; cursor: pointer; margin-bottom: 0px;">▶ Applied Styles</div>`;
        html += `<div class="computed-styles-content" style="display: none; margin-top: 8px; max-height: 50vh; overflow-y: auto; font-size: 9px; font-family: monospace; scrollbar-width: thin; scrollbar-color: rgba(100,181,246,0.3) rgba(0,0,0,0.2);">`;
        const computedStyles = ['display', 'position', 'width', 'height', 'margin', 'padding', 'background-color', 'color', 'font-size', 'font-family', 'font-weight', 'border', 'border-radius', 'flex-direction', 'justify-content', 'align-items', 'grid-template-columns', 'z-index', 'opacity', 'overflow', 'text-align', 'line-height', 'box-sizing', 'cursor', 'pointer-events', 'transform', 'transition'];
        computedStyles.forEach(prop => {
          const value = css.styles[prop] || css.styles[prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase())];
          if (value) {
            html += `<div class="computed-style-item" data-style-prop="${escapeHtml(prop)}" data-style-value="${escapeHtml(value)}" data-active="true" style="padding: 2px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: all 0.2s;" title="Click to disable/enable" onmouseover="this.style.background='rgba(100,181,246,0.1)'" onmouseout="this.style.background='transparent'"><span style="color: #ce93d8;">${prop}</span>: <span style="color: #a5d6a7;">${value}</span></div>`;
          }
        });
        html += `</div>`;
        html += `</div>`;
        
        if (hasMatchedRules) {
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<div class="toggle-section" style="color: #64b5f6; font-weight: bold; cursor: pointer; margin-bottom: 0px;">▶ Matched CSS Rules (${css.matchedRules.length})</div>`;
          html += `<div class="matched-rules-content" style="display: none; margin-top: 8px; max-height: 50vh; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(100,181,246,0.3) rgba(0,0,0,0.2);">`;
          css.matchedRules.forEach((rule, i) => {
            const source = rule.source === 'inline' ? 'inline' : rule.source.split('/').pop();
            html += `<div style="margin: 8px 0; padding: 6px; background: rgba(0,0,0,0.3); border-left: 2px solid #42a5f5; border-radius: 2px;">`;
            html += `<div style="color: #ffb74d; font-size: 10px; margin-bottom: 4px;">${escapeHtml(rule.selector)}</div>`;
            html += `<div style="color: #666; font-size: 8px; margin-bottom: 4px;">${escapeHtml(source)}</div>`;
            html += `<div style="color: #90caf9; font-size: 9px; font-family: monospace; white-space: pre-wrap;">${escapeHtml(rule.styles)}</div>`;
            html += `</div>`;
          });
          html += `</div>`;
          html += `</div>`;
        }
        
        html += `</div>`;
      }
    }
    
    html += `<div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); color: #666; font-size: 9px; text-align: center;">`;
    html += `Alt+Shift+C to toggle • Alt+Click to ${pinned ? 'unpin' : 'pin'}`;
    html += `</div>`;
    
    return html;
  }
  
  function formatValue(value) {
    if (value === null) return '<span style="color: #999;">null</span>';
    if (value === undefined) return '<span style="color: #999;">undefined</span>';
    if (typeof value === 'string') return `<span style="color: #a5d6a7;">"${value}"</span>`;
    if (typeof value === 'number') return `<span style="color: #90caf9;">${value}</span>`;
    if (typeof value === 'boolean') return `<span style="color: #ce93d8;">${value}</span>`;
    if (Array.isArray(value)) return `<span style="color: #999;">[Array(${value.length})]</span>`;
    if (typeof value === 'object') {
      try {
        const str = JSON.stringify(value, null, 2);
        if (str.length > 100) return `<span style="color: #999;">{Object}</span>`;
        return `<span style="color: #999;">${str}</span>`;
      } catch {
        return `<span style="color: #999;">{Object}</span>`;
      }
    }
    return String(value);
  }

  // Hide overlay
  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
    }
    currentTarget = null;
  }

  // Handle hover events (throttled)
  function handleMouseMove(event) {
    if (!isEnabled) return;
    if (isPinned) return; // Don't update when pinned

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    const target = event.target;
    if (!target || target === overlay || overlay?.contains(target)) {
      return;
    }

    // Update panel position even if same target (follow mouse)
    if (currentTarget && overlay && overlay.style.display !== 'none') {
      const panel = overlay.querySelector('.hovercomp-panel');
      if (panel) {
        const panelRect = panel.getBoundingClientRect();
        const panelWidth = panelRect.width || 400;
        let panelHeight = panelRect.height || 600;
        const spacing = 20;
        const margin = 10;
        const maxHeight = window.innerHeight - margin * 2;
        
        // Limit panel height to viewport
        if (panelHeight > maxHeight) {
          panelHeight = maxHeight;
          panel.style.maxHeight = `${maxHeight}px`;
          panel.style.overflowY = 'auto';
        }
        
        let left = mouseX + spacing;
        let top = mouseY - 20; // Slightly above mouse cursor
        
        // If not enough space on right, show on left
        if (left + panelWidth > window.innerWidth - margin) {
          left = mouseX - panelWidth - spacing;
        }
        
        // Keep left within bounds
        if (left < margin) {
          left = margin;
        }
        
        // Keep top within bounds - if not enough space below, show above
        if (top + panelHeight > window.innerHeight - margin) {
          // Try to position above mouse cursor
          const topAbove = mouseY - panelHeight - 20;
          if (topAbove >= margin) {
            top = topAbove;
          } else {
            // Not enough space above or below, fit to viewport
            top = margin;
            const availableHeight = window.innerHeight - margin * 2;
            panel.style.maxHeight = `${availableHeight}px`;
            panel.style.overflowY = 'auto';
          }
        }
        
        if (top < margin) {
          top = margin;
        }
        
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      }
    }

    const now = Date.now();
    if (now - lastHoverTime < THROTTLE_MS) return;
    lastHoverTime = now;

    if (currentTarget === target) {
      return;
    }

    currentTarget = target;
    const xpath = getXPath(target);

    // Store mouse position for overlay positioning
    currentTarget._mouseX = mouseX;
    currentTarget._mouseY = mouseY;

    // Request component info from inpage script
    window.postMessage(
      {
        type: 'GET_COMPONENT_INFO',
        targetPath: xpath,
      },
      '*'
    );
  }

  // Handle component info response
  function handleComponentInfoResponse(event) {
    if (event.source !== window) return;
    
    if (event.data.type === 'COMPONENT_INFO_RESPONSE') {
      const { componentInfo } = event.data;

      if (currentTarget && isEnabled) {
        const mouseX = currentTarget._mouseX || null;
        const mouseY = currentTarget._mouseY || null;
        updateOverlay(currentTarget, componentInfo, mouseX, mouseY);
      }
    } else if (event.data.type === 'UPDATE_SUCCESS') {
      console.log('[HoverComp] Value updated successfully');
      // Refresh the overlay
      if (currentTarget) {
        const xpath = getXPath(currentTarget);
        window.postMessage(
          {
            type: 'GET_COMPONENT_INFO',
            targetPath: xpath,
          },
          '*'
        );
      }
    } else if (event.data.type === 'UPDATE_ERROR') {
      console.error('[HoverComp] Update failed:', event.data.error);
    }
  }

  // Handle click for pinning (Alt+Click)
  function handleClick(event) {
    if (!isEnabled) return;
    if (!event.altKey) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    if (isPinned) {
      // Unpin
      isPinned = false;
      pinnedPosition = null;
      console.log('[HoverComp] Unpinned');
    } else {
      // Pin at current position
      if (overlay && overlay.style.display !== 'none') {
        const panel = overlay.querySelector('.hovercomp-panel');
        isPinned = true;
        pinnedPosition = {
          x: parseInt(panel.style.left),
          y: parseInt(panel.style.top)
        };
        console.log('[HoverComp] Pinned at', pinnedPosition);
      }
    }
    
    // Refresh overlay to show pinned state
    if (currentTarget) {
      const xpath = getXPath(currentTarget);
      window.postMessage(
        {
          type: 'GET_COMPONENT_INFO',
          targetPath: xpath,
        },
        '*'
      );
    }
  }

  // Toggle extension on/off
  function toggleEnabled() {
    isEnabled = !isEnabled;
    if (!isEnabled) {
      hideOverlay();
      isPinned = false;
      pinnedPosition = null;
    }
    console.log(`[HoverComp Dev Inspector] ${isEnabled ? 'Enabled' : 'Disabled'}`);
  }

  // Keyboard shortcut handler (Alt+Shift+C)
  function handleKeyDown(event) {
    if (event.altKey && event.shiftKey && event.code === 'KeyC') {
      event.preventDefault();
      toggleEnabled();
    }
  }

  // Initialize
  function init() {
    // Inject inpage script
    injectInPageScript();

    // Set up event listeners
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('mouseout', (event) => {
      if (!isPinned && (!event.relatedTarget || event.relatedTarget === document.documentElement)) {
        hideOverlay();
      }
    });
    window.addEventListener('message', handleComponentInfoResponse);
    document.addEventListener('keydown', handleKeyDown, true);

    console.log('[HoverComp Dev Inspector] Content script loaded');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      getXPath,
      updateOverlay,
      hideOverlay,
      toggleEnabled,
      handleMouseMove,
    };
  }
})();
