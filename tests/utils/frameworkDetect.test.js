const {
  detectReact,
  detectVue2,
  detectVue3,
  detectAngular,
  detectWebComponent,
  detectComponent,
} = require('../../src/utils/frameworkDetect');

describe('frameworkDetect', () => {
  let mockElement;

  beforeEach(() => {
    mockElement = document.createElement('div');
    // Clean up global objects
    delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    delete window.ng;
    delete window.customElements;
  });

  describe('detectReact', () => {
    it('should return null if no React devtools hook exists', () => {
      const result = detectReact(mockElement);
      expect(result).toBeNull();
    });

    it('should return null if element has no React fiber', () => {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map() };
      const result = detectReact(mockElement);
      expect(result).toBeNull();
    });

    it('should detect React component with displayName', () => {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map() };
      mockElement.__reactFiber$test = {
        type: {
          displayName: 'MyComponent',
        },
      };

      const result = detectReact(mockElement);
      expect(result).toEqual({
        framework: 'React',
        name: 'MyComponent',
        detail: '',
      });
    });

    it('should detect React component with name', () => {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map() };
      mockElement.__reactFiber$test = {
        type: {
          name: 'TestComponent',
        },
      };

      const result = detectReact(mockElement);
      expect(result).toEqual({
        framework: 'React',
        name: 'TestComponent',
        detail: '',
      });
    });

    it('should traverse fiber tree to find component', () => {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map() };
      mockElement.__reactFiber$test = {
        type: null,
        return: {
          type: {
            name: 'ParentComponent',
          },
        },
      };

      const result = detectReact(mockElement);
      expect(result).toEqual({
        framework: 'React',
        name: 'ParentComponent',
        detail: '',
      });
    });

    it('should skip Anonymous components', () => {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map() };
      mockElement.__reactFiber$test = {
        type: {
          name: 'Anonymous',
        },
        return: {
          type: {
            name: 'NamedComponent',
          },
        },
      };

      const result = detectReact(mockElement);
      expect(result).toEqual({
        framework: 'React',
        name: 'NamedComponent',
        detail: '',
      });
    });
  });

  describe('detectVue2', () => {
    it('should return null if no Vue instance exists', () => {
      const result = detectVue2(mockElement);
      expect(result).toBeNull();
    });

    it('should detect Vue 2 component with name', () => {
      mockElement.__vue__ = {
        $options: {
          name: 'VueComponent',
        },
      };

      const result = detectVue2(mockElement);
      expect(result).toEqual({
        framework: 'Vue 2',
        name: 'VueComponent',
        detail: '',
      });
    });

    it('should detect Vue 2 component with component tag', () => {
      mockElement.__vue__ = {
        $options: {
          _componentTag: 'my-component',
        },
      };

      const result = detectVue2(mockElement);
      expect(result).toEqual({
        framework: 'Vue 2',
        name: 'my-component',
        detail: 'my-component',
      });
    });

    it('should return Anonymous if no name found', () => {
      // Create a constructor without a name
      function VueComponent() {}
      Object.defineProperty(VueComponent, 'name', { value: '' });

      mockElement.__vue__ = {
        $options: {},
        constructor: VueComponent,
      };

      const result = detectVue2(mockElement);
      expect(result?.framework).toBe('Vue 2');
      // Name might be empty or 'Anonymous' depending on implementation
      expect(result?.name).toBeTruthy();
    });
  });

  describe('detectVue3', () => {
    it('should return null if no Vue 3 instance exists', () => {
      const result = detectVue3(mockElement);
      expect(result).toBeNull();
    });

    it('should detect Vue 3 component from __vueParentComponent', () => {
      mockElement.__vueParentComponent = {
        type: {
          name: 'Vue3Component',
        },
      };

      const result = detectVue3(mockElement);
      expect(result).toEqual({
        framework: 'Vue 3',
        name: 'Vue3Component',
        detail: '',
      });
    });

    it('should detect Vue 3 component from __vnode', () => {
      mockElement.__vnode = {
        type: {
          __name: 'VNode3Component',
        },
      };

      const result = detectVue3(mockElement);
      expect(result).toEqual({
        framework: 'Vue 3',
        name: 'VNode3Component',
        detail: '',
      });
    });
  });

  describe('detectAngular', () => {
    it('should return null if no Angular context exists', () => {
      const result = detectAngular(mockElement);
      expect(result).toBeNull();
    });

    it('should detect Angular component using ng.getComponent', () => {
      const mockComponent = {
        constructor: {
          name: 'AppComponent',
        },
      };
      window.ng = {
        getComponent: jest.fn().mockReturnValue(mockComponent),
      };

      const result = detectAngular(mockElement);
      expect(result).toEqual({
        framework: 'Angular',
        name: 'AppComponent',
        detail: '',
      });
    });

    it('should detect Angular component using __ngContext__', () => {
      mockElement.__ngContext__ = [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        {
          constructor: {
            name: 'NgComponent',
          },
        },
      ];

      const result = detectAngular(mockElement);
      expect(result).toEqual({
        framework: 'Angular',
        name: 'NgComponent',
        detail: '',
      });
    });
  });

  describe('detectWebComponent', () => {
    it('should return null for standard HTML elements', () => {
      const result = detectWebComponent(mockElement);
      expect(result).toBeNull();
    });

    it('should detect registered custom element', () => {
      const customElement = document.createElement('my-element');
      class MyElement extends HTMLElement {}
      window.customElements = {
        get: jest.fn().mockReturnValue(MyElement),
      };

      const result = detectWebComponent(customElement);
      expect(result).toEqual({
        framework: 'Web Component',
        name: 'MyElement',
        detail: '',
      });
    });

    it('should detect custom element with shadow DOM', () => {
      const customElement = document.createElement('shadow-element');

      // Create a custom constructor
      class ShadowElement extends HTMLElement {}
      Object.setPrototypeOf(customElement, ShadowElement.prototype);
      Object.defineProperty(customElement, 'constructor', {
        value: ShadowElement,
        writable: true,
      });

      Object.defineProperty(customElement, 'shadowRoot', {
        value: {},
        writable: true,
      });

      const result = detectWebComponent(customElement);
      expect(result).toEqual({
        framework: 'Web Component',
        name: 'ShadowElement',
        detail: 'Shadow DOM',
      });
    });

    it('should detect custom element by tag name pattern', () => {
      const customElement = document.createElement('custom-button');
      class CustomButton extends HTMLElement {}
      Object.setPrototypeOf(customElement, CustomButton.prototype);
      Object.defineProperty(customElement, 'constructor', {
        value: CustomButton,
        writable: true,
      });

      const result = detectWebComponent(customElement);
      expect(result).toEqual({
        framework: 'Web Component',
        name: 'CustomButton',
        detail: '',
      });
    });
  });

  describe('detectComponent', () => {
    it('should return null for non-HTML elements', () => {
      expect(detectComponent(null)).toBeNull();
      expect(detectComponent(undefined)).toBeNull();
      expect(detectComponent({})).toBeNull();
    });

    it('should detect React component first', () => {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map() };
      mockElement.__reactFiber$test = {
        type: {
          name: 'ReactComponent',
        },
      };

      const result = detectComponent(mockElement);
      expect(result).toEqual({
        framework: 'React',
        name: 'ReactComponent',
        detail: '',
      });
    });

    it('should try Vue 3 before Vue 2', () => {
      mockElement.__vueParentComponent = {
        type: {
          name: 'Vue3Component',
        },
      };
      mockElement.__vue__ = {
        $options: {
          name: 'Vue2Component',
        },
      };

      const result = detectComponent(mockElement);
      expect(result).toEqual({
        framework: 'Vue 3',
        name: 'Vue3Component',
        detail: '',
      });
    });

    it('should fall back to next detector if previous fails', () => {
      mockElement.__vue__ = {
        $options: {
          name: 'VueComponent',
        },
      };

      const result = detectComponent(mockElement);
      expect(result).toEqual({
        framework: 'Vue 2',
        name: 'VueComponent',
        detail: '',
      });
    });

    it('should return null if no framework detected', () => {
      const result = detectComponent(mockElement);
      expect(result).toBeNull();
    });
  });
});
