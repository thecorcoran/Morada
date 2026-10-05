const WarmUp = require('../js/warmUpPassages.js');
const UIManager = require('../js/uiManager.js');

describe('5-Minute Warm-Up System & Escape Key Audit', () => {
    describe('WarmUpPassages Module', () => {
        test('has at least 15 curated passages focusing on Chesterton, Russian novels, and McCarthy', () => {
            const passages = WarmUp.getAllPassages();
            expect(Array.isArray(passages)).toBe(true);
            expect(passages.length).toBeGreaterThanOrEqual(15);

            const authors = passages.map(p => p.author);
            expect(authors.some(a => a.includes('Chesterton'))).toBe(true);
            expect(authors.some(a => a.includes('Tolstoy'))).toBe(true);
            expect(authors.some(a => a.includes('Dostoevsky'))).toBe(true);
            expect(authors.some(a => a.includes('Chekhov'))).toBe(true);
            expect(authors.some(a => a.includes('McCarthy'))).toBe(true);
        });

        test('getRandomPassage returns a valid passage and respects exclusion', () => {
            const p1 = WarmUp.getRandomPassage();
            expect(p1).toBeDefined();
            expect(p1.text).toBeTruthy();

            const p2 = WarmUp.getRandomPassage(p1.id);
            expect(p2).toBeDefined();
            if (WarmUp.getAllPassages().length > 1) {
                expect(p2.id).not.toBe(p1.id);
            }
        });

        test('getPassageById returns correct passage or null', () => {
            const p = WarmUp.getPassageById('chesterton-thursday');
            expect(p).not.toBeNull();
            expect(p.author).toBe('G.K. Chesterton');
            expect(p.work).toContain('The Man Who Was Thursday');

            expect(WarmUp.getPassageById('nonexistent-id')).toBeNull();
        });

        test('generateSheetContent creates rich copywork template HTML', () => {
            const passage = WarmUp.getPassageById('tolstoy-austerlitz');
            const html = WarmUp.generateSheetContent(passage);
            expect(html).toContain('Leo Tolstoy');
            expect(html).toContain('War and Peace');
            expect(html).toContain('5-Minute Copywork');
            expect(html).toContain(passage.text);
            expect(html).toContain('blockquote');
        });

        test('ensureWarmUpPortfolio creates Warm Up portfolio with 6 pre-populated copywork sheets', () => {
            const rootNodes = [];
            const mockNodeManager = {
                createNode: (x, y, isText, id) => ({
                    id,
                    x,
                    y,
                    width: isText ? 340 : 520,
                    height: isText ? 210 : 330,
                    type: isText ? 'text' : 'container',
                    title: isText ? 'New Sheet' : 'New Portfolio',
                    content: '',
                    tags: [],
                    children: [],
                    timer: { duration: 0, remaining: 0, running: false },
                    wordGoal: 0,
                    archived: false
                })
            };

            const portfolio = WarmUp.ensureWarmUpPortfolio(rootNodes, mockNodeManager);
            expect(portfolio).toBeDefined();
            expect(portfolio.title).toBe('Warm Up');
            expect(portfolio.type).toBe('container');
            expect(rootNodes.length).toBe(1);
            expect(rootNodes[0]).toBe(portfolio);

            // Verify children sheets
            expect(portfolio.children.length).toBe(6);
            const firstSheet = portfolio.children[0];
            expect(firstSheet.type).toBe('text');
            expect(firstSheet.timer.duration).toBe(300); // 5 minutes (300 seconds)
            expect(firstSheet.wordGoal).toBe(250);
            expect(firstSheet.content).toContain('blockquote');

            // Calling ensureWarmUpPortfolio again does not duplicate
            const existing = WarmUp.ensureWarmUpPortfolio(rootNodes, mockNodeManager);
            expect(existing).toBe(portfolio);
            expect(rootNodes.length).toBe(1);
        });
    });

    describe('UIManager startTimer method', () => {
        test('startTimer sets duration and starts the timer', () => {
            const mockDisplay = { textContent: '', classList: { remove: jest.fn(), add: jest.fn() } };
            const mockInput = { value: '30' };
            const mockBtn = { textContent: 'Start Timer' };

            UIManager.timerDurationInput = mockInput;
            UIManager.writingTimerDisplay = mockDisplay;
            UIManager.timerStartBtn = mockBtn;

            UIManager.startTimer(5);

            expect(mockInput.value).toBe(5);
            expect(UIManager._timerInterval).not.toBeNull();
            expect(mockBtn.textContent).toBe('Stop Timer');

            // Cleanup
            if (UIManager._timerInterval) {
                clearInterval(UIManager._timerInterval);
                UIManager._timerInterval = null;
            }
        });
    });
});
