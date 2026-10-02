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
        expect(normalized.width).toBe(340);
        expect(normalized.height).toBe(210);
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

    test('should save nodes using atomic temporary file write and rename', async () => {
        const fileSystem = {};
        const operations = [];

        global.window.electronAPI = {
            getDataPaths: async () => ({
                dataPath: '/mock/morada-data.json',
                backupPath: '/mock/morada-data.json.bak'
            }),
            fs: {
                exists: async (p) => !!fileSystem[p],
                copyFile: async (src, dest) => {
                    operations.push(`copy:${src}->${dest}`);
                    fileSystem[dest] = fileSystem[src];
                },
                writeFile: async (filePath, content) => {
                    operations.push(`write:${filePath}`);
                    fileSystem[filePath] = content;
                },
                rename: async (oldPath, newPath) => {
                    operations.push(`rename:${oldPath}->${newPath}`);
                    fileSystem[newPath] = fileSystem[oldPath];
                    delete fileSystem[oldPath];
                },
                readFile: async (p) => fileSystem[p] || ''
            }
        };

        // Seed initial data
        fileSystem['/mock/morada-data.json'] = JSON.stringify([{ id: 'old-1', title: 'Old Chapter' }]);

        await DataStorage.init();

        const testNodes = [{ id: 'saved-1', title: 'Saved Chapter', children: [], tags: [] }];
        await DataStorage.saveNodes(testNodes);

        // Pre-save backup must occur before write
        expect(operations).toContain('copy:/mock/morada-data.json->/mock/morada-data.json.bak');
        // Atomic write must write to .tmp then rename
        expect(operations).toContain('write:/mock/morada-data.json.tmp');
        expect(operations).toContain('rename:/mock/morada-data.json.tmp->/mock/morada-data.json');
        expect(fileSystem['/mock/morada-data.json']).toContain('Saved Chapter');
    });

    test('should populate emergency localStorage mirror on saveNodes', async () => {
        let mockStorage = {};
        global.localStorage = {
            setItem: (k, v) => { mockStorage[k] = v; },
            getItem: (k) => mockStorage[k] || null
        };

        await DataStorage.init();
        await DataStorage.saveNodes([{ id: 'emerg-1', title: 'Emergency Draft' }]);

        expect(mockStorage['morada_emergency_backup']).toBeDefined();
        expect(mockStorage['morada_emergency_backup']).toContain('Emergency Draft');
    });

    test('should recover from backup (Tier 2) when primary file is corrupt', async () => {
        const fileSystem = {
            '/mock/morada-data.json': '{ corrupt json ...',
            '/mock/morada-data.json.bak': JSON.stringify([{ id: 'bak-1', title: 'Restored From Backup' }])
        };

        global.window.electronAPI = {
            getDataPaths: async () => ({
                dataPath: '/mock/morada-data.json',
                backupPath: '/mock/morada-data.json.bak'
            }),
            fs: {
                exists: async (p) => !!fileSystem[p],
                copyFile: async (src, dest) => { fileSystem[dest] = fileSystem[src]; },
                writeFile: async (p, content) => { fileSystem[p] = content; },
                rename: async (oldPath, newPath) => {
                    fileSystem[newPath] = fileSystem[oldPath];
                    delete fileSystem[oldPath];
                },
                readFile: async (p) => fileSystem[p]
            }
        };

        await DataStorage.init();
        const loaded = await DataStorage.loadNodes();

        expect(loaded).toHaveLength(1);
        expect(loaded[0].id).toBe('bak-1');
        expect(loaded[0].title).toBe('Restored From Backup');
    });

    test('should recover from localStorage (Tier 3) when primary and backup are unavailable', async () => {
        const fileSystem = {};
        global.localStorage = {
            getItem: (k) => {
                if (k === 'morada_emergency_backup') {
                    return JSON.stringify([{ id: 'ls-tier3', title: 'Rescued from LocalStorage' }]);
                }
                return null;
            },
            setItem: jest.fn()
        };

        global.window.electronAPI = {
            getDataPaths: async () => ({
                dataPath: '/mock/morada-data.json',
                backupPath: '/mock/morada-data.json.bak'
            }),
            fs: {
                exists: async () => false,
                copyFile: async () => {},
                writeFile: async (p, content) => { fileSystem[p] = content; },
                rename: async (oldP, newP) => { fileSystem[newP] = fileSystem[oldP]; delete fileSystem[oldP]; },
                readFile: async () => ''
            }
        };

        await DataStorage.init();
        const loaded = await DataStorage.loadNodes();

        expect(loaded).toHaveLength(1);
        expect(loaded[0].id).toBe('ls-tier3');
        expect(loaded[0].title).toBe('Rescued from LocalStorage');
    });
});
