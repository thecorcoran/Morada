const UIManager = require('../js/uiManager.js');

// Global mock DOM setup for uiManager tests
beforeAll(() => {
    global.document = {
        createElement: (tag) => {
            let content = '';
            const spans = [];
            return {
                tagName: tag,
                set innerHTML(val) {
                    content = val || '';
                    // Match comment spans: <span class="comment-highlight" id="c1" data-comment="Check this">text</span>
                    const commentRegex = /<span class="comment-highlight"[^>]*id="([^"]*)"[^>]*data-comment="([^"]*)"[^>]*>([^<]*)<\/span>/g;
                    let match;
                    while ((match = commentRegex.exec(content)) !== null) {
                        spans.push({
                            className: 'comment-highlight',
                            id: match[1],
                            getAttribute: (attr) => attr === 'data-comment' ? match[2] : null,
                            textContent: match[3],
                            parentNode: {
                                insertBefore: (marker) => {
                                    content = content.replace(match[0], match[3] + marker.textContent);
                                },
                                appendChild: () => {}
                            }
                        });
                    }
                    // Match certified word spans
                    const certRegex = /<span class="certified-word"[^>]*id="([^"]*)"[^>]*data-definition="([^"]*)"[^>]*>([^<]*)<\/span>/g;
                    while ((match = certRegex.exec(content)) !== null) {
                        spans.push({
                            className: 'certified-word',
                            id: match[1],
                            getAttribute: (attr) => attr === 'data-definition' ? match[2] : null,
                            textContent: match[3]
                        });
                    }
                },
                get innerHTML() {
                    return content;
                },
                dataset: {},
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    contains: jest.fn(() => false),
                    toggle: jest.fn()
                },
                appendChild: jest.fn(),
                removeChild: jest.fn(),
                addEventListener: jest.fn(),
                setAttribute: jest.fn(),
                getAttribute: jest.fn(),
                querySelectorAll: (sel) => {
                    if (sel === '.comment-highlight') return spans.filter(s => s.className === 'comment-highlight');
                    if (sel === '.certified-word') return spans.filter(s => s.className === 'certified-word');
                    return [];
                },
                querySelector: () => null,
                get textContent() {
                    return (content || '').replace(/<[^>]*>/g, '');
                },
                set textContent(val) {
                    content = val || '';
                },
                get innerText() {
                    return (content || '').replace(/<[^>]*>/g, '');
                },
                set innerText(val) {
                    content = val || '';
                }
            };
        },
        createTextNode: (text) => ({ textContent: text })
    };
});

