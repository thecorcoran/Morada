// stateManager.js
// This module centralizes the application's state management.
console.log("stateManager.js loaded");

window.MyProjectStateManager = {
    _state: {
        rootNodes: [],
        viewStack: [],
        currentNodes: [],
        selectedNode: null,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
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
        this._state.selectedNode = node;
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

    // --- Convenience functions ---
    pushToViewStack(node) {
        this._state.viewStack.push(node);
    },
    popFromViewStack() {
        return this._state.viewStack.pop();
    },
};
