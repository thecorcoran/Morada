// Mock the constants module before importing nodeManager to ensure it uses our test values.
jest.mock('./constants.js', () => ({
  NodeConstants: {
    NODE_WIDTH: 100,
    NODE_HEIGHT: 50,
  },
  MiscConstants: {
    NEW_SCRIPTORIUM_TITLE: 'New Scriptorium',
    NEW_BOOK_TITLE: 'New Book',
  },
  KeyConstants: {
    KEY_ENTER: 'Enter',
    KEY_ESCAPE: 'Escape',
  }
}));

import { nodeManager } from './nodeManager.js';

describe('NodeManager', () => {
  let mockCanvas, mockGetCurrentNodes, mockDraw, mockSave, mockViewStack, mockCanvasRenderer;

  // beforeEach runs before each test in this file, setting up a clean state.
  beforeEach(() => {
    // Mock the dependencies that nodeManager.init() expects.
    mockCanvas = {
      width: 800,
      height: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    };
    document.body.innerHTML = ''; // Clear the mock DOM

    mockGetCurrentNodes = jest.fn();
    mockDraw = jest.fn();
    mockSave = jest.fn().mockResolvedValue(undefined); // It's an async function
    mockViewStack = [];
    mockCanvasRenderer = {
      calculateBookLayout: jest.fn(),
    };

    // Initialize the nodeManager with our mocks for each test.
    nodeManager.init({
      canvasEl: mockCanvas,
      initialScale: 1,
      initialOffsetX: 0,
      initialOffsetY: 0,
      getCurrentNodesFunc: mockGetCurrentNodes,
      drawFunc: mockDraw,
      saveNodesFunc: mockSave,
      viewStackRef: mockViewStack,
      canvasRendererRef: mockCanvasRenderer,
    });
  });

  describe('Initialization and State', () => {
    it('should initialize with provided configuration', () => {
      expect(nodeManager.canvas).toBe(mockCanvas);
      expect(nodeManager.scale).toBe(1);
      expect(nodeManager.getCurrentNodes).toBe(mockGetCurrentNodes);
    });

    it('should update shared variables', () => {
      nodeManager.updateSharedVariables(2, 100, 200);
      expect(nodeManager.scale).toBe(2);
      expect(nodeManager.offsetX).toBe(100);
      expect(nodeManager.offsetY).toBe(200);
    });
  });

  describe('Node Creation and Deletion', () => {
    it('should create a text node correctly', () => {
      const node = nodeManager.createNode(100, 100, true, 'text-1');
      // Check that the created node has all the expected properties and values.
      expect(node).toEqual(expect.objectContaining({
        id: 'text-1',
        x: 50, // 100 - NODE_WIDTH / 2
        y: 75, // 100 - NODE_HEIGHT / 2
        width: 100,
        height: 50,
        title: 'New Scriptorium',
        type: 'text',
      }));
    });

    it('should create a container node correctly', () => {
      const node = nodeManager.createNode(200, 200, false, 'container-1');
      expect(node.title).toBe('New Book');
      expect(node.type).toBe('container');
    });

    it('should delete a node from a list without mutating the original', () => {
      const nodeList = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const result = nodeManager.deleteNode('2', nodeList);
      expect(result).toEqual([{ id: '1' }, { id: '3' }]);
      expect(nodeList.length).toBe(3); // Ensure original list is not mutated.
    });
  });

  describe('Node Finding', () => {
    const tree = [
      { id: 'root1', children: [] },
      { id: 'root2', children: [
        { id: 'child1', children: [] },
        { id: 'child2', children: [
          { id: 'grandchild1', children: [] }
        ]}
      ]}
    ];

    it('should find a node by ID in a nested structure', () => {
      const found = nodeManager.findNodeByIdPath('grandchild1', tree);
      expect(found).not.toBeNull();
      expect(found.id).toBe('grandchild1');
    });

    it('should return null if node ID is not found', () => {
      const found = nodeManager.findNodeByIdPath('non-existent', tree);
      expect(found).toBeNull();
    });

    describe('getNodeAtPosition', () => {
      it('should find a node in standard view', () => {
        const nodes = [{ id: '1', x: 0, y: 0, width: 100, height: 50 }];
        mockGetCurrentNodes.mockReturnValue(nodes);
        mockViewStack.push({ id: 'parent' }); // Not root view

        // Click at (25, 25) in world coordinates.
        // Screen coords: (25 - 0)*1 + 400 = 425, (25 - 0)*1 + 300 = 325
        const foundNode = nodeManager.getNodeAtPosition(425, 325);
        expect(foundNode).toBe(nodes[0]);
      });

      it('should find a book node in bookshelf view', () => {
        const containerNodes = [{ id: 'book1', type: 'container', title: 'A Book' }];
        mockGetCurrentNodes.mockReturnValue(containerNodes);
        mockViewStack.length = 0; // Root view

        // Mock the layout calculation from the canvas renderer.
        const bookLayout = [{ id: 'book1', x: 0, y: 0, width: 40, height: 150 }];
        mockCanvasRenderer.calculateBookLayout.mockReturnValue(bookLayout);

        // Click at (20, 75) in world coordinates.
        const foundNode = nodeManager.getNodeAtPosition(420, 375);
        expect(foundNode).toBe(containerNodes[0]);
        expect(mockCanvasRenderer.calculateBookLayout).toHaveBeenCalledWith(containerNodes);
      });
    });
  });

  describe('Title Editing', () => {
    it('should create and position a title editor input', () => {
      const node = { id: '1', title: 'Old Title', x: 100, y: 100, width: 100, height: 50 };
      nodeManager.createTitleEditor(node);

      const editor = document.querySelector('.node-editor');
      expect(editor).not.toBeNull();
      expect(editor.value).toBe('Old Title');
      expect(node.isEditing).toBe(true);
      expect(mockDraw).toHaveBeenCalled();

      // Check positioning based on node coords, canvas size, and scale.
      // screenX = (100 - 0) * 1 + 800 / 2 = 500
      // screenY = (100 - 0) * 1 + 600 / 2 = 400
      expect(editor.style.left).toBe('500px');
      expect(editor.style.top).toBe('400px');
    });

    it('should save changes on blur', async () => {
      const node = { id: '1', title: 'Old Title', x: 100, y: 100, width: 100, height: 50 };
      nodeManager.createTitleEditor(node);

      const editor = document.querySelector('.node-editor');
      editor.value = 'New Title';
      
      // Simulate the user clicking away from the input.
      editor.dispatchEvent(new Event('blur'));

      // Wait for async save function to resolve.
      await Promise.resolve();

      expect(node.title).toBe('New Title');
      expect(node.isEditing).toBe(false);
      expect(mockSave).toHaveBeenCalled();
      expect(mockDraw).toHaveBeenCalledTimes(2); // Once on create, once on save.
      expect(document.querySelector('.node-editor')).toBeNull(); // Editor should be removed.
    });
  });
});