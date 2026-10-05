const DocxExporter = require('../js/docxExporter.js');

describe('DocxExporter Module', () => {
    test('should report as available in Node environment', () => {
        expect(DocxExporter.isAvailable()).toBe(true);
    });

    test('should generate a valid binary docx buffer with cover, TOC, content, and glossary', async () => {
        const mockNodes = [
            {
                id: 1,
                title: 'Act I: The Scholar Desk',
                type: 'container',
                content: '<p>Chamber introduction and scenic arc.</p>',
                includeNotes: true
            },
            {
                id: 2,
                title: 'Scene 1: Midnight Scriptorium',
                type: 'text',
                content: '<p>The ink was warm upon the vellum sheet.</p><p>He sharpened the reed pen.</p>',
                comments: [{ text: 'Exquisite opening rhythm' }],
                certifiedWords: [
                    { word: 'vellum', definition: 'Fine parchment prepared from the skin of a calf or goat.' }
                ]
            }
        ];

        const options = {
            title: 'Test Compendium',
            includeCover: true,
            includeToc: true,
            includeComments: true,
            includeCertifiedWords: true,
            totalWordCount: 120,
            masterGlossary: new Map()
        };

        const buffer = await DocxExporter.generateBuffer(mockNodes, options);
        expect(buffer).toBeDefined();
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(1000);

        // A standard docx is a zip file starting with PK\x03\x04
        expect(buffer[0]).toBe(0x50);
        expect(buffer[1]).toBe(0x4b);

        const base64 = await DocxExporter.generateBase64(mockNodes, options);
        expect(typeof base64).toBe('string');
        expect(base64.length).toBeGreaterThan(1000);
    });
});
