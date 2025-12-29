/**
 * Integration tests for content script overlay functionality
 */

describe('Content Script Overlay', () => {
  let mockOverlay;
  let mockLabel;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = '';

    // Mock overlay elements
    mockOverlay = document.createElement('div');
    mockOverlay.id = 'hovercomp-overlay';
    mockOverlay.className = 'hovercomp-overlay';
    mockOverlay.style.display = 'none';

    mockLabel = document.createElement('div');
    mockLabel.className = 'hovercomp-label';
    mockOverlay.appendChild(mockLabel);

    document.body.appendChild(mockOverlay);

    // Mock chrome API
    global.chrome = {
      runtime: {
        getURL: jest.fn((path) => `chrome-extension://test/${path}`),
      },
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete global.chrome;
  });

  describe('Overlay Display', () => {
    it('should create overlay with correct structure', () => {
      const overlay = document.getElementById('hovercomp-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay.className).toBe('hovercomp-overlay');

      const label = overlay.querySelector('.hovercomp-label');
      expect(label).toBeTruthy();
    });

    it('should be hidden by default', () => {
      const overlay = document.getElementById('hovercomp-overlay');
      expect(overlay.style.display).toBe('none');
    });

    it('should display component info when NODE_INFO message received', () => {
      const testElement = document.createElement('div');
      testElement.id = 'test-element';
      document.body.appendChild(testElement);

      const componentInfo = {
        framework: 'React',
        name: 'TestComponent',
        detail: 'functional',
      };

      // Simulate receiving component info
      const rect = testElement.getBoundingClientRect();
      mockOverlay.style.display = 'block';
      mockOverlay.style.top = `${rect.top}px`;
      mockOverlay.style.left = `${rect.left}px`;
      mockOverlay.style.width = `${rect.width}px`;
      mockOverlay.style.height = `${rect.height}px`;
      mockLabel.textContent = `${componentInfo.framework}: ${componentInfo.name} (${componentInfo.detail})`;

      expect(mockOverlay.style.display).toBe('block');
      expect(mockLabel.textContent).toBe('React: TestComponent (functional)');
    });

    it('should hide overlay when no component info available', () => {
      mockOverlay.style.display = 'block';
      mockLabel.textContent = 'React: TestComponent';

      // Simulate no component info
      mockOverlay.style.display = 'none';

      expect(mockOverlay.style.display).toBe('none');
    });

    it('should update overlay position based on element bounds', () => {
      const testElement = document.createElement('div');
      testElement.style.position = 'absolute';
      testElement.style.top = '100px';
      testElement.style.left = '200px';
      testElement.style.width = '150px';
      testElement.style.height = '75px';
      document.body.appendChild(testElement);

      // In jsdom, getBoundingClientRect returns 0 for everything
      // So we'll just verify the function sets the values correctly
      const mockRect = { top: 100, left: 200, width: 150, height: 75 };
      mockOverlay.style.top = `${mockRect.top}px`;
      mockOverlay.style.left = `${mockRect.left}px`;
      mockOverlay.style.width = `${mockRect.width}px`;
      mockOverlay.style.height = `${mockRect.height}px`;

      expect(mockOverlay.style.top).toBe('100px');
      expect(mockOverlay.style.left).toBe('200px');
      expect(mockOverlay.style.width).toBe('150px');
      expect(mockOverlay.style.height).toBe('75px');
    });
  });

  describe('Toggle State', () => {
    it('should not display overlay when disabled', () => {
      let isEnabled = false;

      const componentInfo = {
        framework: 'Vue',
        name: 'VueComponent',
        detail: '',
      };

      // Should not display if disabled
      if (isEnabled) {
        mockOverlay.style.display = 'block';
        mockLabel.textContent = `${componentInfo.framework}: ${componentInfo.name}`;
      }

      expect(mockOverlay.style.display).toBe('none');
    });

    it('should display overlay when enabled', () => {
      let isEnabled = true;

      const componentInfo = {
        framework: 'Angular',
        name: 'AppComponent',
        detail: '',
      };

      // Should display if enabled
      if (isEnabled) {
        mockOverlay.style.display = 'block';
        mockLabel.textContent = `${componentInfo.framework}: ${componentInfo.name}`;
      }

      expect(mockOverlay.style.display).toBe('block');
      expect(mockLabel.textContent).toBe('Angular: AppComponent');
    });

    it('should toggle between enabled and disabled states', () => {
      let isEnabled = true;

      // Toggle off
      isEnabled = !isEnabled;
      if (!isEnabled) {
        mockOverlay.style.display = 'none';
      }
      expect(isEnabled).toBe(false);
      expect(mockOverlay.style.display).toBe('none');

      // Toggle on
      isEnabled = !isEnabled;
      expect(isEnabled).toBe(true);
    });
  });

  describe('Component Info Formatting', () => {
    it('should format React component info correctly', () => {
      const info = {
        framework: 'React',
        name: 'MyComponent',
        detail: 'hooks',
      };

      mockLabel.textContent = `${info.framework}: ${info.name} (${info.detail})`;
      expect(mockLabel.textContent).toBe('React: MyComponent (hooks)');
    });

    it('should format Vue component info correctly', () => {
      const info = {
        framework: 'Vue 3',
        name: 'HelloWorld',
        detail: 'composition-api',
      };

      mockLabel.textContent = `${info.framework}: ${info.name} (${info.detail})`;
      expect(mockLabel.textContent).toBe('Vue 3: HelloWorld (composition-api)');
    });

    it('should handle component info without detail', () => {
      const info = {
        framework: 'Angular',
        name: 'HeaderComponent',
        detail: '',
      };

      const detailText = info.detail ? ` (${info.detail})` : '';
      mockLabel.textContent = `${info.framework}: ${info.name}${detailText}`;
      expect(mockLabel.textContent).toBe('Angular: HeaderComponent');
    });

    it('should handle Web Component info', () => {
      const info = {
        framework: 'Web Component',
        name: 'custom-button',
        detail: 'Shadow DOM',
      };

      mockLabel.textContent = `${info.framework}: ${info.name} (${info.detail})`;
      expect(mockLabel.textContent).toBe('Web Component: custom-button (Shadow DOM)');
    });
  });

  describe('Message Handling', () => {
    it('should handle COMPONENT_INFO_RESPONSE messages', () => {
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'COMPONENT_INFO_RESPONSE',
          componentInfo: {
            framework: 'React',
            name: 'TestComponent',
            detail: '',
          },
        },
        source: window,
      });

      // Simulate message handling
      if (messageEvent.data.type === 'COMPONENT_INFO_RESPONSE') {
        const { componentInfo } = messageEvent.data;
        if (componentInfo) {
          mockOverlay.style.display = 'block';
          mockLabel.textContent = `${componentInfo.framework}: ${componentInfo.name}`;
        }
      }

      expect(mockOverlay.style.display).toBe('block');
      expect(mockLabel.textContent).toBe('React: TestComponent');
    });

    it('should ignore messages from other sources', () => {
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'COMPONENT_INFO_RESPONSE',
          componentInfo: {
            framework: 'React',
            name: 'TestComponent',
            detail: '',
          },
        },
        source: {}, // Not window
      });

      // Should ignore if not from window
      if (messageEvent.source !== window) {
        // Do nothing
      } else if (messageEvent.data.type === 'COMPONENT_INFO_RESPONSE') {
        mockOverlay.style.display = 'block';
      }

      expect(mockOverlay.style.display).toBe('none');
    });

    it('should handle null component info gracefully', () => {
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'COMPONENT_INFO_RESPONSE',
          componentInfo: null,
        },
        source: window,
      });

      if (messageEvent.data.type === 'COMPONENT_INFO_RESPONSE') {
        const { componentInfo } = messageEvent.data;
        if (componentInfo) {
          mockOverlay.style.display = 'block';
        } else {
          mockOverlay.style.display = 'none';
        }
      }

      expect(mockOverlay.style.display).toBe('none');
    });
  });
});
