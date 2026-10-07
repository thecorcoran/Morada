require('../js/strunkEngine.js');
require('../js/scenicMaxims.js');
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
            setRangeText: function(replacement, start, end) {
                this.value = this.value.substring(0, start) + replacement + this.value.substring(end);
            },
            dispatchEvent: jest.fn(),
            focus: jest.fn()
        };
    }

    beforeEach(() => {
        mockElements = {
            'editor-mode': createMockElement('editor-mode'),
            'editor-main-content': createMockElement('editor-main-content'),
            'editor-toolbar': createMockElement('editor-toolbar'),
            'editor-breadcrumb-label': createMockElement('editor-breadcrumb-label', 'span'),
            'editor-bold-btn': createMockElement('editor-bold-btn', 'button'),
            'editor-italic-btn': createMockElement('editor-italic-btn', 'button'),
            'editor-h2-btn': createMockElement('editor-h2-btn', 'button'),
            'editor-quote-btn': createMockElement('editor-quote-btn', 'button'),
            'editor-bullet-btn': createMockElement('editor-bullet-btn', 'button'),
            'editor-fullview-btn': createMockElement('editor-fullview-btn', 'button'),
            'exit-fullview-btn': createMockElement('exit-fullview-btn', 'button'),
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
            'main-editor-fallback': createMockElement('main-editor-fallback', 'textarea'),
            'scenic-featured-quote': createMockElement('scenic-featured-quote', 'div'),
            'scenic-featured-meta': createMockElement('scenic-featured-meta', 'div'),
            'scenic-shuffle-btn': createMockElement('scenic-shuffle-btn', 'button'),
            'scenic-insert-btn': createMockElement('scenic-insert-btn', 'button'),
            'scenic-search-input': createMockElement('scenic-search-input', 'input'),
            'scenic-category-filter': createMockElement('scenic-category-filter', 'select'),
            'scenic-maxims-list': createMockElement('scenic-maxims-list', 'div')
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
            getRootNodes: () => rootNodes,
            getViewStack: () => []
        };

        mockUIManager = {
            editorMode: mockElements['editor-mode'],
            editorInspectorSidebar: mockElements['editor-inspector-sidebar'],
            updateEditorWordCount: jest.fn(),
            renderTags: jest.fn(),
            renderFootnotes: jest.fn(),
            openCertifyModal: jest.fn(),
            openCommentModal: jest.fn(),
            showEtymologyFor: jest.fn(),
            ensureNodeVisible: jest.fn(),
            fitNodesToView: jest.fn()
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

    afterEach(() => {
        if (EditorManager._autoSaveDebounceTimer) {
            clearTimeout(EditorManager._autoSaveDebounceTimer);
            EditorManager._autoSaveDebounceTimer = null;
        }
        if (EditorManager._saveIndicatorFadeTimer) {
            clearTimeout(EditorManager._saveIndicatorFadeTimer);
            EditorManager._saveIndicatorFadeTimer = null;
        }
        if (EditorManager._autoSaveInterval) {
            clearInterval(EditorManager._autoSaveInterval);
            EditorManager._autoSaveInterval = null;
        }
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

        // Open: drawer opens and toggle button disappears per user requirement
        EditorManager.toggleCraftDrawer();
        expect(sidebar.classList.contains('hidden')).toBe(false);
        expect(toggleBtn.classList.contains('hidden')).toBe(true);

        // Close: drawer closes and toggle button reappears
        EditorManager.toggleCraftDrawer();
        expect(sidebar.classList.contains('hidden')).toBe(true);
        expect(toggleBtn.classList.contains('hidden')).toBe(false);
        expect(toggleBtn.textContent).toBe('Craft Drawer ▾');

        // Force open
        EditorManager.toggleCraftDrawer(true);
        expect(sidebar.classList.contains('hidden')).toBe(false);
        expect(toggleBtn.classList.contains('hidden')).toBe(true);
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
        expect(mockDataStorage.saveNodes).toHaveBeenCalled();
        expect(mockUIManager.editorMode.classList.contains('hidden')).toBe(true);
        expect(mockUIManager.editorInspectorSidebar.classList.contains('hidden')).toBe(true);
        expect(mockUIManager.ensureNodeVisible).toHaveBeenCalledWith(node, 100);
    });

    test('toggleFullView should toggle full-view-mode class and update buttons', () => {
        const editorMode = mockElements['editor-mode'];
        const fullviewBtn = mockElements['editor-fullview-btn'];
        const exitBtn = mockElements['exit-fullview-btn'];

        expect(editorMode.classList.contains('full-view-mode')).toBe(false);

        // Enter Full View
        EditorManager.toggleFullView(true);
        expect(editorMode.classList.contains('full-view-mode')).toBe(true);
        expect(fullviewBtn.textContent).toBe('✕ Exit Full View');
        expect(exitBtn.classList.contains('hidden')).toBe(false);

        // Exit Full View
        EditorManager.toggleFullView(false);
        expect(editorMode.classList.contains('full-view-mode')).toBe(false);
        expect(fullviewBtn.textContent).toBe('⛶ Full View');
        expect(exitBtn.classList.contains('hidden')).toBe(true);
    });

    test('initScenicMaxims and drawRandomMaxim should update featured maxim card', () => {
        EditorManager.initScenicMaxims();

        const quoteEl = mockElements['scenic-featured-quote'];
        const metaEl = mockElements['scenic-featured-meta'];

        expect(quoteEl.textContent).toContain('“');
        expect(metaEl.textContent).toContain('Maxim #');

        // Draw new random maxim
        EditorManager.drawRandomMaxim();
        expect(quoteEl.textContent.length).toBeGreaterThan(5);
        expect(metaEl.textContent).toMatch(/Maxim #\d+/);
    });

    test('insertCurrentMaximIntoSheet should append scenic maxim to editor content', () => {
        const ta = mockElements['main-editor-fallback'];
        ta.value = 'Existing prose. ';

        EditorManager.initScenicMaxims();
        EditorManager.insertCurrentMaximIntoSheet();

        expect(ta.value).toContain('Scenic Method Maxim #');
    });

    test('toggleScenicMaximCheck should save and update checked maxims', () => {
        const testNode = { id: 'sheet-scenic-1', title: 'Scene Draft' };
        mockStateManager.setSelectedNode(testNode);

        // Check maxim 2 ("Render, never report.")
        EditorManager.toggleScenicMaximCheck(2);
        let checked = EditorManager._getCheckedMaximsForNode('sheet-scenic-1');
        expect(checked.has(2)).toBe(true);

        // Uncheck
        EditorManager.toggleScenicMaximCheck(2);
        checked = EditorManager._getCheckedMaximsForNode('sheet-scenic-1');
        expect(checked.has(2)).toBe(false);
    });

    test('flushAndSaveCurrentSheet should sync editor text to node and invoke dataStorage.saveNodes immediately', () => {
        const testNode = { id: 'sheet-flush-1', title: 'Live Prose', content: 'Initial' };
        mockStateManager.setSelectedNode(testNode);

        const ta = mockElements['main-editor-fallback'];
        ta.value = '<p>Freshly written paragraph without leaving editor.</p>';

        EditorManager.flushAndSaveCurrentSheet();

        expect(testNode.content).toBe('<p>Freshly written paragraph without leaving editor.</p>');
        expect(mockDataStorage.saveNodes).toHaveBeenCalled();
    });

    test('_scheduleAutoSave debounces and flushes changes to storage', () => {
        jest.useFakeTimers();
        const testNode = { id: 'sheet-debounce-1', title: 'Debounced Prose', content: 'Initial' };
        mockStateManager.setSelectedNode(testNode);

        const ta = mockElements['main-editor-fallback'];
        ta.value = '<p>Drafting mid-sentence...</p>';

        mockDataStorage.saveNodes.mockClear();
        EditorManager._scheduleAutoSave();

        // Before debounce timeout
        expect(mockDataStorage.saveNodes).not.toHaveBeenCalled();

        // Advance debounce timer (1500ms)
        jest.advanceTimersByTime(1600);

        expect(testNode.content).toBe('<p>Drafting mid-sentence...</p>');
        expect(mockDataStorage.saveNodes).toHaveBeenCalled();

        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('applyFormatting formats text in fallback textarea mode', () => {
        EditorManager.init({
            stateManager: mockStateManager,
            uiManager: mockUIManager,
            dataStorage: mockDataStorage,
            drawFunction: mockDrawFunction
        });

        const ta = mockElements['main-editor-fallback'];
        ta.value = 'hello world';
        ta.selectionStart = 0;
        ta.selectionEnd = 5;

        EditorManager.applyFormatting('bold');
        expect(ta.value).toBe('**hello** world');

        ta.value = 'section title';
        ta.selectionStart = 0;
        ta.selectionEnd = 13;
        EditorManager.applyFormatting('h2');
        expect(ta.value).toContain('## section title');
    });

    test('openEditorMode should update editor-breadcrumb-label with hierarchy', () => {
        const viewStack = [{ id: 'p1', title: 'Chapter 1' }];
        mockStateManager.getViewStack = () => viewStack;

        EditorManager.init({
            stateManager: mockStateManager,
            uiManager: mockUIManager,
            dataStorage: mockDataStorage,
            drawFunction: mockDrawFunction
        });

        const testNode = { id: 'sheet-1', title: 'Scene 1', content: 'Prose content' };
        EditorManager.openEditorMode(testNode);

        const breadcrumb = mockElements['editor-breadcrumb-label'];
        expect(breadcrumb.textContent).toBe('The Desk / Chapter 1 / Scene 1');
    });

    test('openEditorMode on mobile screen should keep craft drawer hidden to allow note typing', () => {
        const origWidth = window.innerWidth;
        try {
            window.innerWidth = 412; // Mobile viewport
            const testNode = { id: 'sheet-mobile', title: 'Mobile Note', content: 'Mobile text' };
            EditorManager.openEditorMode(testNode);

            const sidebar = mockElements['editor-inspector-sidebar'];
            expect(sidebar.classList.contains('hidden')).toBe(true);

            const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
            expect(toggleBtn.classList.contains('hidden')).toBe(false);
            expect(toggleBtn.textContent).toContain('Craft Drawer');
        } finally {
            window.innerWidth = origWidth;
        }
    });

    test('openEditorMode on desktop screen should show craft drawer', () => {
        const origWidth = window.innerWidth;
        try {
            window.innerWidth = 1200; // Desktop viewport
            const testNode = { id: 'sheet-desktop', title: 'Desktop Note', content: 'Desktop text' };
            EditorManager.openEditorMode(testNode);

            const sidebar = mockElements['editor-inspector-sidebar'];
            expect(sidebar.classList.contains('hidden')).toBe(false);

            // Craft Drawer toggle button disappears while drawer is open
            const toggleBtn = document.getElementById('toggle-craft-drawer-btn');
            expect(toggleBtn.classList.contains('hidden')).toBe(true);
        } finally {
            window.innerWidth = origWidth;
        }
    });

    test('initTinyMCE can be called safely when tinymce is unavailable without throwing', () => {
        expect(() => {
            EditorManager.initTinyMCE();
        }).not.toThrow();
    });

    test('isMobileMode identifies mobile screens and routes openEditorMode to textarea', () => {
        const origWidth = window.innerWidth;
        try {
            window.innerWidth = 390;
            expect(EditorManager.isMobileMode()).toBe(true);

            const testNode = { id: 'sheet-phone', title: 'Phone Note', content: 'Native mobile typing' };
            EditorManager.openEditorMode(testNode);

            const ta = EditorManager.getTextareaElement();
            expect(ta).toBeTruthy();
            expect(ta.value).toBe('Native mobile typing');
            expect(ta.style.display).not.toBe('none');
        } finally {
            window.innerWidth = origWidth;
        }
    });

    test('desktop openEditorMode keeps native textarea visible and editable if TinyMCE is not ready', () => {
        const origWidth = window.innerWidth;
        try {
            window.innerWidth = 1200; // Desktop screen
            expect(EditorManager.isMobileMode()).toBe(false);

            EditorManager.tinyMCEAvailable = false;
            EditorManager.tinymceEditor = null;

            const desktopNode = { id: 'sheet-desk-test', title: 'Desktop Typing Test', content: 'Prose to type' };
            EditorManager.openEditorMode(desktopNode);

            const ta = EditorManager.getTextareaElement();
            expect(ta).toBeTruthy();
            expect(ta.value).toBe('Prose to type');
            expect(ta.style.display).toBe('block');
            expect(EditorManager.isEditorOpen()).toBe(true);

            // User edits in textarea
            ta.value = 'User typed new words on desktop';
            EditorManager.flushAndSaveCurrentSheet();
            expect(desktopNode.content).toBe('User typed new words on desktop');
        } finally {
            window.innerWidth = origWidth;
        }
    });

    test('isTinyMCEActive returns false when TinyMCE container is not visible or not present', () => {
        EditorManager.tinyMCEAvailable = true;
        EditorManager.tinymceEditor = {
            editorContainer: { style: { display: 'none' } }
        };
        expect(EditorManager.isTinyMCEActive()).toBe(false);

        EditorManager.tinymceEditor.editorContainer.style.display = 'flex';
        expect(EditorManager.isTinyMCEActive()).toBe(true);

        EditorManager.tinyMCEAvailable = false;
        expect(EditorManager.isTinyMCEActive()).toBe(false);
    });

    test('openEditorMode guarantees textarea is enabled and responsive for typing', () => {
        const testNode = { id: 'sheet-typing-verify', title: 'Typing Sheet', content: 'Initial prose' };
        EditorManager.openEditorMode(testNode);

        const ta = EditorManager.getTextareaElement();
        expect(ta).toBeTruthy();
        expect(ta.disabled).toBe(false);
        expect(ta.readOnly).toBe(false);
        expect(ta.style.display).toBe('block');
        expect(EditorManager.isEditorOpen()).toBe(true);

        // Simulate typing into the sheet
        ta.value = 'Initial prose with brilliant new thought';
        ta.oninput();
        expect(testNode.content).toBe('Initial prose with brilliant new thought');
    });
});

