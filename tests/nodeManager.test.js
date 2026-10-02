const NodeManager = require('../js/nodeManager.js');
const StateManager = require('../js/stateManager.js');

describe('MyProjectNodeManager', () => {
    test('should create container node with proper geometry and defaults', () => {
        const node = NodeManager.createNode(500, 400, false, 'test-chamber-1');
        expect(node.id).toBe('test-chamber-1');
        expect(node.type).toBe('container');
        expect(node.title).toBe('New Portfolio');
        expect(node.width).toBe(340);
        expect(node.height).toBe(210);
        expect(node.x).toBe(500 - 170);
        expect(node.y).toBe(400 - 105);
        expect(node.tags).toEqual([]);
        expect(node.children).toEqual([]);
        expect(node.content).toBe('');
    });

    test('should create text node with proper title and type', () => {
        const node = NodeManager.createNode(100, 200, true, 'test-text-1');
        expect(node.id).toBe('test-text-1');
        expect(node.type).toBe('text');
        expect(node.title).toBe('New Sheet');
        expect(node.width).toBe(340);
        expect(node.height).toBe(210);
    });

    test('should add tags to node without introducing duplicates', () => {
        const node = { id: 'node-1', tags: ['draft'] };
        NodeManager.addTagToNode(node, 'chapter-1');
        expect(node.tags).toEqual(['draft', 'chapter-1']);

        // Attempt duplicate
        NodeManager.addTagToNode(node, 'draft');
        expect(node.tags).toEqual(['draft', 'chapter-1']);
    });

    test('should delete node by ID from a list', () => {
        const list = [
            { id: '1', title: 'First' },
            { id: '2', title: 'Second' },
            { id: '3', title: 'Third' }
        ];

        const updated = NodeManager.deleteNode('2', list);
        expect(updated).toHaveLength(2);
        expect(updated.map(n => n.id)).toEqual(['1', '3']);
    });

    test('should find node recursively in nested tree structure', () => {
        const tree = [
            {
                id: 'root-1',
                title: 'Root 1',
                children: [
                    {
                        id: 'child-1-1',
                        title: 'Child 1.1',
                        children: [
                            { id: 'leaf-deep', title: 'Deep Leaf', children: [] }
                        ]
                    }
                ]
            },
            {
                id: 'root-2',
                title: 'Root 2',
                children: []
            }
        ];

        const found = NodeManager.findNodeByIdPath('leaf-deep', tree);
        expect(found).not.toBeNull();
        expect(found.title).toBe('Deep Leaf');

        const notFound = NodeManager.findNodeByIdPath('non-existent', tree);
        expect(notFound).toBeNull();
    });

    test('should find node at canvas position given mock canvas and state', () => {
        const mockCanvas = {
            width: 800,
            height: 600,
            clientWidth: 800,
            clientHeight: 600
        };

        const testNode = {
            id: 'hit-node',
            x: 100,
            y: 100,
            width: 200,
            height: 100
        };

        StateManager.setRootNodes([testNode]);
        StateManager.setScale(1);
        StateManager.setOffsetX(0);
        StateManager.setOffsetY(0);

        NodeManager.init({
            canvas: mockCanvas,
            stateManager: StateManager,
            drawFunction: () => {},
            saveNodesFunction: () => {}
        });

        // Click inside the node: (100 + 50, 100 + 50) = (150, 150)
        const hit = NodeManager.getNodeAtPosition(150, 150);
        expect(hit).toBe(testNode);

        // Click outside the node: (400, 400)
        const miss = NodeManager.getNodeAtPosition(400, 400);
        expect(miss).toBeNull();
    });

    describe('reorderNode', () => {
        test('should move an item from one index to another in place', () => {
            const list = [
                { id: 'a', title: 'Chapter A' },
                { id: 'b', title: 'Chapter B' },
                { id: 'c', title: 'Chapter C' }
            ];

            NodeManager.reorderNode(list, 0, 2);
            expect(list.map(n => n.id)).toEqual(['b', 'c', 'a']);

            NodeManager.reorderNode(list, 2, 1);
            expect(list.map(n => n.id)).toEqual(['b', 'a', 'c']);
        });

        test('should return unmodified list when given out of bounds indices', () => {
            const list = [{ id: '1' }, { id: '2' }];
            NodeManager.reorderNode(list, -1, 1);
            expect(list.map(n => n.id)).toEqual(['1', '2']);

            NodeManager.reorderNode(list, 0, 5);
            expect(list.map(n => n.id)).toEqual(['1', '2']);

            expect(NodeManager.reorderNode(null, 0, 1)).toBeNull();
        });
    });
});
