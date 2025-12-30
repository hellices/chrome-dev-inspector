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
      max-height: 80vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 2147483647;
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
    
    // Position panel based on pinned state
    if (isPinned && pinnedPosition) {
      panel.style.left = `${pinnedPosition.x}px`;
      panel.style.top = `${pinnedPosition.y}px`;
      panel.style.transform = 'none';
      panel.style.border = '2px solid #4caf50';
    } else if (mouseX && mouseY) {
      // Position to the right of mouse cursor
      const panelWidth = 400; // approximate
      const panelHeight = 600; // approximate
      const spacing = 20;
      
      let left = mouseX + spacing;
      let top = mouseY;
      
      // Keep panel within viewport
      if (left + panelWidth > window.innerWidth) {
        left = mouseX - panelWidth - spacing; // Show on left if no space on right
      }
      
      if (top + panelHeight > window.innerHeight) {
        top = window.innerHeight - panelHeight - 20;
      }
      
      if (top < 20) {
        top = 20;
      }
      
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.transform = 'none';
      panel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    }
    
    panel.innerHTML = formatComponentInfo(componentInfo, isPinned);
    
    // Add click handlers for expand/collapse
    panel.querySelectorAll('.toggle-section').forEach(toggle => {
      toggle.style.cursor = 'pointer';
      toggle.onclick = (e) => {
        e.stopPropagation();
        const content = toggle.nextElementSibling;
        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? 'block' : 'none';
        toggle.textContent = toggle.textContent.replace(isCollapsed ? '▶' : '▼', isCollapsed ? '▼' : '▶');
      };
    });
    
    // Props are read-only - no editing allowed
    
    // Add inline editing for parent states
    panel.querySelectorAll('.editable-parent-state').forEach(span => {
      span.setAttribute('contenteditable', 'true');
      span.setAttribute('spellcheck', 'false');
      
      // Store original value
      const originalValue = span.textContent;
      
      // Focus handler
      span.onfocus = (e) => {
        e.stopPropagation();
        span.style.background = 'rgba(171,71,188,0.4)';
        span.style.outline = '1px solid #ab47bc';
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      };
      
      // Blur handler - save changes
      span.onblur = (e) => {
        span.style.background = 'rgba(171,71,188,0.2)';
        span.style.outline = 'none';
        
        const newValue = span.textContent.trim();
        if (newValue !== originalValue) {
          const hookIndex = span.getAttribute('data-hook-index');
          const depth = span.getAttribute('data-depth');
          const xpath = getXPath(element);
          window.postMessage({
            type: 'UPDATE_PARENT_STATE',
            targetPath: xpath,
            hookIndex: parseInt(hookIndex),
            depth: parseInt(depth),
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
              // Refresh overlay
              const xpath = getXPath(element);
              window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
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
        code.style.background = 'rgba(66,165,245,0.3)';
        code.style.outline = '1px solid #42a5f5';
      };
      
      // Blur handler - save changes
      code.onblur = (e) => {
        code.style.background = 'transparent';
        code.style.outline = 'none';
        
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
        
        // Create editable code element
        const code = document.createElement('code');
        code.contentEditable = 'true';
        code.spellcheck = false;
        code.textContent = 'color: ; ';
        code.style.cssText = 'margin-top: 4px; color: #90caf9; display: block; word-break: break-all; cursor: text; padding: 4px; border-radius: 2px; background: rgba(66,165,245,0.3); outline: 1px solid #42a5f5;';
        
        // Replace button with code element
        btn.parentNode.insertBefore(code, btn);
        btn.style.display = 'none';
        
        // Focus and select text
        code.focus();
        const range = document.createRange();
        range.selectNodeContents(code);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Save on Enter
        code.onkeydown = (keyEvent) => {
          if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
            keyEvent.preventDefault();
            const newStyle = code.textContent.trim();
            if (newStyle) {
              element.style.cssText = newStyle;
              // Refresh overlay
              const xpath = getXPath(element);
              window.postMessage({ type: 'GET_COMPONENT_INFO', targetPath: xpath }, '*');
            } else {
              // Restore button if empty
              btn.style.display = '';
              code.remove();
            }
          }
          if (keyEvent.key === 'Escape') {
            keyEvent.preventDefault();
            btn.style.display = '';
            code.remove();
          }
          keyEvent.stopPropagation();
        };
        
        // Cancel on blur
        code.onblur = () => {
          setTimeout(() => {
            btn.style.display = '';
            code.remove();
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
    
    // Parent States (editable source of props)
    if (info.parentStates && info.parentStates.length > 0) {
      html += `<div class="toggle-section" style="color: #ab47bc; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(171,71,188,0.3); cursor: pointer;">▶ Parent States (${info.parentStates.length}) ✏️</div>`;
      html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;
      info.parentStates.forEach((parentState, i) => {
        const value = formatValue(parentState.value);
        const rawValue = JSON.stringify(parentState.value);
        html += `<div style="margin: 6px 0; padding: 6px; background: rgba(171,71,188,0.1); border-radius: 3px; border-left: 2px solid #ab47bc;">`;
        html += `<div style="color: #ba68c8; font-size: 9px; margin-bottom: 4px;">${parentState.parentComponent} (level ${parentState.depth}) - State ${parentState.stateIndex}</div>`;
        html += `<div style="display: flex; align-items: start; gap: 8px;">`;
        html += `<span style="color: #ce93d8; font-weight: bold; min-width: 60px;">Value:</span>`;
        html += `<span class="editable-parent-state" data-hook-index="${parentState.hookIndex}" data-depth="${parentState.depth}" data-value="${escapeHtml(rawValue)}" style="flex: 1; word-break: break-all; cursor: text; padding: 2px 4px; border-radius: 2px; transition: background 0.2s; background: rgba(171,71,188,0.2);" title="Click to edit parent state (Enter to save, Esc to cancel)">${value}</span>`;
        html += `</div>`;
        html += `</div>`;
      });
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
    
    // State/Hooks
    if (info.hooks && info.hooks.length > 0) {
      html += `<div class="toggle-section" style="color: #66bb6a; margin-top: 12px; font-weight: bold; padding: 6px 0; border-bottom: 1px solid rgba(102,187,106,0.3); cursor: pointer;">▶ Hooks (${info.hooks.length})</div>`;
      html += `<div style="margin-left: 0; margin-top: 8px; font-size: 10px; display: none;">`;
      info.hooks.forEach((hook, i) => {
        const value = formatValue(hook.value);
        html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;"><span style="color: #81c784; font-weight: bold;">Hook ${i}:</span> <span style="word-break: break-all;">${value}</span></div>`;
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
          html += `<div style="margin-top: 4px; color: #90caf9;">${css.classes.map(c => `<span class="toggle-class" data-class="${c}" data-active="true" style="background: rgba(66,165,245,0.2); padding: 2px 6px; border-radius: 2px; margin: 2px; display: inline-block; cursor: pointer; transition: all 0.2s;" title="Click to disable/enable" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">${c}</span>`).join('')}</div>`;
          html += `<button class="add-class" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 4px;">+ Add Class</button>`;
          html += `</div>`;
        }
        
        if (hasInlineStyles) {
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<span style="color: #64b5f6; font-weight: bold;">Inline Styles:</span><br/>`;
          html += `<code class="editable-style" data-type="inline" style="margin-top: 4px; color: #90caf9; display: block; word-break: break-all; cursor: text; padding: 4px; border-radius: 2px; background: rgba(255,255,255,0.05);" title="Click to edit inline (Enter to save, Esc to cancel)">${css.inlineStyles}</code>`;
          html += `</div>`;
        } else {
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<span style="color: #64b5f6; font-weight: bold;">Inline Styles:</span><br/>`;
          html += `<button class="add-inline-style" style="background: #1976d2; color: #fff; border: none; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-top: 4px;">+ Add Style</button>`;
          html += `</div>`;
        }
        
        if (hasMatchedRules) {
          html += `<div style="margin: 6px 0; padding: 6px; background: rgba(255,255,255,0.02); border-radius: 3px;">`;
          html += `<span style="color: #64b5f6; font-weight: bold;">Matched Rules:</span> <span style="color: #90caf9;">${css.matchedRules.length}</span>`;
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

    const now = Date.now();
    if (now - lastHoverTime < THROTTLE_MS) return;
    lastHoverTime = now;

    const target = event.target;
    if (!target || target === overlay || overlay?.contains(target)) {
      return;
    }

    if (currentTarget === target) {
      return;
    }

    currentTarget = target;
    const xpath = getXPath(target);
    const mouseX = event.clientX;
    const mouseY = event.clientY;

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
