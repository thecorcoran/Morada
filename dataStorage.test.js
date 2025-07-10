import { dataStorageManager } from './dataStorage.js';

// Mock the electronAPI exposed from preload.js
const mockFs = {
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  copyFile: jest.fn(),
  rename: jest.fn(),
};

global.window = {
  electronAPI: {
    getDataPaths: jest.fn().mockResolvedValue({
      dataPath: 'fake/path/data.json',
      backupPath: 'fake/path/data.json.bak',
    }),
    fs: mockFs,
  },
  alert: jest.fn(), // Mock alert to prevent it from blocking tests
};

// Mock the constants module
jest.mock('./constants.js', () => ({
  NodeConstants: {
    NODE_WIDTH: 100,
    NODE_HEIGHT: 50,
  },
  // Add other constant groups if needed by the module, even if empty
}));

describe('DataStorageManager', () => {
  // Reset all mock functions before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveData', () => {
    const dataToSave = { nodes: [{ id: '1' }], manuscript: [] };

    it('should write to a temp file and then rename it', async () => {
      mockFs.exists.mockResolvedValue(false); // No existing file

      await dataStorageManager.loadData(); // To set internal paths
      await dataStorageManager.saveData(dataToSave);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        'fake/path/data.json.tmp',
        expect.any(String),
        'utf8'
      );
      expect(mockFs.rename).toHaveBeenCalledWith(
        'fake/path/data.json.tmp',
        'fake/path/data.json'
      );
      expect(mockFs.copyFile).not.toHaveBeenCalled();
    });

    it('should create a backup if the main data file exists', async () => {
      mockFs.exists.mockResolvedValue(true); // File exists

      await dataStorageManager.loadData();
      await dataStorageManager.saveData(dataToSave);

      expect(mockFs.copyFile).toHaveBeenCalledWith(
        'fake/path/data.json',
        'fake/path/data.json.bak'
      );
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('should throw an error if writing fails', async () => {
      mockFs.exists.mockResolvedValue(false);
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await dataStorageManager.loadData();

      await expect(dataStorageManager.saveData(dataToSave)).rejects.toThrow('Disk full');
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Critical error saving data'));
    });
  });

  describe('loadData', () => {
    it('should load and parse data from the main file if it exists', async () => {
      const fileContent = JSON.stringify({ nodes: [{ id: '1' }], manuscript: [] });
      mockFs.exists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(fileContent);

      const data = await dataStorageManager.loadData();

      expect(mockFs.readFile).toHaveBeenCalledWith('fake/path/data.json', 'utf8');
      expect(data.nodes).toHaveLength(1);
      expect(data.nodes[0].id).toBe('1');
    });

    it('should restore from backup if main file does not exist', async () => {
      const backupContent = JSON.stringify({ nodes: [{ id: 'backup' }], manuscript: [] });
      // Main file doesn't exist, backup does
      mockFs.exists.mockImplementation(path => path.endsWith('.bak'));
      mockFs.readFile.mockResolvedValue(backupContent);

      const data = await dataStorageManager.loadData();

      expect(mockFs.readFile).toHaveBeenCalledWith('fake/path/data.json.bak', 'utf8');
      expect(mockFs.copyFile).toHaveBeenCalledWith('fake/path/data.json.bak', 'fake/path/data.json');
      expect(data.nodes[0].id).toBe('backup');
    });

    it('should restore from backup if main file is corrupt', async () => {
      const backupContent = JSON.stringify({ nodes: [{ id: 'backup' }], manuscript: [] });
      mockFs.exists.mockResolvedValue(true); // Both files exist
      // Main file is corrupt, backup is fine
      mockFs.readFile.mockImplementation(path => {
        if (path.endsWith('.bak')) {
          return Promise.resolve(backupContent);
        }
        return Promise.resolve('this is not valid json');
      });

      const data = await dataStorageManager.loadData();

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error loading data'));
      expect(mockFs.copyFile).toHaveBeenCalled();
      expect(data.nodes[0].id).toBe('backup');
    });

    it('should return an empty state if no files exist', async () => {
      mockFs.exists.mockResolvedValue(false); // No files exist

      const data = await dataStorageManager.loadData();

      expect(data).toEqual({ nodes: [], manuscript: [] });
      expect(mockFs.readFile).not.toHaveBeenCalled();
    });
  });

  describe('normalizeNodes', () => {
    it('should add default properties to a minimal node', () => {
      const nodes = [{ title: 'Test Node' }];
      dataStorageManager.normalizeNodes(nodes);

      const node = nodes[0];
      expect(node).toHaveProperty('id');
      expect(node.x).toBe(0);
      expect(node.y).toBe(0);
      expect(node.width).toBe(100);
      expect(node.height).toBe(50);
      expect(node.children).toEqual([]);
      expect(node.tags).toEqual([]);
      expect(node.comments).toEqual([]);
      expect(node.certifiedWords).toEqual([]);
    });

    it('should not overwrite existing valid properties', () => {
      const nodes = [{ id: '123', x: 50, title: 'Existing' }];
      dataStorageManager.normalizeNodes(nodes);

      expect(nodes[0].id).toBe('123');
      expect(nodes[0].x).toBe(50);
      expect(nodes[0].title).toBe('Existing');
    });

    it('should normalize children recursively', () => {
      const nodes = [{
        title: 'Parent',
        children: [{ title: 'Child' }]
      }];
      dataStorageManager.normalizeNodes(nodes);

      const child = nodes[0].children[0];
      expect(child).toHaveProperty('id');
      expect(child.x).toBe(0);
      expect(child.tags).toEqual([]);
    });
  });
});