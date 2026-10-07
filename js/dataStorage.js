// dataStorage.js
// This module is responsible for data storage, including loading, saving,
// and normalizing node data, as well as managing application-level selections
// like the currently selected node and the manuscript list for compilation.
if (typeof window === 'undefined') {
  global.window = global;
}

window.MyProjectDataStorage = {
  /** @type {string} Stores the active data path after it's set by loadNodes. */
  _activeDataPath: '',
  /** @type {string} Stores the active backup data path. */
  _backupDataPath: '',

  _rootNodes: [],
  _internalSelectedNode: null,
  _internalManuscriptList: [],

  /**
   * Initializes the data storage module by fetching the data paths from the main process
   * or falling back gracefully to localStorage when running in a web or mobile browser.
   */
  async init() {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getDataPaths === 'function') {
      const paths = await window.electronAPI.getDataPaths();
      this._activeDataPath = paths.dataPath;
      this._backupDataPath = paths.backupPath;
    } else {
      // Browser / mobile / web fallback
      this._activeDataPath = 'morada_active_data';
      this._backupDataPath = 'morada_backup_data';
    }
  },

  /**
   * Sets the initial root nodes for the application.
   * @param {Array<Object>} nodes - The array of root node objects.
   */
  setInitialNodes: function(nodes) {
    this._rootNodes = nodes;
  },

  /**
   * Retrieves the current root nodes.
   * @returns {Array<Object>} The array of root node objects.
   */
  getRootNodes: function() {
    return this._rootNodes;
  },

  /**
   * Default starter guide nodes provided on fresh launch or web preview
   * so first-time users immediately see an organized, tactile desk.
   * @returns {Array<Object>}
   */
  getDefaultStarterNodes() {
    return [
      {
        id: 'node-welcome-portfolio',
        title: 'Welcome to Morada',
        type: 'container',
        x: 80,
        y: 80,
        width: 320,
        height: 200,
        tags: ['#welcome'],
        isExpanded: true,
        children: [
          {
            id: 'node-welcome-sheet',
            title: 'Your First Scene',
            type: 'text',
            content: 'Welcome to **Morada** — a visual, fractal writing environment designed for deep creative focus and scenic construction.\n\nDouble-click or double-tap this sheet to open the prose editor. Use the *Craft Drawer* on the right for **Strunk & White** stylistic auditing and **Scenic Method** craft maxims.',
            x: 60,
            y: 60,
            width: 300,
            height: 180,
            tags: ['#draft'],
            children: []
          }
        ]
      },
      {
        id: 'node-getting-started-sheet',
        title: 'The Scholar\'s Guide',
        type: 'text',
        content: '**Quick Gestures & Controls:**\n\n• **Double-click or double-tap** empty canvas space to create a new card.\n• **Click + Sheet** in the masthead to add a new scene.\n• **Drag** cards to arrange them visually across your desk.\n• **Manuscript Press** at the top compiles your work into Word (.docx), HTML, or Markdown.',
        x: 460,
        y: 80,
        width: 320,
        height: 200,
        tags: ['#guide'],
        children: []
      }
    ];
  },

  /**
   * Saves the provided tree of nodes to the JSON file or browser localStorage.
   * It creates a backup of the existing data file, updates an emergency mirror,
   * and performs an atomic write (write to .tmp then rename) so the main data file
   * is never corrupted if power is lost during write.
   * @param {Array<Object>} rootNodesToSave - The array of root node objects to save.
   */
  async saveNodes(rootNodesToSave) {
    if (!this._activeDataPath) {
      console.error("Error saving nodes: Data path not set. Call init first.");
      return;
    }
    try {
      // 1. Create a pre-save backup of the current data file before saving (Electron)
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.fs && typeof window.electronAPI.fs.exists === 'function') {
        if (await window.electronAPI.fs.exists(this._activeDataPath)) {
          try {
            await window.electronAPI.fs.copyFile(this._activeDataPath, this._backupDataPath);
          } catch (backupErr) {
            console.warn("[Storage] Backup creation skipped:", backupErr && backupErr.message);
          }
        }
      }

      // 2. Prepare JSON data
      const data = JSON.stringify(rootNodesToSave, null, 2);

      // 3. Emergency mirror in localStorage if available (Web, Mobile, and Electron recovery)
      try {
        if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
          localStorage.setItem('morada_emergency_backup', data);
          localStorage.setItem(this._activeDataPath, data);
        }
      } catch (lsErr) {}

      // 4. Atomic write: write to a .tmp file then rename over the active file (Electron)
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.fs) {
        if (typeof window.electronAPI.fs.rename === 'function') {
          const tempPath = this._activeDataPath + '.tmp';
          await window.electronAPI.fs.writeFile(tempPath, data);
          await window.electronAPI.fs.rename(tempPath, this._activeDataPath);
        } else if (typeof window.electronAPI.fs.writeFile === 'function') {
          await window.electronAPI.fs.writeFile(this._activeDataPath, data);
        }
      }
    } catch (err) {
      console.error(`Error saving nodes to ${this._activeDataPath}: ${err.message}`, err);
    }
  },

  /**
   * Loads nodes from the JSON file with triple-tier resilience:
   * Tier 1: Primary data file (morada-data.json)
   * Tier 2: Automated backup file (morada-data.json.bak)
   * Tier 3: Emergency localStorage mirror (morada_emergency_backup)
   * Tier 4: Starter guide nodes (Welcome to Morada)
   * @returns {Array<Object>} The loaded (and normalized) array of root node objects.
   */
  async loadNodes() {
    if (!this._activeDataPath) {
      await this.init(); // Ensure paths are loaded
    }

    this._internalSelectedNode = null;
    this._internalManuscriptList = [];

    const loadFromFile = async (filePath) => {
      try {
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.fs && typeof window.electronAPI.fs.exists === 'function') {
          if (await window.electronAPI.fs.exists(filePath)) {
            const data = await window.electronAPI.fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            let nodes = Array.isArray(parsed) ? parsed : (parsed.nodes || parsed.manuscript || parsed.rootNodes || []);
            this._rootNodes = nodes;
            this.normalizeNodes(this._rootNodes);
            console.log(`Nodes loaded successfully from ${filePath}`);
            return this._rootNodes;
          }
        }
      } catch (err) {
        console.error(`Error loading or parsing file from ${filePath}: ${err.message}`, err);
      }
      return null;
    };

    // Tier 1: Try active data file (Electron)
    let loadedData = await loadFromFile(this._activeDataPath);

    // Tier 2: Try .bak file (Electron)
    if (loadedData === null && typeof window !== 'undefined' && window.electronAPI && window.electronAPI.fs && typeof window.electronAPI.fs.exists === 'function') {
      if (await window.electronAPI.fs.exists(this._backupDataPath)) {
        console.log("Attempting to load from backup file.");
        loadedData = await loadFromFile(this._backupDataPath);
        if (loadedData !== null) {
          await this.saveNodes(loadedData);
        }
      }
    }

    // Tier 3: Try localStorage mirror (Browser, Mobile, or Electron recovery)
    if (loadedData === null && typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      try {
        const storedData = localStorage.getItem(this._activeDataPath) || localStorage.getItem('morada_emergency_backup');
        if (storedData) {
          console.warn("[Storage] Recovering data from emergency localStorage mirror.");
          const parsed = JSON.parse(storedData);
          let nodes = Array.isArray(parsed) ? parsed : (parsed.nodes || parsed.manuscript || parsed.rootNodes || []);
          if (nodes.length > 0) {
            this._rootNodes = nodes;
            this.normalizeNodes(this._rootNodes);
            await this.saveNodes(this._rootNodes);
            return this._rootNodes;
          }
        }
      } catch (lsErr) {
        console.warn("[Storage] Failed to read emergency backup from localStorage:", lsErr);
      }
    }

    if (loadedData === null) {
      console.log("Starting with default starter dataset.");
      this._rootNodes = this.getDefaultStarterNodes();
      this.normalizeNodes(this._rootNodes);
      return this._rootNodes;
    }

    return loadedData;
  },

  /**
   * Restores the main data file from the backup file or browser storage.
   * @returns {boolean} True if restoration was successful, false otherwise.
   */
  async restoreFromBackup() {
    if (!this._backupDataPath) {
      console.error("Backup path not set. Call init first.");
      return false;
    }
    try {
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.fs && typeof window.electronAPI.fs.exists === 'function') {
        if (await window.electronAPI.fs.exists(this._backupDataPath)) {
          await window.electronAPI.fs.copyFile(this._backupDataPath, this._activeDataPath);
          console.log(`Successfully restored data from ${this._backupDataPath} to ${this._activeDataPath}`);
          return true;
        } else {
          console.warn("No backup file found to restore from.");
          return false;
        }
      } else if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        const backupData = localStorage.getItem(this._backupDataPath) || localStorage.getItem('morada_emergency_backup');
        if (backupData) {
          localStorage.setItem(this._activeDataPath, backupData);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error(`Error restoring from backup: ${err.message}`, err);
      return false;
    }
  },

  /**
   * Sets the currently selected node in the application.
   * @param {Object|null} node - The node object to set as selected, or null to clear selection.
   */
  setSelectedNode: function(node) {
    this._internalSelectedNode = node;
  },

  /**
   * Gets the currently selected node.
   * @returns {Object|null} The currently selected node object, or null if no node is selected.
   */
  getSelectedNode: function() {
    return this._internalSelectedNode;
  },

  /**
   * Gets the current list of nodes selected for the manuscript.
   * @returns {Array<Object>} An array of node objects in the manuscript list.
   */
  getManuscriptList: function() {
    return this._internalManuscriptList;
  },

  /**
   * Adds a node to the manuscript list if it's not already present.
   * @param {Object} node - The node object to add to the manuscript list.
   */
  addToManuscriptList: function(node) {
    if (!this._internalManuscriptList.find(item => item.id === node.id)) {
      this._internalManuscriptList.push(node);
    }
  },

  /**
   * Removes a node from the manuscript list by its ID.
   * @param {string} nodeId - The ID of the node to remove from the manuscript list.
   */
  removeFromManuscriptList: function(nodeId) {
    this._internalManuscriptList = this._internalManuscriptList.filter(item => item.id !== nodeId);
  },

  /**
   * Clears all nodes from the manuscript list.
   */
  clearManuscriptList: function() {
    this._internalManuscriptList = [];
  },

  /**
   * Recursively normalizes an array of nodes and their children.
   * Ensures essential properties exist and have default values.
   * @param {Array<Object>} nodesToNormalize - The array of node objects to normalize.
   */
  normalizeNodes: function(nodesToNormalize) {
    nodesToNormalize.forEach(node => {
      node.id = node.id || Date.now() + Math.random().toString(36).substr(2, 9);
      node.x = typeof node.x === 'number' ? node.x : 0;
      node.y = typeof node.y === 'number' ? node.y : 0;
      const defaultW = (window.AppConstants ? AppConstants.NODE_WIDTH : 340);
      const defaultH = (window.AppConstants ? AppConstants.NODE_HEIGHT : 210);
      if (!node.width || (node.width === 250 && node.height === 150)) {
        node.width = defaultW;
      }
      if (!node.height || (node.width === defaultW && node.height === 150)) {
        node.height = defaultH;
      }

      if (!Array.isArray(node.children)) node.children = [];
      if (typeof node.type !== 'string') node.type = 'container';
      if (typeof node.title !== 'string') node.title = 'Untitled';
      if (typeof node.content !== 'string') {
        node.content = '';
      } else if (node.content && (/<[a-z][\s\S]*>/i.test(node.content) || /&[a-z]+;/i.test(node.content) || /&#\d+;/i.test(node.content))) {
        node.content = this.cleanHtmlToProse(node.content);
      }
      if (!Array.isArray(node.tags)) node.tags = [];
  // Per-node word goal and timer support
  if (typeof node.wordGoal !== 'number') node.wordGoal = 0;
  if (!node.timer || typeof node.timer !== 'object') node.timer = { duration: 0, remaining: 0, running: false };
  // Ensure per-node comment and certified word storage exists for stability
  if (!Array.isArray(node.comments)) node.comments = [];
  if (!Array.isArray(node.certifiedWords)) node.certifiedWords = [];

      node.isExpanded = typeof node.isExpanded === 'boolean' ? node.isExpanded : false;
      node.selected = typeof node.selected === 'boolean' ? node.selected : false;
      node.archived = typeof node.archived === 'boolean' ? node.archived : false;

      if (node.children.length > 0) {
        this.normalizeNodes(node.children);
      }
    });
  },

  /**
   * Converts HTML fragments or legacy formatted text into clean prose / Markdown.
   * Strips HTML tags, decodes entities, and preserves layout.
   * @param {string} text
   * @returns {string}
   */
  cleanHtmlToProse: function(text) {
    if (!text || typeof text !== 'string') return '';
    if (!/<[a-z][\s\S]*>/i.test(text) && !/&[a-z]+;/i.test(text) && !/&#\d+;/i.test(text)) {
      return text;
    }

    let out = text;
    out = out.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
    out = out.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
    out = out.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
    out = out.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
    out = out.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, c) => {
      const inner = c.trim().replace(/^[\n\r]+|[\n\r]+$/g, '');
      return inner.split('\n').map(l => '> ' + l.trim()).join('\n') + '\n\n';
    });
    out = out.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    out = out.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    out = out.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    out = out.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
    out = out.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n');
    out = out.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
    out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
    out = out.replace(/<br\s*\/?>/gi, '\n');
    out = out.replace(/<\/p>/gi, '\n\n');
    out = out.replace(/<p[^>]*>/gi, '');
    out = out.replace(/<\/?[a-z0-9_-]+(?:\s+[^>]*)?>/gi, '');
    out = out
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&mdash;|&#8212;/g, '—')
      .replace(/&ndash;|&#8211;/g, '–')
      .replace(/&ldquo;|&#8220;/g, '"')
      .replace(/&rdquo;|&#8221;/g, '"')
      .replace(/&lsquo;|&#8216;/g, "'")
      .replace(/&rsquo;|&#8217;/g, "'")
      .replace(/&nbsp;|&#160;/g, ' ');
    return out.replace(/\n{3,}/g, '\n\n').trim();
  },
  /**
   * Adds a comment object to the specified node.
   * @param {string} nodeId
   * @param {{id:string, text:string, spanId?:string, createdAt?:number}} commentObj
   */
  addCommentToNode: function(nodeId, commentObj) {
    const node = this._findNodeById(nodeId, this._rootNodes);
    if (!node) return false;
    if (!Array.isArray(node.comments)) node.comments = [];
    node.comments.push(Object.assign({ createdAt: Date.now() }, commentObj));
    return true;
  },

  /**
   * Removes a comment from a node by comment id (or spanId)
   * @param {string} nodeId
   * @param {string} commentId
   */
  removeCommentFromNode: function(nodeId, commentId) {
    const node = this._findNodeById(nodeId, this._rootNodes);
    if (!node || !Array.isArray(node.comments)) return false;
    node.comments = node.comments.filter(c => c.id !== commentId && c.spanId !== commentId);
    return true;
  },

  addCertifiedWordToNode: function(nodeId, cwObj) {
    const node = this._findNodeById(nodeId, this._rootNodes);
    if (!node) return false;
    if (!Array.isArray(node.certifiedWords)) node.certifiedWords = [];
    node.certifiedWords.push(Object.assign({ createdAt: Date.now() }, cwObj));
    return true;
  },

  removeCertifiedWordFromNode: function(nodeId, spanId) {
    const node = this._findNodeById(nodeId, this._rootNodes);
    if (!node || !Array.isArray(node.certifiedWords)) return false;
    node.certifiedWords = node.certifiedWords.filter(cw => cw.spanId !== spanId);
    return true;
  },

  /**
   * Finds a node by id inside a nested nodes array.
   * @param {string} id
   * @param {Array<object>} nodes
   * @returns {object|null}
   */
  _findNodeById: function(id, nodes) {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children && n.children.length > 0) {
        const found = this._findNodeById(id, n.children);
        if (found) return found;
      }
    }
    return null;
  }
  ,

  /**
   * Set the word goal for a node and optionally persist.
   * @param {string} nodeId
   * @param {number} goal
   */
  setNodeWordGoal: function(nodeId, goal) {
    const node = this._findNodeById(nodeId, this._rootNodes);
    if (!node) return false;
    node.wordGoal = Number(goal) || 0;
    return true;
  },

  /**
   * Update a node's timer state (duration, remaining, running)
   * @param {string} nodeId
   * @param {{duration?:number,remaining?:number,running?:boolean}} state
   */
  updateNodeTimer: function(nodeId, state) {
    const node = this._findNodeById(nodeId, this._rootNodes);
    if (!node) return false;
    node.timer = node.timer || { duration: 0, remaining: 0, running: false };
    if (typeof state.duration === 'number') node.timer.duration = state.duration;
    if (typeof state.remaining === 'number') node.timer.remaining = state.remaining;
    if (typeof state.running === 'boolean') node.timer.running = state.running;
    return true;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MyProjectDataStorage;
}
