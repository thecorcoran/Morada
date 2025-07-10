import { uiManager } from './uiManager.js';

// Mock the constants module
jest.mock('./constants.js', () => ({
  KeyConstants: {
    ENTER: 'Enter',
  }
}));

// Mock the global Sortable library as it's not needed for these tests
global.Sortable = {
  create: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
};

describe('UIManager', () => {
  let mockConfig;

  // Set up the mock DOM and dependencies before each test
  beforeEach(() => {
    // Create a mock DOM structure based on index.html
    document.body.innerHTML = `
      <div id="breadcrumb-bar"></div>
      <h2 id="view-title"></h2>
      <div id="outliner-sidebar" class="hidden">
        <div id="outliner-list"></div>
      </div>
      <div id="search-palette" class="hidden">
        <input type="text" id="search-input">
        <div id="search-results"></div>
      </div>
      <div id="canvas-context-menu" class="hidden"></div>
      <div id="compendium-modal" class="hidden">
        <input type="text" id="compendium-filter">
        <button id="close-compendium-btn"></button>
        <div id="compendium-library"></div>
        <div id="compendium-manuscript"></div>
        <input type="checkbox" id="include-comments-checkbox">
        <input type="checkbox" id="include-certified-words-checkbox">
        <button id="generate-btn"></button>
      </div>
      <div id="editor-mode" class="hidden">
        <div id="editor-inspector-sidebar">
            <div id="tag-list"></div>
            <input type="text" id="tag-input">
        </div>
      </div>
    `;

    // Create mock dependencies
    mockConfig = {
      rootNodes: [
        { id: 'root1', title: 'Book A', type: 'container', children: [
            { id: 'child1', title: 'Chapter 1', type: 'text', content: 'Some content here.', tags: ['draft'] }
        ]},
        { id: 'root2', title: 'Loose Leaf', type: 'text', content: 'Just a note.', tags: [] }
      ],
      viewStack: [],
      selectedNode: null,
      manuscriptList: [],
      drawFunction: jest.fn(),
      saveNodesFunction: jest.fn().mockResolvedValue(undefined),
      navigateToNodeFunction: jest.fn(),
      createTitleEditorFunction: jest.fn(),
      openScriptoriumCallback: jest.fn(),
    };

    // Initialize the manager for each test
    uiManager.init(mockConfig);
  });

  describe('Initialization', () => {
    it('should get all DOM elements on init', () => {
      expect(uiManager.breadcrumbBar).not.toBeNull();
      expect(uiManager.searchPalette).not.toBeNull();
      expect(uiManager.outlinerSidebar).not.toBeNull();
    });

    it('should assign all dependencies on init', () => {
      expect(uiManager.rootNodes).toBe(mockConfig.rootNodes);
      expect(uiManager.saveNodesFunction).toBe(mockConfig.saveNodesFunction);
    });
  });

  describe('UI Chrome & Outliner', () => {
    it('should update breadcrumbs and title for root view', () => {
      uiManager.updateUIChrome();
      expect(uiManager.breadcrumbBar.textContent).toBe('The Grounds');
      expect(uiManager.viewTitle.textContent).toBe('The Castle Grounds');
      expect(uiManager.outlinerSidebar.classList.contains('hidden')).toBe(true);
    });

    it('should update breadcrumbs and title for a nested view', () => {
      uiManager.viewStack = [{ id: 'root1', title: 'Book A' }];
      uiManager.updateUIChrome();
      expect(uiManager.breadcrumbBar.textContent).toBe('The Grounds / Book A');
      expect(uiManager.viewTitle.textContent).toBe('Book A');
      expect(uiManager.outlinerSidebar.classList.contains('hidden')).toBe(false);
    });

    it('should render scriptoriums in the outliner', () => {
      const nodes = [
        { id: 's1', title: 'Scriptorium 1', type: 'text' },
        { id: 'c1', title: 'Container 1', type: 'container' },
        { id: 's2', title: 'Scriptorium 2', type: 'text' },
      ];
      uiManager.renderOutliner(nodes);
      const items = uiManager.outlinerList.querySelectorAll('.outliner-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toBe('Scriptorium 1');
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce search input', () => {
      const searchSpy = jest.spyOn(uiManager, 'search');
      
      uiManager.searchInput.value = 'ab'; // length > 1
      uiManager.searchInput.dispatchEvent(new Event('input'));
      uiManager.searchInput.value = 'abc';
      uiManager.searchInput.dispatchEvent(new Event('input'));

      expect(searchSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300); // Advance past the 250ms debounce

      expect(searchSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy).toHaveBeenCalledWith('abc');
    });

    it('should find a node by title', () => {
      const results = uiManager.search('Book A');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('root1');
    });

    it('should find a node by content', () => {
      const results = uiManager.search('content');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('child1');
    });

    it('should find a node by tag', () => {
      const results = uiManager.search('#draft');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('child1');
    });

    it('should display search results in the DOM', () => {
      const mockResults = [{ id: '1', title: 'Result 1', path: [] }];
      uiManager.displayResults(mockResults);
      const resultItems = document.querySelectorAll('.search-result-item');
      expect(resultItems.length).toBe(1);
      expect(resultItems[0].querySelector('.result-text').textContent).toBe('Result 1');
    });
  });

  describe('Compendium', () => {
    it('should open and close the compendium modal', () => {
      expect(uiManager.isCompendiumOpen()).toBe(false);
      uiManager.openCompendium();
      expect(uiManager.isCompendiumOpen()).toBe(true);
      expect(uiManager.compendiumModal.classList.contains('hidden')).toBe(false);
      uiManager.closeCompendium();
      expect(uiManager.isCompendiumOpen()).toBe(false);
      expect(uiManager.compendiumModal.classList.contains('hidden')).toBe(true);
    });

    it('should add and remove items from the manuscript list', () => {
      uiManager.openCompendium(); // This renders the initial tree
      
      const libraryItem = uiManager.compendiumLibrary.querySelector('li[data-node-id="child1"]');
      expect(libraryItem).not.toBeNull();

      // Add to manuscript
      libraryItem.click();
      expect(uiManager.manuscriptList).toContain('child1');
      
      // Remove from manuscript
      libraryItem.click();
      expect(uiManager.manuscriptList).not.toContain('child1');
    });
  });

  describe('Context Menu', () => {
    it('should show a context menu with dynamic items', () => {
      const mockAction = jest.fn();
      const menuItems = [
        { label: 'Rename', action: mockAction },
        { type: 'separator' },
        { label: 'Delete', action: jest.fn(), disabled: true },
      ];

      uiManager.showContextMenu(100, 150, menuItems);

      const menu = document.getElementById('canvas-context-menu');
      expect(menu.classList.contains('hidden')).toBe(false);
      expect(menu.style.left).toBe('100px');
      
      const items = menu.querySelectorAll('li');
      expect(items.length).toBe(3);
      expect(items[0].textContent).toBe('Rename');
      expect(items[1].classList.contains('context-menu-separator')).toBe(true);
      expect(items[2].classList.contains('disabled')).toBe(true);

      // Test action
      items[0].click();
      expect(mockAction).toHaveBeenCalled();
      expect(menu.classList.contains('hidden')).toBe(true); // Should hide after click
    });
  });
});