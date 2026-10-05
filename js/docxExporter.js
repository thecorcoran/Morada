// js/docxExporter.js
// Generates authentic, standard Microsoft Word (.docx) Office Open XML binary documents.

if (typeof window === 'undefined') {
    global.window = global;
}

let docxLib = null;
if (typeof require !== 'undefined') {
    try {
        docxLib = require('docx');
    } catch {
        // Handled gracefully if not in Node/Electron environment
    }
}
if (!docxLib && typeof window !== 'undefined' && window.docx) {
    docxLib = window.docx;
}

function stripHtml(html) {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/div>/gi, '\n')
        .replace(/<div[^>]*>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

window.DocxExporter = {
    isAvailable: function() {
        return !!docxLib;
    },

    setDocxLib: function(lib) {
        docxLib = lib;
    },

    createDocument: function(nodes, options = {}) {
        if (!docxLib) {
            throw new Error('docx library is not available in the current environment.');
        }

        const {
            Document,
            Paragraph,
            TextRun,
            HeadingLevel,
            Table,
            TableRow,
            TableCell,
            WidthType,
            AlignmentType,
            PageBreak
        } = docxLib;

        const title = options.title || 'Manuscript';
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const totalWords = options.totalWordCount || 0;
        const masterGlossary = options.masterGlossary || new Map();

        const children = [];

        // 1. Cover Page
        if (options.includeCover) {
            children.push(
                new Paragraph({
                    spacing: { before: 2400, after: 400 },
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: title,
                            font: 'Georgia',
                            size: 48,
                            bold: true,
                            color: '2C2218'
                        })
                    ]
                }),
                new Paragraph({
                    spacing: { after: 4800 },
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: `Compiled on ${dateStr} · ${totalWords.toLocaleString()} Words`,
                            font: 'Georgia',
                            size: 24,
                            italics: true,
                            color: '7A6B5D'
                        })
                    ]
                }),
                new Paragraph({
                    children: [new PageBreak()]
                })
            );
        }

        // 2. Table of Contents
        if (options.includeToc && nodes.length > 0) {
            children.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 400 },
                    children: [
                        new TextRun({
                            text: 'Table of Contents',
                            font: 'Georgia',
                            size: 32,
                            bold: true,
                            color: '2C2218'
                        })
                    ]
                })
            );

            nodes.forEach((node, index) => {
                const nodeTitle = node.title || 'Untitled';
                const isContainer = node.type === 'container';
                children.push(
                    new Paragraph({
                        spacing: { before: 100, after: 100 },
                        children: [
                            new TextRun({
                                text: isContainer ? `${index + 1}. ${nodeTitle}` : `    — ${nodeTitle}`,
                                font: 'Georgia',
                                size: isContainer ? 24 : 22,
                                bold: isContainer,
                                color: isContainer ? '2C2218' : '4A3E36'
                            })
                        ]
                    })
                );
            });

            children.push(
                new Paragraph({
                    children: [new PageBreak()]
                })
            );
        }

        // 3. Document Sections (Portfolios & Sheets)
        nodes.forEach((node) => {
            const nodeTitle = node.title || 'Untitled';
            const isContainer = node.type === 'container';

            if (isContainer) {
                children.push(
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 800, after: 400 },
                        children: [
                            new TextRun({
                                text: nodeTitle.toUpperCase(),
                                font: 'Georgia',
                                size: 32,
                                bold: true,
                                color: '8B5A2B'
                            })
                        ]
                    })
                );
            } else {
                children.push(
                    new Paragraph({
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 600, after: 300 },
                        children: [
                            new TextRun({
                                text: nodeTitle,
                                font: 'Georgia',
                                size: 28,
                                bold: true,
                                color: '2C2218'
                            })
                        ]
                    })
                );
            }

            // Paragraphs
            const rawContent = node.content || '';
            const plainText = stripHtml(rawContent);
            if (plainText) {
                const paragraphs = plainText.split(/\n\s*\n/);
                paragraphs.forEach(para => {
                    const trimmed = para.trim();
                    if (trimmed) {
                        children.push(
                            new Paragraph({
                                spacing: { before: 120, after: 200, line: 280 },
                                children: [
                                    new TextRun({
                                        text: trimmed,
                                        font: 'Georgia',
                                        size: 24, // 12pt
                                        color: '1A1715'
                                    })
                                ]
                            })
                        );
                    }
                });
            }

            // Notes / Comments
            if (options.includeComments && Array.isArray(node.comments) && node.comments.length > 0) {
                children.push(
                    new Paragraph({
                        spacing: { before: 300, after: 150 },
                        children: [
                            new TextRun({
                                text: 'Notes & Annotations:',
                                font: 'Georgia',
                                size: 20,
                                bold: true,
                                italics: true,
                                color: '7A6B5D'
                            })
                        ]
                    })
                );

                node.comments.forEach((c, idx) => {
                    const commentText = c.text || '';
                    if (commentText.trim()) {
                        children.push(
                            new Paragraph({
                                spacing: { before: 60, after: 60 },
                                children: [
                                    new TextRun({
                                        text: `[${idx + 1}] ${commentText.trim()}`,
                                        font: 'Georgia',
                                        size: 20,
                                        italics: true,
                                        color: '6A5C50'
                                    })
                                ]
                            })
                        );
                    }
                });
            }

            // Certified words collection for appendix
            if (options.includeCertifiedWords && Array.isArray(node.certifiedWords)) {
                node.certifiedWords.forEach(cw => {
                    const word = cw.word || cw.text;
                    if (word && cw.definition) {
                        masterGlossary.set(word, cw.definition);
                    }
                });
            }
        });

        // 4. Certified Lexicon Appendix Table
        if (options.includeCertifiedWords && masterGlossary.size > 0) {
            children.push(
                new Paragraph({
                    children: [new PageBreak()]
                }),
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 600, after: 400 },
                    children: [
                        new TextRun({
                            text: 'Appendix: Certified Lexicon & Glossary',
                            font: 'Georgia',
                            size: 30,
                            bold: true,
                            color: '2C2218'
                        })
                    ]
                })
            );

            const sortedWords = Array.from(masterGlossary.keys()).sort((a, b) => a.localeCompare(b));
            const tableRows = [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 3000, type: WidthType.DXA },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: 'Certified Word', bold: true, font: 'Georgia', size: 22 })]
                                })
                            ]
                        }),
                        new TableCell({
                            width: { size: 6000, type: WidthType.DXA },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: 'Living Definition', bold: true, font: 'Georgia', size: 22 })]
                                })
                            ]
                        })
                    ]
                })
            ];

            sortedWords.forEach(word => {
                const def = masterGlossary.get(word);
                tableRows.push(
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: 3000, type: WidthType.DXA },
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: word, bold: true, font: 'Georgia', size: 22, color: '8B5A2B' })]
                                    })
                                ]
                            }),
                            new TableCell({
                                width: { size: 6000, type: WidthType.DXA },
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: def, font: 'Georgia', size: 22, color: '2C2218' })]
                                    })
                                ]
                            })
                        ]
                    })
                );
            });

            children.push(
                new Table({
                    rows: tableRows,
                    width: { size: 9000, type: WidthType.DXA }
                })
            );
        }

        return new Document({
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1 inch = 1440 twips
                            bottom: 1440,
                            left: 1440,
                            right: 1440
                        }
                    }
                },
                children: children
            }]
        });
    },

    generateBuffer: async function(nodes, options = {}) {
        const doc = this.createDocument(nodes, options);
        return await docxLib.Packer.toBuffer(doc);
    },

    generateBase64: async function(nodes, options = {}) {
        const doc = this.createDocument(nodes, options);
        return await docxLib.Packer.toBase64String(doc);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.DocxExporter;
}
