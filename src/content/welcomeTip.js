/**
 * Welcome Tip - Shows a welcome tip for first-time users
 */

import { OVERLAY_Z_INDEX } from '../config/constants.js';

/**
 * Show welcome tip for first-time users
 */
export function showWelcomeTipIfFirstTime() {
  const hasSeenWelcome = localStorage.getItem('hovercomp-seen-welcome');
  
  if (!hasSeenWelcome) {
    setTimeout(() => {
      const tip = document.createElement('div');
      tip.id = 'hovercomp-welcome-tip';
      tip.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: ${OVERLAY_Z_INDEX + 2};
        background: linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(30, 30, 40, 0.98));
        color: white;
        padding: 24px 32px;
        border-radius: 12px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(97, 218, 251, 0.3);
        backdrop-filter: blur(10px);
        max-width: 450px;
        animation: fadeIn 0.3s ease-in;
      `;
      
      tip.innerHTML = `
        <style>
          @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -45%); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
        </style>
        <div style="text-align: center;">
          <div style="font-size: 32px; margin-bottom: 12px;">👋</div>
          <div style="color: #61dafb; font-size: 16px; font-weight: bold; margin-bottom: 16px;">Welcome to HoverComp Dev Inspector!</div>
          <div style="color: #ccc; line-height: 1.6; margin-bottom: 20px;">
            Hover over any element to inspect components.<br>
            Click the <strong style="color: #61dafb;">🔧 Mode</strong> button in the panel to switch between React, HTML, and other modes.
          </div>
          <div style="color: #888; font-size: 11px; margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <strong>Quick Shortcuts:</strong><br>
            • <span style="color: #61dafb;">Alt+Shift+C</span> — Toggle inspector<br>
            • <span style="color: #61dafb;">Alt+Shift+M</span> — Open mode selector<br>
            • <span style="color: #61dafb;">Alt+Click</span> — Pin/unpin overlay
          </div>
          <button id="hovercomp-welcome-close" style="
            background: linear-gradient(135deg, #61dafb, #4a9cc5);
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: bold;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(97, 218, 251, 0.3);
          ">Got it! 🚀</button>
        </div>
      `;
      
      document.body.appendChild(tip);
      
      const closeBtn = tip.querySelector('#hovercomp-welcome-close');
      closeBtn.addEventListener('click', () => {
        tip.style.animation = 'fadeIn 0.2s ease-out reverse';
        setTimeout(() => {
          tip.remove();
          localStorage.setItem('hovercomp-seen-welcome', 'true');
        }, 200);
      });
      
      closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.transform = 'scale(1.05)';
        closeBtn.style.boxShadow = '0 6px 16px rgba(97, 218, 251, 0.4)';
      });
      closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.transform = 'scale(1)';
        closeBtn.style.boxShadow = '0 4px 12px rgba(97, 218, 251, 0.3)';
      });
    }, 1500);
  }
}
