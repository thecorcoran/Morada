require('../js/strunkEngine.js');
const EditorManager = require('../js/editorManager.js');

describe('MyProjectEditorManager & Craft Drawer Integration Tests', () => {
    let mockElements = {};
    let mockStateManager = {};
    let mockUIManager = {};
    let mockDataStorage = {};
    let mockDrawFunction;

    function createMockElement(id, tagName = 'div') {
        const classList = new Set();
        const eventListeners = {};
        return {
            id,
            tagName: tagName.toUpperCase(),
            value: '',
            textContent: '',
            innerHTML: '',
            className: '',
            style: {},
            checked: false,
            classList: {
                add: (cls) => classList.add(cls),
                remove: (cls) => classList.delete(cls),
                contains: (cls) => classList.has(cls),
                toggle: (cls) => {
                    if (classList.has(cls)) classList.delete(cls);
                    else classList.add(cls);
                }
            },
            addEventListener: (event, handler) => {
                eventListeners[event] = handler;
            },
            trigger: (event, eObj = {}) => {
                if (eventListeners[event]) eventListeners[event](eObj);
            },
            appendChild: function(child) {
                // simple append
            },
            click: function() {
                if (eventListeners['click']) eventListeners['click']();
            },
            focus: jest.fn()
        };
    }

    beforeEach(() => {
        mockElements = {
            'editor-mode': createMockElement('editor-mode'),
            'editor-inspector-sidebar': createMockElement('editor-inspector-sidebar'),
            'toggle-craft-drawer-btn': createMockElement('toggle-craft-drawer-btn', 'button'),
            'close-craft-drawer-btn': createMockElement('close-craft-drawer-btn', 'span'),
            'toggle-passive-voice': createMockElement('toggle-passive-voice', 'input'),
            'passive-voice-count': createMockElement('passive-voice-count', 'span'),
            'toggle-adverbs': createMockElement('toggle-adverbs', 'input'),
            'adverb-count': createMockElement('adverb-count', 'span'),
            'flesch-grade': createMockElement('flesch-grade', 'span'),
            'flesch-ease': createMockElement('flesch-ease', 'span'),
            'readability-summary': createMockElement('readability-summary', 'div'),
            'craft-certified-list': createMockElement('craft-certified-list', 'div'),
            'craft-certify-btn': createMockElement('craft-certify-btn', 'button'),
            'craft-etymology-btn': createMockElement('craft-etymology-btn', 'button'),
            'craft-etymology-input': createMockElement('craft-etymology-input', 'input'),
            'editor-word-count': createMockElement('editor-word-count', 'strong'),
            'main-editor-fallback': createMockElement('main-editor-fallback', 'textarea')
        };

        mockElements['editor-mode'].classList.add('hidden');
        mockElements['editor-inspector-sidebar'].classList.add('hidden');

        global.document = {
            getElementById: (id) => mockElements[id] || null,
            createElement: (tag) => createMockElement('elem-' + Date.now(), tag),
            addEventListener: jest.fn()
        };

        let selectedNode = null;
        const rootNodes = [];

        mockStateManager = {
            getSelectedNode: () => selectedNode,
            setSelectedNode: (n) => { selectedNode = n; },
            getRootNodes: () => rootNodes
        };

        mockUIManager = {
            editorMode: mockElements['editor-mode'],
            editorInspectorSidebar: mockElements['editor-inspector-sidebar'],
            updateEditorWordCount: jest.fn(),
            renderTags: jest.fn(),
            renderFootnotes: jest.fn(),
            openCertifyModal: jest.fn(),
            openCommentModal: jest.fn(),
            showEtymologyFor: jest.fn()
        };

        mockDataStorage = {
            saveNodes: jest.fn()
        };

        mockDrawFunction = jest.fn();

        EditorManager._craftDrawerInitialized = false;
        EditorManager.tinyMCEAvailable = false;
        EditorManager.tinymceEditor = null;

        EditorManager.init({
            stateManager: mockStateManager,
            uiManager: mockUIManager,
            dataStorage: mockDataStorage,
            drawFunction: mockDrawFunction
        });
    });

    test('should initialize dependencies and craft drawer', () => {
        expect(EditorManager.stateManager).toBe(mockStateManager);
        expect(EditorManager.uiManager).toBe(mockUIManager);
        expect(EditorManager.dataStorage).toBe(mockDataStorage);
    });

    test('toggleCraftDrawer should toggle visibility and button label', () => {
        const sidebar = mockElements['editor-inspector-sidebar'];
        const toggleBtn = mockElements['toggle-craft-drawer-btn'];

        expect(sidebar.classList.contains('hidden')).toBe(true);

        // Open
        EditorManager.toggleCraftDrawer();
        expect(sidebar.classList.contains('hidden')).toBe(false);
        expect(toggleBtn.textContent).toBe('Craft Drawer ▾');

        // Close
        EditorManager.toggleCraftDrawer();
        expect(sidebar.classList.contains('hidden')).toBe(true);
        expect(toggleBtn.textContent).toBe('Craft Drawer ▸');

        // Force open
        EditorManager.toggleCraftDrawer(true);
        expect(sidebar.classList.contains('hidden')).toBe(false);
    });

    test('updateStrunkMetrics should calculate and display readability scores and grammar badges', () => {
        const testContent = '<p>The ancient parchment was slowly illuminated by the lamp. It revealed the secrets of Monticello.</p>';
        EditorManager.updateStrunkMetrics(testContent);

        const gradeEl = mockElements['flesch-grade'];
        const easeEl = mockElements['flesch-ease'];
        const summaryEl = mockElements['readability-summary'];
        const passiveCountEl = mockElements['passive-voice-count'];
        const adverbCountEl = mockElements['adverb-count'];

        expect(parseFloat(gradeEl.textContent)).toBeGreaterThan(0);
        expect(parseFloat(easeEl.textContent)).toBeGreaterThan(0);
        expect(summaryEl.textContent).not.toBe('Draft text to analyze');
        // 'was slowly illuminated' -> 1 passive voice, 'slowly' -> 1 adverb
        expect(parseInt(passiveCountEl.textContent, 10)).toBe(1);
        expect(parseInt(adverbCountEl.textContent, 10)).toBe(1);
    });

    test('renderCraftCertifiedList should handle empty and populated certified words', () => {
        const container = mockElements['craft-certified-list'];

        // Node with no certified words
        const emptyNode = { id: 'sheet-1', title: 'Draft', certifiedWords: [] };
        EditorManager.renderCraftCertifiedList(emptyNode);
        expect(container.innerHTML).toBe('');

        // Node with certified words
        const populatedNode = {
            id: 'sheet-2',
            title: 'Philosophical Fragment',
            certifiedWords: [
                { spanId: 'cert-1', word: 'Justice', text: 'Justice', definition: 'The moral equilibrium of the state.' },
                { spanId: 'cert-2', word: 'Logos', text: 'Logos', definition: 'The governing reason of the cosmos.' }
            ]
        };
        EditorManager.renderCraftCertifiedList(populatedNode);
    });

    test('closeEditorMode should enforce non-destructive saving by stripping Strunk markers', () => {
        const rawWithHighlights = '<p>The fortress <span class="strunk-passive">was destroyed</span> <span class="strunk-adverb">completely</span> by the storm.</p>';
        const node = {
            id: 'sheet-3',
            title: 'Siege Notes',
            content: rawWithHighlights
        };

        mockStateManager.setSelectedNode(node);
        mockElements['main-editor-fallback'].value = rawWithHighlights;

        EditorManager.closeEditorMode();

        // Strunk markers must be stripped from saved node content
        expect(node.content).toBe('<p>The fortress was destroyed completely by the storm.</p>');
        expect(node.content).not.toContain('strunk-passive');
        expect(node.content).not.toContain('strunk-adverb');
        expect(mockDataStorage.saveNodes).toHaveBeenCalled();
        expect(mockUIManager.editorMode.classList.contains('hidden')).toBe(true);
        expect(mockUIManager.editorInspectorSidebar.classList.contains('hidden')).toBe(true);
    });
});
