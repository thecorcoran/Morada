const NodeManager = require('../js/nodeManager.js');
const StateManager = require('../js/stateManager.js');

describe('MyProjectNodeManager', () => {
    test('should create container node with proper geometry and defaults', () => {
        const node = NodeManager.createNode(500, 400, false, 'test-chamber-1');
        expect(node.id).toBe('test-chamber-1');
        expect(node.type).toBe('container');
        expect(node.title).toBe('New Portfolio');
        expect(node.width).toBe(520);
        expect(node.height).toBe(330);
        expect(node.x).toBe(500 - 260);
        expect(node.y).toBe(400 - 165);
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

    describe('archiving', () => {
        test('createNode should initialize archived as false and archivedAt as null', () => {
            const node = NodeManager.createNode(200, 200, true, 'node-archive-init');
            expect(node.archived).toBe(false);
            expect(node.archivedAt).toBeNull();
        });

        test('archiveNode should set archived to true, set archivedAt timestamp, and clear selected', () => {
            const node = { id: 'test-n', title: 'Scene 1', selected: true, archived: false };
            NodeManager.archiveNode(node);
            expect(node.archived).toBe(true);
            expect(node.selected).toBe(false);
            expect(typeof node.archivedAt).toBe('string');
            expect(new Date(node.archivedAt).getTime()).not.toBeNaN();
        });

        test('unarchiveNode should set archived to false and remove archivedAt', () => {
            const node = { id: 'test-n', title: 'Scene 1', archived: true, archivedAt: new Date().toISOString() };
            NodeManager.unarchiveNode(node);
            expect(node.archived).toBe(false);
            expect(node.archivedAt).toBeUndefined();
        });

        test('getAllArchivedNodes gathers archived nodes and parent references', () => {
            const tree = [
                {
                    id: 'p1',
                    title: 'Active Portfolio',
                    archived: false,
                    children: [
                        { id: 's1', title: 'Active Sheet', archived: false },
                        { id: 's2', title: 'Archived Sheet in Active Portfolio', archived: true }
                    ]
                },
                {
                    id: 'p2',
                    title: 'Archived Portfolio',
                    archived: true,
                    children: [
                        { id: 's3', title: 'Sheet in Archived Portfolio', archived: false }
                    ]
                }
            ];

            const archivedList = NodeManager.getAllArchivedNodes(tree);
            expect(archivedList).toHaveLength(2);

            const s2Item = archivedList.find(i => i.node.id === 's2');
            expect(s2Item).toBeDefined();
            expect(s2Item.parent.id).toBe('p1');

            const p2Item = archivedList.find(i => i.node.id === 'p2');
            expect(p2Item).toBeDefined();
            expect(p2Item.parent).toBeNull();
        });

        test('deleteNodeRecursively removes target node anywhere in the tree', () => {
            const tree = [
                {
                    id: 'root-p',
                    title: 'Root',
                    children: [
                        { id: 'child-1', title: 'Child 1', children: [] },
                        { id: 'child-target', title: 'Target to Delete', children: [] }
                    ]
                },
                { id: 'root-other', title: 'Other' }
            ];

            const updated = NodeManager.deleteNodeRecursively('child-target', tree);
            expect(updated[0].children).toHaveLength(1);
            expect(updated[0].children[0].id).toBe('child-1');
        });

        test('getNodeAtPosition ignores archived nodes on desk canvas', () => {
            const activeNode = { id: 'active', x: 0, y: 0, width: 200, height: 100, archived: false };
            const archivedNode = { id: 'archived', x: 300, y: 0, width: 200, height: 100, archived: true };

            StateManager.setRootNodes([activeNode, archivedNode]);
            StateManager.setScale(1);
            StateManager.setOffsetX(0);
            StateManager.setOffsetY(0);

            // Clicking inside activeNode (50, 50) hits
            expect(NodeManager.getNodeAtPosition(50, 50)).toBe(activeNode);

            // Clicking inside archivedNode (350, 50) must return null (spatial presence gone)
            expect(NodeManager.getNodeAtPosition(350, 50)).toBeNull();
        });
    });
});
