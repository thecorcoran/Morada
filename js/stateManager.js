if (typeof window === 'undefined') {
    global.window = global;
}

window.MyProjectStateManager = {
    _state: {
        rootNodes: [],
        viewStack: [],
        currentNodes: [],
        selectedNode: null,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        theme: (typeof localStorage !== 'undefined' && localStorage.getItem('morada_theme')) ? localStorage.getItem('morada_theme') : 'parchment',
    },

    getState() {
        return this._state;
    },

    // --- Getters ---
    getRootNodes() {
        return this._state.rootNodes;
    },
    getViewStack() {
        return this._state.viewStack;
    },
    getCurrentNodes() {
        return this._state.currentNodes;
    },
    getSelectedNode() {
        return this._state.selectedNode;
    },
    getScale() {
        return this._state.scale;
    },
    getOffsetX() {
        return this._state.offsetX;
    },
    getOffsetY() {
        return this._state.offsetY;
    },
    getTheme() {
        return this._state.theme || 'parchment';
    },

    // --- Setters ---
    setRootNodes(nodes) {
        this._state.rootNodes = nodes;
        this._state.currentNodes = nodes; // Reset currentNodes when root changes
        this._state.viewStack = []; // Reset viewStack when root changes
    },
    setViewStack(stack) {
        this._state.viewStack = stack;
    },
    setCurrentNodes(nodes) {
        this._state.currentNodes = nodes;
    },
    setSelectedNode(node) {
        // Clear previous selection flag if any
        if (this._state.selectedNode && typeof this._state.selectedNode === 'object') {
            this._state.selectedNode.selected = false;
        }
        this._state.selectedNode = node;
        if (node && typeof node === 'object') {
            node.selected = true;
        }
    },
    setScale(scale) {
        this._state.scale = scale;
    },
    setOffsetX(offset) {
        this._state.offsetX = offset;
    },
    setOffsetY(offset) {
        this._state.offsetY = offset;
    },
    setTheme(theme) {
        this._state.theme = (theme === 'midnight') ? 'midnight' : 'parchment';
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('morada_theme', this._state.theme);
            }
        } catch (e) {}
    },

    // --- Convenience functions ---
    pushToViewStack(node) {
        this._state.viewStack.push(node);
    },
    popFromViewStack() {
        return this._state.viewStack.pop();
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MyProjectStateManager;
}
