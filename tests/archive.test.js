const UIManager = require('../js/uiManager.js');
const NodeManager = require('../js/nodeManager.js');
const StateManager = require('../js/stateManager.js');

describe('Archives Vault System Tests', () => {
    let mockRootNodes;

    beforeEach(() => {
        // Setup mock DOM elements for UIManager
        const createMockEl = (id) => ({
            id,
            textContent: '',
            value: '',
            className: '',
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn(() => false),
                toggle: jest.fn()
            },
            appendChild: jest.fn(),
            removeChild: jest.fn(),
            addEventListener: jest.fn(),
            setAttribute: jest.fn(),
            getAttribute: jest.fn(),
            style: {}
        });

        global.document = {
            getElementById: (id) => {
                if (id === 'archive-count-badge') return createMockEl('archive-count-badge');
                if (id === 'open-archive-btn') return createMockEl('open-archive-btn');
                if (id === 'archive-modal') return createMockEl('archive-modal');
                if (id === 'archive-list') return createMockEl('archive-list');
                if (id === 'archive-search-input') return createMockEl('archive-search-input');
                return createMockEl(id);
            },
            querySelectorAll: () => [],
            createElement: (tag) => createMockEl(tag),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            body: createMockEl('body')
        };

        mockRootNodes = [
            {
                id: 'portfolio-1',
                title: 'Book 1: The Mountain',
                type: 'container',
                archived: false,
                children: [
                    { id: 'sheet-1', title: 'Chapter 1', type: 'text', content: 'Once upon a time', archived: false },
                    { id: 'sheet-2', title: 'Cut Scene', type: 'text', content: 'Deleted prose', archived: false }
                ]
            },
            {
                id: 'sheet-3',
                title: 'Standalone Desk Sheet',
                type: 'text',
                content: 'Desk prose',
                archived: false
            }
        ];

        StateManager.setRootNodes(mockRootNodes);
        StateManager.setCurrentNodes(mockRootNodes);
        StateManager.setSelectedNode(null);

        global.window = {
            MyProjectNodeManager: NodeManager,
            MyProjectStateManager: StateManager,
            MyProjectUIManager: UIManager
        };

        NodeManager.init({
            canvas: { width: 1000, height: 800 },
            stateManager: StateManager,
            drawFunction: jest.fn(),
            saveNodesFunction: jest.fn()
        });

        UIManager.init({
            canvas: { width: 1000, height: 800 },
            stateManager: StateManager,
            drawFunction: jest.fn(),
            saveNodesFunction: jest.fn(),
            navigateToNodeFunction: jest.fn()
        });
    });

    test('archiving a sheet removes it from active desk and updates archive badge', () => {
        const sheetToArchive = mockRootNodes[1]; // sheet-3
        expect(sheetToArchive.archived).toBe(false);

        UIManager.archiveNode(sheetToArchive);

        expect(sheetToArchive.archived).toBe(true);
        expect(sheetToArchive.archivedAt).toBeDefined();

        const allArchived = NodeManager.getAllArchivedNodes(StateManager.getRootNodes());
        expect(allArchived).toHaveLength(1);
        expect(allArchived[0].node.id).toBe('sheet-3');

        // Badge update
        expect(UIManager.archiveCountBadge.textContent).toBe('1');
    });

    test('archiving a portfolio safely removes entire portfolio and preserves its nested sheets', () => {
        const portfolio = mockRootNodes[0]; // portfolio-1
        expect(portfolio.archived).toBe(false);

        UIManager.archiveNode(portfolio);

        expect(portfolio.archived).toBe(true);
        expect(portfolio.children).toHaveLength(2);

        // When retrieving all archived nodes, portfolio is listed as 1 entry
        const allArchived = NodeManager.getAllArchivedNodes(StateManager.getRootNodes());
        expect(allArchived).toHaveLength(1);
        expect(allArchived[0].node.id).toBe('portfolio-1');

        // Unarchiving restores it cleanly
        UIManager.unarchiveNode(portfolio, false);
        expect(portfolio.archived).toBe(false);
        expect(portfolio.children[0].title).toBe('Chapter 1');
    });

    test('unarchiving a node restores it and decreases the archive count badge', () => {
        const sheet = mockRootNodes[1];
        UIManager.archiveNode(sheet);
        expect(UIManager.archiveCountBadge.textContent).toBe('1');

        UIManager.unarchiveNode(sheet, false);
        expect(sheet.archived).toBe(false);
        expect(UIManager.archiveCountBadge.textContent).toBe('0');
    });

    test('restoreAllArchivedNodes restores every archived card in the vault', () => {
        global.confirm = jest.fn(() => true);

        // Archive multiple items
        UIManager.archiveNode(mockRootNodes[0]); // portfolio-1
        UIManager.archiveNode(mockRootNodes[1]); // sheet-3

        let archived = NodeManager.getAllArchivedNodes(StateManager.getRootNodes());
        expect(archived).toHaveLength(2);

        UIManager.restoreAllArchivedNodes();

        archived = NodeManager.getAllArchivedNodes(StateManager.getRootNodes());
        expect(archived).toHaveLength(0);
        expect(mockRootNodes[0].archived).toBe(false);
        expect(mockRootNodes[1].archived).toBe(false);
        expect(UIManager.archiveCountBadge.textContent).toBe('0');
    });

    test('deleteArchivedNodePermanently removes node permanently from project tree', () => {
        global.confirm = jest.fn(() => true);

        const sheet = mockRootNodes[1];
        UIManager.archiveNode(sheet);

        UIManager.deleteArchivedNodePermanently(sheet);

        const rootNodes = StateManager.getRootNodes();
        expect(rootNodes.find(n => n.id === 'sheet-3')).toBeUndefined();
        expect(rootNodes).toHaveLength(1);
    });

    test('fitNodesToView completely excludes archived cards when calculating bounding box', () => {
        // Place an active node at (0, 0)
        mockRootNodes[0].x = 0;
        mockRootNodes[0].y = 0;
        mockRootNodes[0].width = 520;
        mockRootNodes[0].height = 330;
        mockRootNodes[0].archived = false;

        // Place an archived node far away at (5000, 5000)
        mockRootNodes[1].x = 5000;
        mockRootNodes[1].y = 5000;
        mockRootNodes[1].width = 340;
        mockRootNodes[1].height = 210;
        mockRootNodes[1].archived = true;

        StateManager.setCurrentNodes(mockRootNodes);

        UIManager.fitNodesToView(80);

        // If the far node at (5000, 5000) were included, offsetX would be around (5340 / 2) - 500 = 2170
        // But because it is archived and excluded, center is only based on active node (0 + 520) / 2 = 260
        // expectedOffsetX = 260 - 500 = -240
        expect(StateManager.getOffsetX()).toBeCloseTo(-240);
        expect(StateManager.getOffsetY()).toBeCloseTo(-235);
    });

    test('autoTidyDesk ignores archived cards and only arranges active cards', () => {
        mockRootNodes[0].archived = false; // portfolio
        mockRootNodes[1].archived = true;  // archived sheet at (999, 999)
        mockRootNodes[1].x = 999;
        mockRootNodes[1].y = 999;

        StateManager.setCurrentNodes(mockRootNodes);

        UIManager.autoTidyDesk();

        // Active node was tidied and centered
        expect(mockRootNodes[0].x).toBeCloseTo(-260); // centered width 520

        // Archived node was untouched and did not participate in tidy grid
        expect(mockRootNodes[1].x).toBe(999);
        expect(mockRootNodes[1].y).toBe(999);
    });
});
