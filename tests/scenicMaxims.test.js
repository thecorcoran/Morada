const ScenicMaxims = require('../js/scenicMaxims');

describe('Scenic Maxims (55 Maxims of the Scenic Method)', () => {
    test('contains exactly 55 maxims', () => {
        const all = ScenicMaxims.getAllMaxims();
        expect(Array.isArray(all)).toBe(true);
        expect(all.length).toBe(55);
        all.forEach((m, idx) => {
            expect(m.id).toBe(idx + 1);
            expect(typeof m.text).toBe('string');
            expect(m.text.length).toBeGreaterThan(5);
            expect(typeof m.category).toBe('string');
            expect(typeof m.categoryLabel).toBe('string');
        });
    });

    test('first and last maxims match user specifications', () => {
        const first = ScenicMaxims.getMaximById(1);
        expect(first.text).toBe('Create a Fictional Dream and never wake the reader up.');

        const maxim2 = ScenicMaxims.getMaximById(2);
        expect(maxim2.text).toBe('Render, never report.');

        const maxim3 = ScenicMaxims.getMaximById(3);
        expect(maxim3.text).toBe('Show, do not tell.');

        const maxim55 = ScenicMaxims.getMaximById(55);
        expect(maxim55.text).toBe('Serve the vision of the story, not your own ego.');
    });

    test('categories filter properly', () => {
        const categories = ScenicMaxims.categories;
        expect(categories.length).toBeGreaterThanOrEqual(6);

        const dreamMaxims = ScenicMaxims.getMaximsByCategory('dream');
        expect(dreamMaxims.length).toBeGreaterThan(0);
        dreamMaxims.forEach(m => expect(m.category).toBe('dream'));

        const conflictMaxims = ScenicMaxims.getMaximsByCategory('conflict');
        expect(conflictMaxims.length).toBeGreaterThan(0);

        const dialogueMaxims = ScenicMaxims.getMaximsByCategory('dialogue');
        expect(dialogueMaxims.length).toBe(3); // Maxims 15, 16, 17

        const all = ScenicMaxims.getMaximsByCategory('all');
        expect(all.length).toBe(55);
    });

    test('getRandomMaxim returns a valid maxim within the requested category', () => {
        const randomAny = ScenicMaxims.getRandomMaxim();
        expect(randomAny).toBeDefined();
        expect(randomAny.id).toBeGreaterThanOrEqual(1);
        expect(randomAny.id).toBeLessThanOrEqual(55);

        const randomDialogue = ScenicMaxims.getRandomMaxim('dialogue');
        expect(randomDialogue.category).toBe('dialogue');
    });

    test('searchMaxims finds maxims by keywords', () => {
        const dialogueResults = ScenicMaxims.searchMaxims('dialogue');
        expect(dialogueResults.length).toBeGreaterThanOrEqual(3);

        const birdResults = ScenicMaxims.searchMaxims('nuthatch');
        expect(birdResults.length).toBe(1);
        expect(birdResults[0].id).toBe(51);

        const emptySearch = ScenicMaxims.searchMaxims('');
        expect(emptySearch.length).toBe(55);
    });
});