describe('MyProjectUIManager Unit Tests', () => {
    describe('_escapeHtml', () => {
        test('should escape special HTML entities properly', () => {
            const raw = `<script>alert("hello" & 'world')</script>`;
            const escaped = UIManager._escapeHtml(raw);
            expect(escaped).toBe('&lt;script&gt;alert(&quot;hello&quot; &amp; &#039;world&#039;)&lt;/script&gt;');
        });

        test('should return empty string for null or empty input', () => {
            expect(UIManager._escapeHtml('')).toBe('');
            expect(UIManager._escapeHtml(null)).toBe('');
            expect(UIManager._escapeHtml(undefined)).toBe('');
        });
    });

    describe('_parseWiktionaryExtract', () => {
        test('should parse Wiktionary extract with Etymology and Definitions and attach Certify button', () => {
            const sampleWiki = `
== English ==
=== Etymology ===
From Middle English morada, from Old French.
=== Noun ===
* A fortress or sanctuary.
* A fractal chamber of thought.
            `.trim();

            const html = UIManager._parseWiktionaryExtract(sampleWiki, 'Morada');
            expect(html).toContain('<h4>Etymology</h4>');
            expect(html).toContain('From Middle English morada');
            expect(html).toContain('Definitions</h4>');
            expect(html).toContain('A fortress or sanctuary.');
            expect(html).toContain('id="certify-from-etymology-btn"');
            expect(html).toContain('Certify "Morada"');
        });

        test('should preserve error notice while retaining Certify button', () => {
            const errorHtml = '<p style="color: #856404;">Unable to reach Wiktionary (Network error).</p>';
            const result = UIManager._parseWiktionaryExtract(errorHtml, 'Sanctum');
            expect(result).toContain('Unable to reach Wiktionary');
            expect(result).toContain('id="certify-from-etymology-btn"');
            expect(result).toContain('Certify "Sanctum"');
        });
    });

    describe('filterTree', () => {
        const sampleTree = [
            {
                id: '1',
                title: 'The Great Gate',
                content: 'Standing before the obsidian archway.',
                tags: ['intro', 'prologue'],
                children: []
            },
            {
                id: '2',
                title: 'The Catacombs',
                content: 'Damp tunnels beneath the citadel.',
                tags: ['dungeon'],
                children: [
                    {
                        id: '2-1',
                        title: 'Vault of Antiquity',
                        content: 'Ancient scrolls and glowing relics.',
                        tags: ['archive'],
                        children: []
                    }
                ]
            }
        ];

        test('should filter tree by title text search', () => {
            const matches = UIManager.filterTree(sampleTree, 'gate', false);
            expect(matches).toHaveLength(1);
            expect(matches[0].id).toBe('1');
        });

        test('should filter tree by content text search', () => {
            const matches = UIManager.filterTree(sampleTree, 'citadel', false);
            expect(matches).toHaveLength(1);
            expect(matches[0].id).toBe('2');
        });

        test('should filter tree recursively matching child nodes', () => {
            const matches = UIManager.filterTree(sampleTree, 'scrolls', false);
            expect(matches).toHaveLength(1);
            expect(matches[0].id).toBe('2');
            expect(matches[0].children).toHaveLength(1);
            expect(matches[0].children[0].id).toBe('2-1');
        });

        test('should filter tree by tag search using # prefix', () => {
            const matches = UIManager.filterTree(sampleTree, 'dungeon', true);
            expect(matches).toHaveLength(1);
            expect(matches[0].id).toBe('2');

            const archiveMatches = UIManager.filterTree(sampleTree, 'archive', true);
            expect(archiveMatches).toHaveLength(1);
            expect(archiveMatches[0].children[0].id).toBe('2-1');
        });
    });

    describe('Modal visibility state checkers', () => {
        test('isCompendiumOpen should accurately report modal visibility', () => {
            UIManager.compendiumModal = { classList: { contains: (cls) => cls === 'hidden' } };
            expect(UIManager.isCompendiumOpen()).toBe(false);

            UIManager.compendiumModal = { classList: { contains: () => false } };
            expect(UIManager.isCompendiumOpen()).toBe(true);

            UIManager.compendiumModal = null;
            expect(UIManager.isCompendiumOpen()).toBeFalsy();
        });

        test('isSearchOpen should accurately report search palette visibility', () => {
            UIManager.searchPalette = { classList: { contains: (cls) => cls === 'hidden' } };
            expect(UIManager.isSearchOpen()).toBe(false);

            UIManager.searchPalette = { classList: { contains: () => false } };
            expect(UIManager.isSearchOpen()).toBe(true);

            UIManager.searchPalette = null;
            expect(UIManager.isSearchOpen()).toBeFalsy();
        });
    });

    describe('_processNodeContentForExport with footnotes and glossary', () => {
        test('should process node content with footnotes and glossary entries', () => {
            const mockNode = {
                id: 'node-test',
                title: 'Chapter I',
                type: 'text',
                content: '<p>The ancient <span class="certified-word" id="cw1" data-definition="A fortress">Morada</span> was grand. <span class="comment-highlight" id="c1" data-comment="Revise pacing here">He walked slowly</span> towards it.</p>',
                comments: [{ id: 'c1', text: 'Revise pacing here' }],
                certifiedWords: [{ id: 'cw1', word: 'Morada', definition: 'A fortress' }]
            };

            const masterGlossary = new Map();
            const output = UIManager._processNodeContentForExport(mockNode, true, true, masterGlossary);

            expect(output).toContain('[^1]');
            expect(output).toContain('--- Comments & Notes ---');
            expect(output).toContain('[^1] "He walked slowly": Revise pacing here');
            expect(output).toContain('--- Certified Lexicon ---');
            expect(output).toContain('• Morada: A fortress');
            expect(masterGlossary.get('Morada')).toBe('A fortress');
        });
    });

    describe('autoTidyDesk', () => {
        test('should arrange disorganized nodes into a clean grid', () => {
            const nodes = [
                { id: '1', x: 999, y: 888, width: 250, height: 150 },
                { id: '2', x: -500, y: 300, width: 250, height: 150 },
                { id: '3', x: 200, y: -400, width: 250, height: 150 },
                { id: '4', x: 12, y: 99, width: 250, height: 150 }
            ];

            UIManager.stateManager = {
                getCurrentNodes: () => nodes
            };
            UIManager.saveNodesFunction = () => {};
            UIManager.fitNodesToView = () => {};
            UIManager.drawFunction = () => {};

            UIManager.autoTidyDesk();

            // 4 nodes in a 2x2 grid
            expect(nodes[0].x).toBeLessThan(nodes[1].x);
            expect(nodes[0].y).toBe(nodes[1].y); // row 0
            expect(nodes[2].y).toBeGreaterThan(nodes[0].y); // row 1
            expect(nodes[2].x).toBe(nodes[0].x); // col 0
        });
    });

    describe('Manuscript Press Multi-Format Publishing Engine', () => {
        const sampleManuscript = [
            {
                id: 'm1',
                title: 'Prologue',
                type: 'text',
                content: '<p>The ancient sanctuary of <span class="certified-word" id="cw1" data-definition="A fortress">Morada</span> stood resolute.</p>',
                certifiedWords: [{ id: 'cw1', word: 'Morada', definition: 'A fortress' }],
                comments: [{ id: 'c1', text: 'Check pacing' }]
            },
            {
                id: 'm2',
                title: 'Book One',
                type: 'container',
                includeNotes: true,
                content: '<p>Introductory commentary for Book One.</p>'
            }
        ];

        beforeEach(() => {
            global.window.MyProjectDataStorage = {
                getManuscriptList: () => sampleManuscript
            };
        });

        test('should compile manuscript into Markdown with cover, TOC, and glossary', () => {
            const md = UIManager.compileManuscript('markdown', {
                title: 'The Morada Chronicles',
                includeCover: true,
                includeToc: true,
                includeComments: true,
                includeCertifiedWords: true
            });

            expect(md).toContain('# The Morada Chronicles');
            expect(md).toContain('## Table of Contents');
            expect(md).toContain('[Prologue](#prologue)');
            expect(md).toContain('[Book One](#book-one)');
            expect(md).toContain('## Prologue');
            expect(md).toContain('# BOOK ONE');
            expect(md).toContain('## Appendix: Certified Lexicon & Glossary');
            expect(md).toContain('* **Morada**: A fortress');
        });

        test('should compile manuscript into HTML with semantic document structure', () => {
            const html = UIManager.compileManuscript('html', {
                title: 'HTML Edition',
                includeCover: true,
                includeToc: true,
                includeComments: true,
                includeCertifiedWords: true
            });

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<title>HTML Edition</title>');
            expect(html).toContain('<header class="manuscript-cover">');
            expect(html).toContain('<nav class="manuscript-toc">');
            expect(html).toContain('<article class="sheet-article" id="node-m1">');
            expect(html).toContain('<section class="portfolio-section" id="node-m2">');
            expect(html).toContain('<section class="manuscript-glossary">');
            expect(html).toContain('<dt>Morada</dt>');
            expect(html).toContain('<dd>A fortress</dd>');
        });

        test('should compile manuscript into Plain Text with ASCII dividers', () => {
            const txt = UIManager.compileManuscript('txt', {
                title: 'Plain Text Edition',
                includeCover: true,
                includeToc: true,
                includeComments: false,
                includeCertifiedWords: true
            });

            expect(txt).toContain('MANUSCRIPT: PLAIN TEXT EDITION');
            expect(txt).toContain('TABLE OF CONTENTS');
            expect(txt).toContain('Prologue');
            expect(txt).toContain('2. Book One');
            expect(txt).toContain('### Prologue ###');
            expect(txt).toContain('MANUSCRIPT GLOSSARY & CERTIFIED LEXICON');
        });

        test('updateManuscriptStats should compute accurate totals', () => {
            const mockDoc = { textContent: '' };
            const mockWord = { textContent: '' };
            const mockTime = { textContent: '' };
            UIManager.compendiumDocCount = mockDoc;
            UIManager.compendiumWordCount = mockWord;
            UIManager.compendiumReadTime = mockTime;

            UIManager.updateManuscriptStats();

            expect(mockDoc.textContent).toBe('2 documents');
            expect(mockWord.textContent).toContain('words');
            expect(mockTime.textContent).toContain('min read');
        });
    });

    describe('Outliner Reordering and Canvas Tag Filter Actions', () => {
        test('moveNodeInCurrentView should reorder nodes and update state', () => {
            const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
            let saved = false;
            let redrawn = false;

            UIManager.stateManager = {
                getCurrentNodes: () => nodes,
                setCurrentNodes: (n) => {},
                getViewStack: () => [],
                setRootNodes: (n) => {}
            };
            UIManager.saveNodesFunction = () => { saved = true; };
            UIManager.drawFunction = () => { redrawn = true; };
            UIManager.outlinerList = { innerHTML: '', appendChild: () => {} };

            UIManager.moveNodeInCurrentView(0, 2);

            expect(nodes.map(n => n.id)).toEqual(['b', 'c', 'a']);
            expect(saved).toBe(true);
            expect(redrawn).toBe(true);
        });

        test('clearCanvasFilter should reset input and canvas renderer active filter', () => {
            let filterReset = false;
            global.window.MyProjectCanvasRenderer = {
                setActiveTagFilter: (f) => { if (f === null) filterReset = true; }
            };

            const mockInput = { value: '#tag' };
            const mockClearBtn = { classList: { add: jest.fn() } };
            UIManager.canvasTagFilter = mockInput;
            UIManager.clearCanvasFilterBtn = mockClearBtn;
            UIManager.drawFunction = jest.fn();

            UIManager.clearCanvasFilter();

            expect(mockInput.value).toBe('');
            expect(mockClearBtn.classList.add).toHaveBeenCalledWith('hidden');
            expect(filterReset).toBe(true);
            expect(UIManager.drawFunction).toHaveBeenCalled();
        });
    });
});
