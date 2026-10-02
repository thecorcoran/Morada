const StateManager = require('../js/stateManager.js');

describe('MyProjectStateManager', () => {
    beforeEach(() => {
        // Reset state before each test
        StateManager.setRootNodes([]);
        StateManager.setSelectedNode(null);
        StateManager.setScale(1);
        StateManager.setOffsetX(0);
        StateManager.setOffsetY(0);
    });

    test('should initialize with default state', () => {
        const state = StateManager.getState();
        expect(state.rootNodes).toEqual([]);
        expect(state.viewStack).toEqual([]);
        expect(state.currentNodes).toEqual([]);
        expect(state.selectedNode).toBeNull();
        expect(state.scale).toBe(1);
        expect(state.offsetX).toBe(0);
        expect(state.offsetY).toBe(0);
    });

    test('should set and retrieve root nodes, resetting viewStack and currentNodes', () => {
        const testNodes = [
            { id: 'node-1', title: 'Chapter 1', type: 'container', children: [] },
            { id: 'node-2', title: 'Notes', type: 'text', content: 'Sample text' }
        ];

        StateManager.pushToViewStack({ id: 'dummy' });
        expect(StateManager.getViewStack().length).toBe(1);

        StateManager.setRootNodes(testNodes);
        expect(StateManager.getRootNodes()).toEqual(testNodes);
        expect(StateManager.getCurrentNodes()).toEqual(testNodes);
        expect(StateManager.getViewStack()).toEqual([]);
    });

    test('should manage selected node and update selected property', () => {
        const nodeA = { id: 'a', title: 'A', selected: false };
        const nodeB = { id: 'b', title: 'B', selected: false };

        StateManager.setSelectedNode(nodeA);
        expect(StateManager.getSelectedNode()).toBe(nodeA);
        expect(nodeA.selected).toBe(true);

        StateManager.setSelectedNode(nodeB);
        expect(nodeA.selected).toBe(false);
        expect(nodeB.selected).toBe(true);
        expect(StateManager.getSelectedNode()).toBe(nodeB);

        StateManager.setSelectedNode(null);
        expect(nodeB.selected).toBe(false);
        expect(StateManager.getSelectedNode()).toBeNull();
    });

    test('should manage viewport scale and offset coordinates', () => {
        StateManager.setScale(1.75);
        StateManager.setOffsetX(250);
        StateManager.setOffsetY(-120);

        expect(StateManager.getScale()).toBe(1.75);
        expect(StateManager.getOffsetX()).toBe(250);
        expect(StateManager.getOffsetY()).toBe(-120);
    });

    test('should manage viewStack navigation push and pop', () => {
        const parentNode = { id: 'parent', title: 'Parent Chamber' };
        StateManager.pushToViewStack(parentNode);

        expect(StateManager.getViewStack()).toHaveLength(1);
        expect(StateManager.getViewStack()[0]).toBe(parentNode);

        const popped = StateManager.popFromViewStack();
        expect(popped).toBe(parentNode);
        expect(StateManager.getViewStack()).toHaveLength(0);
    });
});
