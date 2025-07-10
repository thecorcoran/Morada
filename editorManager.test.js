// Mock dependencies first
jest.mock('./constants.js', () => ({
  EditorConstants: {
    EDITOR_DEFAULT_FONT_SIZE: '16px',
    EDITOR_DEFAULT_LINE_HEIGHT: '1.5',
    EDITOR_BACKGROUND_COLOR: '#fff',
  },
  KeyConstants: {
    KEY_ESCAPE: 'Escape',
  }
}));

jest.mock('./dataStorage.js', () => ({
  dataStorageManager: {
    saveData: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('./timerManager.js', () => ({
  timerManager: {
    reset: jest.fn(),
  },
}));

import { editorManager } from './editorManager.js';
import { dataStorageManager } from './dataStorage.js'; // to access the mock
import { timerManager } from './timerManager.js'; // to access the mock

// --- Mock TinyMCE ---
let mockEditor;
let tinymceSetupCallback;

global.tinymce = {
  init: jest.fn((config) => {
    // Capture the setup function to call it manually
    tinymceSetupCallback = config.setup;
    // Create a mock editor object
    mockEditor = {
      ui: {
        registry: {
          addButton: jest.fn(),
          addToggleButton: jest.fn(),
          addMenuItem: jest.fn(),
        },
      },
      dom: {
        getParent: jest.fn(),
        get: jest.fn(),
        remove: jest.fn(),
        select: jest.fn().mockReturnValue([]),
      },
      selection: {
        getBookmark: jest.fn().mockReturnValue({}),
        moveToBookmark: jest.fn(),
        getRng: jest.fn().mockReturnValue({ getClientRects: () => [{ top: 100 }] }),
        getNode: jest.fn(),
        getContent: jest.fn().mockReturnValue(''),
      },
      plugins: {
        wordcount: {
          body: {
            getWordCount: jest.fn().mockReturnValue(0),
          },
        },
      },
      getContainer: jest.fn().mockReturnValue({ getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }) }),
      getBody: jest.fn().mockReturnValue({ classList: { toggle: jest.fn() } }),
      getWin: jest.fn().mockReturnValue({ innerHeight: 600, scrollY: 0, scrollTo: jest.fn() }),
      setContent: jest.fn(),
      getContent: jest.fn().mockReturnValue(''),
      focus: jest.fn(),
      nodeChanged: jest.fn(),
      execCommand: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    // Call the setup function with our mock editor
    if (tinymceSetupCallback) {
      tinymceSetupCallback(mockEditor);
    }
  }),
};

describe('EditorManager', () => {
  let mockUiManager, mockModalManager, mockSelectedNodeRef, mockRootNodesRef, mockDrawFunction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    tinymce.init.mockClear();

    // Mock DOM
    document.body.innerHTML = `
      <textarea id="main-editor"></textarea>
      <div id="editor-mode" class="hidden"></div>
      <div id="hover-tooltip" class="hidden"></div>
    `;

    // Mock dependencies
    mockUiManager = {
      updateSelectedNodeReference: jest.fn(),
      editorMode: document.getElementById('editor-mode'),
      editorFootnotesPane: { classList: { add: jest.fn(), remove: jest.fn() } },
      toggleInspectorSidebar: jest.fn(),
      getWordCount: jest.fn().mockReturnValue(10),
      editorWordCount: { textContent: '' },
      updateWordGoalDisplay: jest.fn(),
      renderTags: jest.fn(),
      renderEditorFootnotes: jest.fn(),
      _escapeRegExp: str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    };
    mockModalManager = {
      showCommentModal: jest.fn(),
      showCertifyWordModal: jest.fn(),
      showEtymologyFor: jest.fn(),
    };
    mockSelectedNodeRef = { node: null };
    mockRootNodesRef = { nodes: [] };
    mockDrawFunction = jest.fn();

    // Initialize the manager
    editorManager.init({
      selectedNodeRef: mockSelectedNodeRef,
      rootNodesRef: mockRootNodesRef,
      drawFunction: mockDrawFunction,
      uiManager: mockUiManager,
      modalManager: mockModalManager,
    });
  });

  describe('Initialization', () => {
    it('should initialize TinyMCE', () => {
      expect(tinymce.init).toHaveBeenCalled();
      expect(editorManager.tinymceEditor).toBe(mockEditor);
    });

    it('should register all custom UI components with TinyMCE', () => {
      expect(mockEditor.ui.registry.addButton).toHaveBeenCalledWith('toggleToolsPane', expect.any(Object));
      expect(mockEditor.ui.registry.addToggleButton).toHaveBeenCalledWith('toggletypewritermode', expect.any(Object));
      expect(mockEditor.ui.registry.addMenuItem).toHaveBeenCalledWith('addcomment', expect.any(Object));
      expect(mockEditor.ui.registry.addMenuItem).toHaveBeenCalledWith('certifyword', expect.any(Object));
      expect(mockEditor.ui.registry.addMenuItem).toHaveBeenCalledWith('lookupetymology', expect.any(Object));
    });

    it('should set up editor event listeners', () => {
        expect(mockEditor.on).toHaveBeenCalledWith('keydown', expect.any(Function));
        expect(mockEditor.on).toHaveBeenCalledWith('input', expect.any(Function));
        expect(mockEditor.on).toHaveBeenCalledWith('mouseover', expect.any(Function));
        expect(mockEditor.on).toHaveBeenCalledWith('mouseout', expect.any(Function));
    });
  });

  describe('Editor Mode Management', () => {
    const testNode = { id: '1', content: '<p>Hello World</p>', tags: [], comments: [] };

    it('should open the editor with node content', () => {
      editorManager.openEditorMode(testNode);

      expect(mockSelectedNodeRef.node).toBe(testNode);
      expect(mockUiManager.updateSelectedNodeReference).toHaveBeenCalledWith(testNode);
      expect(mockUiManager.editorMode.classList.contains('hidden')).toBe(false);
      expect(mockEditor.setContent).toHaveBeenCalledWith('<p>Hello World</p>');
      expect(mockUiManager.renderTags).toHaveBeenCalledWith(testNode);
      expect(mockUiManager.renderEditorFootnotes).toHaveBeenCalledWith(testNode);
      expect(mockEditor.focus).toHaveBeenCalled();
      expect(timerManager.reset).toHaveBeenCalled();
    });

    it('should close the editor and save data', async () => {
      // First, open it
      editorManager.openEditorMode(testNode);
      // Simulate content change
      mockEditor.getContent.mockReturnValue('<p>Updated Content</p>');

      await editorManager.closeEditorMode();

      expect(testNode.content).toBe('<p>Updated Content</p>');
      expect(dataStorageManager.saveData).toHaveBeenCalled();
      expect(mockUiManager.editorMode.classList.contains('hidden')).toBe(true);
      expect(mockDrawFunction).toHaveBeenCalled();
      expect(timerManager.reset).toHaveBeenCalledTimes(2); // Once on open, once on close
    });

    it('should check if editor is open', () => {
        expect(editorManager.isEditorOpen()).toBe(false);
        editorManager.openEditorMode(testNode);
        expect(editorManager.isEditorOpen()).toBe(true);
        editorManager.closeEditorMode();
        expect(editorManager.isEditorOpen()).toBe(false);
    });
  });

  describe('Custom Actions', () => {
    it('should call modalManager to add a comment', () => {
        // Find the 'addcomment' menu item registration
        const addCommentCall = mockEditor.ui.registry.addMenuItem.mock.calls.find(call => call[0] === 'addcomment');
        const addCommentAction = addCommentCall[1].onAction;

        // Simulate selecting text
        mockEditor.selection.getContent.mockReturnValueOnce('some selected text');
        
        addCommentAction();

        expect(mockModalManager.showCommentModal).toHaveBeenCalledWith(expect.stringContaining('comment-'), 'some selected text');
    });

    it('should call modalManager to certify a word', () => {
        const certifyWordCall = mockEditor.ui.registry.addMenuItem.mock.calls.find(call => call[0] === 'certifyword');
        const certifyWordAction = certifyWordCall[1].onAction;

        mockEditor.selection.getContent.mockReturnValueOnce('certifiable');

        certifyWordAction();

        expect(mockModalManager.showCertifyWordModal).toHaveBeenCalledWith('certifiable');
    });
  });

  describe('Highlighting', () => {
    it('should remove a comment highlight span', () => {
        const mockSpan = document.createElement('span');
        mockEditor.dom.get.mockReturnValue(mockSpan);

        editorManager.removeCommentHighlight('comment123');

        expect(mockEditor.dom.get).toHaveBeenCalledWith('comment123');
        expect(mockEditor.dom.remove).toHaveBeenCalledWith(mockSpan, true);
        expect(mockEditor.nodeChanged).toHaveBeenCalled();
    });

    it('should apply certified word highlights', () => {
        const node = {
            certifiedWords: [{ text: 'story', definition: 'a tale' }]
        };
        mockSelectedNodeRef.node = node;
        mockEditor.getContent.mockReturnValue('<p>This is a story.</p>');

        editorManager.applyAndRefreshCertifiedWordHighlights();

        const expectedContent = '<p>This is a <span class="certified-word" data-definition="a tale">story</span>.</p>';
        expect(mockEditor.setContent).toHaveBeenCalledWith(expectedContent);
        expect(mockEditor.selection.moveToBookmark).toHaveBeenCalled();
    });
  });

  describe('Typewriter Mode', () => {
    it('should toggle typewriter mode class and listeners', () => {
        const toggleButtonCall = mockEditor.ui.registry.addToggleButton.mock.calls.find(call => call[0] === 'toggletypewritermode');
        const toggleAction = toggleButtonCall[1].onAction;

        // Turn on
        toggleAction({ setActive: jest.fn() });
        expect(editorManager.isTypewriterModeActive).toBe(true);
        expect(mockEditor.getBody().classList.toggle).toHaveBeenCalledWith('typewriter-mode', true);
        expect(mockEditor.on).toHaveBeenCalledWith('NodeChange', expect.any(Function));

        // Turn off
        toggleAction({ setActive: jest.fn() });
        expect(editorManager.isTypewriterModeActive).toBe(false);
        expect(mockEditor.getBody().classList.toggle).toHaveBeenCalledWith('typewriter-mode', false);
        expect(mockEditor.off).toHaveBeenCalledWith('NodeChange', expect.any(Function));
    });
  });
});