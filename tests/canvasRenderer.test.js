require('../js/constants.js');
const CanvasRenderer = require('../js/canvasRenderer.js');

describe('MyProjectCanvasRenderer Unit Tests', () => {
    let mockCtx;
    let mockCanvas;

    beforeEach(() => {
        mockCtx = {
            clearRect: jest.fn(),
            save: jest.fn(),
            restore: jest.fn(),
            translate: jest.fn(),
            scale: jest.fn(),
            beginPath: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            fillRect: jest.fn(),
            fillText: jest.fn(),
            measureText: jest.fn(() => ({ width: 50 })),
            roundRect: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            quadraticCurveTo: jest.fn(),
            setLineDash: jest.fn(),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            shadowColor: '',
            shadowBlur: 0,
            shadowOffsetY: 0,
            globalAlpha: 1,
            font: '',
            textAlign: '',
            textBaseline: ''
        };

        mockCanvas = {
            getContext: jest.fn(() => mockCtx),
            width: 1000,
            height: 800,
            getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0 }))
        };

        CanvasRenderer.init(mockCanvas, (text) => text.split(/\s+/).length);
        CanvasRenderer.setActiveTagFilter(null);
    });

    describe('Filter state and matching', () => {
        test('should set and get active tag filter', () => {
            CanvasRenderer.setActiveTagFilter('#scholar');
            expect(CanvasRenderer.getActiveTagFilter()).toBe('#scholar');

            CanvasRenderer.setActiveTagFilter('  ');
            expect(CanvasRenderer.getActiveTagFilter()).toBeNull();

            CanvasRenderer.setActiveTagFilter(null);
            expect(CanvasRenderer.getActiveTagFilter()).toBeNull();
        });

        test('should match node by hashtag prefix', () => {
            const node = {
                id: '1',
                title: 'Introduction',
                tags: ['Prologue', 'Draft', 'Character-Arc']
            };

            expect(CanvasRenderer.nodeMatchesFilter(node, '#prologue')).toBe(true);
            expect(CanvasRenderer.nodeMatchesFilter(node, '#draft')).toBe(true);
            expect(CanvasRenderer.nodeMatchesFilter(node, '#character')).toBe(true);
            expect(CanvasRenderer.nodeMatchesFilter(node, '#epilogue')).toBe(false);
        });

        test('should match node by general text keyword in tags, title, or content', () => {
            const node = {
                id: '2',
                title: 'The Jeffersonian Desk',
                content: 'Refined workspace with ink and parchment.',
                tags: ['archival']
            };

            expect(CanvasRenderer.nodeMatchesFilter(node, 'desk')).toBe(true);
            expect(CanvasRenderer.nodeMatchesFilter(node, 'parchment')).toBe(true);
            expect(CanvasRenderer.nodeMatchesFilter(node, 'archival')).toBe(true);
            expect(CanvasRenderer.nodeMatchesFilter(node, 'skyscraper')).toBe(false);
        });

        test('should return true if filter is empty or null', () => {
            const node = { id: '3', title: 'Test' };
            expect(CanvasRenderer.nodeMatchesFilter(node, '')).toBe(true);
            expect(CanvasRenderer.nodeMatchesFilter(node, null)).toBe(true);
        });
    });

    describe('World coordinate transformation', () => {
        test('should convert client mouse coordinates to world coordinates accurately', () => {
            // Center of canvas: (500, 400), scale: 1, offset: (0, 0)
            const worldPos = CanvasRenderer.getCanvasWorldPosition(500, 400, mockCanvas, 1, 0, 0);
            expect(worldPos.x).toBe(500);
            expect(worldPos.y).toBe(400);

            // Zoomed 2x with offset (100, 50)
            const worldPosZoomed = CanvasRenderer.getCanvasWorldPosition(600, 500, mockCanvas, 2, 100, 50);
            expect(worldPosZoomed.x).toBe(650); // (600 - 500)/2 + 500 + 100 = 650
            expect(worldPosZoomed.y).toBe(500); // (500 - 400)/2 + 400 + 50 = 500
        });
    });

    describe('Rendering with Desk Tag Filtering', () => {
        test('should draw desk grid and visible nodes in draw routine', () => {
            const rootNodes = [
                { id: 'n1', x: 100, y: 100, width: 250, height: 150, type: 'container', title: 'Portfolio 1', tags: ['work'] },
                { id: 'n2', x: 400, y: 100, width: 250, height: 150, type: 'text', title: 'Sheet 1', tags: ['draft'], content: 'Hello world' }
            ];

            CanvasRenderer.draw(rootNodes, [], rootNodes, 1, 0, 0, null);

            expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 1000, 800);
            expect(mockCtx.save).toHaveBeenCalled();
            expect(mockCtx.restore).toHaveBeenCalled();
            expect(mockCtx.roundRect).toHaveBeenCalled();
        });

        test('should draw filter trellis lines when multiple nodes match active filter', () => {
            const currentNodes = [
                { id: 'n1', x: 100, y: 100, width: 250, height: 150, type: 'text', title: 'Chapter 1', tags: ['novel'] },
                { id: 'n2', x: 500, y: 100, width: 250, height: 150, type: 'text', title: 'Chapter 2', tags: ['novel'] }
            ];

            CanvasRenderer.setActiveTagFilter('#novel');
            CanvasRenderer.draw(currentNodes, [], currentNodes, 1, 0, 0, null);

            // Should have invoked quadraticCurveTo for trellis vector connector
            expect(mockCtx.quadraticCurveTo).toHaveBeenCalled();
            expect(mockCtx.fillText).toHaveBeenCalledWith('#novel', expect.any(Number), expect.any(Number));
        });

        test('should dim non-matching nodes when filter is active', () => {
            const matchingNode = { id: 'm1', x: 0, y: 0, width: 200, height: 100, type: 'text', title: 'Matched', tags: ['special'] };
            const nonMatchingNode = { id: 'nm1', x: 300, y: 0, width: 200, height: 100, type: 'text', title: 'Other', tags: ['plain'] };

            CanvasRenderer.setActiveTagFilter('#special');

            CanvasRenderer._drawNode(nonMatchingNode, true, false, 1);
            expect(mockCtx.globalAlpha).toBe(0.25); // dimmed textAlpha

            CanvasRenderer._drawNode(matchingNode, true, false, 1);
            expect(mockCtx.globalAlpha).toBe(1.0); // full alpha
        });

        test('should extract plain text from html content', () => {
            const html = '<p>The <strong>quick</strong> brown fox &amp; the lazy dog.&nbsp;More text.</p>';
            const plain = CanvasRenderer._extractPlainText(html);
            expect(plain).toBe('The quick brown fox & the lazy dog. More text.');
        });

        test('should wrap text into lines respecting maxLines', () => {
            mockCtx.measureText.mockImplementation((text) => ({ width: text.length * 8 }));
            const text = 'This is a long sentence that should be wrapped across multiple lines on the card';
            const lines = CanvasRenderer._wrapTextLines(text, 100, 2);
            expect(lines.length).toBeLessThanOrEqual(2);
            expect(lines[lines.length - 1].endsWith('...')).toBe(true);
        });

        test('should render prose excerpt on sheet cards and children on portfolio cards', () => {
            const sheetNode = {
                id: 's1',
                x: 10,
                y: 10,
                width: 340,
                height: 210,
                type: 'text',
                title: 'Essay Draft',
                content: '<p>In the beginning was the Word, and the Word was with God.</p>',
                tags: ['philosophy']
            };
            CanvasRenderer._drawNode(sheetNode, true, false, 1);
            expect(mockCtx.fillText).toHaveBeenCalledWith(
                expect.stringContaining('In the beginning'),
                expect.any(Number),
                expect.any(Number)
            );

            const portfolioNode = {
                id: 'p1',
                x: 10,
                y: 10,
                width: 340,
                height: 210,
                type: 'container',
                title: 'Essays',
                children: [
                    { id: 'c1', type: 'text', title: 'Chapter 1' },
                    { id: 'c2', type: 'text', title: 'Chapter 2' }
                ],
                tags: []
            };
            CanvasRenderer._drawNode(portfolioNode, true, false, 1);
            expect(mockCtx.fillText).toHaveBeenCalledWith(
                expect.stringContaining('Chapter 1'),
                expect.any(Number),
                expect.any(Number)
            );
        });
    });
});
