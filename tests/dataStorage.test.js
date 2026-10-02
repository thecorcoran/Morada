const DataStorage = require('../js/dataStorage.js');

describe('MyProjectDataStorage', () => {
    beforeEach(() => {
        DataStorage.setInitialNodes([]);
        DataStorage.setSelectedNode(null);
        if (typeof DataStorage.clearManuscriptList === 'function') {
            DataStorage.clearManuscriptList();
        }
    });

    test('should manage root nodes storage and retrieval', () => {
        const sampleNodes = [
            { id: '1', title: 'Chapter 1', type: 'container', children: [] }
        ];
        DataStorage.setInitialNodes(sampleNodes);
        expect(DataStorage.getRootNodes()).toEqual(sampleNodes);
    });

    test('should manage selected node reference', () => {
        const node = { id: 'test-node', title: 'Test Node' };
        DataStorage.setSelectedNode(node);
        expect(DataStorage.getSelectedNode()).toBe(node);

        DataStorage.setSelectedNode(null);
        expect(DataStorage.getSelectedNode()).toBeNull();
    });

    test('should add and remove nodes from manuscript list without duplicates', () => {
        const nodeA = { id: 'node-a', title: 'Scene A' };
        const nodeB = { id: 'node-b', title: 'Scene B' };

        DataStorage.addToManuscriptList(nodeA);
        expect(DataStorage.getManuscriptList()).toHaveLength(1);
        expect(DataStorage.getManuscriptList()[0].id).toBe('node-a');

        // Adding duplicate should not duplicate
        DataStorage.addToManuscriptList(nodeA);
        expect(DataStorage.getManuscriptList()).toHaveLength(1);

        DataStorage.addToManuscriptList(nodeB);
        expect(DataStorage.getManuscriptList()).toHaveLength(2);

        DataStorage.removeFromManuscriptList('node-a');
        expect(DataStorage.getManuscriptList()).toHaveLength(1);
        expect(DataStorage.getManuscriptList()[0].id).toBe('node-b');
    });

    test('should normalize node objects ensuring all required fields exist', () => {
        const rawNodes = [
            {
                id: 'legacy-node',
                title: 'Old Node'
                // Missing x, y, width, height, tags, children, type, isExpanded, etc.
            }
        ];

        DataStorage.normalizeNodes(rawNodes);
        const normalized = rawNodes[0];
        expect(normalized.id).toBe('legacy-node');
        expect(normalized.title).toBe('Old Node');
        expect(typeof normalized.x).toBe('number');
        expect(typeof normalized.y).toBe('number');
        expect(normalized.width).toBe(250);
        expect(normalized.height).toBe(150);
        expect(Array.isArray(normalized.tags)).toBe(true);
        expect(Array.isArray(normalized.children)).toBe(true);
        expect(normalized.type).toBe('container');
    });

    test('should update node timer state', () => {
        const targetNode = { id: 'timer-node', title: 'Timed Node', children: [] };
        DataStorage.setInitialNodes([targetNode]);

        const updated = DataStorage.updateNodeTimer('timer-node', {
            duration: 1500,
            remaining: 1200,
            running: true
        });

        expect(updated).toBe(true);
        expect(targetNode.timer).toBeDefined();
        expect(targetNode.timer.duration).toBe(1500);
        expect(targetNode.timer.remaining).toBe(1200);
        expect(targetNode.timer.running).toBe(true);
    });

    test('should save and load nodes using electronAPI mock', async () => {
        let storageFileContent = '';
        global.window.electronAPI = {
            getDataPaths: async () => ({
                dataPath: '/mock/morada-data.json',
                backupPath: '/mock/morada-data.json.bak'
            }),
            fs: {
                exists: async () => true,
                copyFile: async () => {},
                writeFile: async (filePath, content) => {
                    storageFileContent = content;
                },
                readFile: async () => storageFileContent
            }
        };

        await DataStorage.init();

        const testNodes = [{ id: 'saved-1', title: 'Saved Chapter', children: [], tags: [] }];
        await DataStorage.saveNodes(testNodes);

        expect(storageFileContent).toContain('Saved Chapter');

        const loaded = await DataStorage.loadNodes();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].title).toBe('Saved Chapter');
    });
});
