const StrunkEngine = require('../js/strunkEngine.js');

describe('MyProjectStrunkEngine Unit Tests', () => {
    describe('countSyllables', () => {
        test('should count syllables accurately for common words', () => {
            expect(StrunkEngine.countSyllables('desk')).toBe(1);
            expect(StrunkEngine.countSyllables('scholar')).toBe(2);
            expect(StrunkEngine.countSyllables('manuscript')).toBe(3);
            expect(StrunkEngine.countSyllables('extraordinary')).toBeGreaterThanOrEqual(5);
        });

        test('should handle empty or null strings gracefully', () => {
            expect(StrunkEngine.countSyllables('')).toBe(0);
            expect(StrunkEngine.countSyllables(null)).toBe(0);
        });
    });

    describe('findPassiveVoice', () => {
        test('should detect regular passive voice constructions', () => {
            const text = 'The fortress was attacked at dawn. The gates were opened by traitors.';
            const passives = StrunkEngine.findPassiveVoice(text);
            expect(passives).toHaveLength(2);
            expect(passives[0].phrase).toBe('was attacked');
            expect(passives[1].phrase).toBe('were opened');
        });

        test('should detect irregular passive voice and adverb-split passives', () => {
            const text = 'The letter was secretly written by the monk. The kingdom was lost.';
            const passives = StrunkEngine.findPassiveVoice(text);
            expect(passives.length).toBeGreaterThanOrEqual(2);
            expect(passives.some(p => p.verb === 'written')).toBe(true);
            expect(passives.some(p => p.verb === 'lost')).toBe(true);
        });

        test('should not flag active voice constructions', () => {
            const text = 'The king attacked the fortress and opened the gates.';
            const passives = StrunkEngine.findPassiveVoice(text);
            expect(passives).toHaveLength(0);
        });
    });

    describe('findAdverbs', () => {
        test('should detect -ly adverbs', () => {
            const text = 'He walked slowly and whispered quietly to the scholar.';
            const adverbs = StrunkEngine.findAdverbs(text);
            expect(adverbs).toHaveLength(2);
            expect(adverbs[0].word).toBe('slowly');
            expect(adverbs[1].word).toBe('quietly');
        });

        test('should exclude false-positive -ly words like only, early, friendly', () => {
            const text = 'The only friendly visitor arrived early in the morning.';
            const adverbs = StrunkEngine.findAdverbs(text);
            expect(adverbs).toHaveLength(0);
        });
    });

    describe('calculateReadability', () => {
        test('should calculate Flesch-Kincaid grade level and reading ease', () => {
            const sample = 'Thomas Jefferson designed a revolving bookstand for his library at Monticello. It allowed him to keep five reference volumes open at once.';
            const metrics = StrunkEngine.calculateReadability(sample);

            expect(metrics.words).toBe(22);
            expect(metrics.sentences).toBe(2);
            expect(metrics.syllables).toBeGreaterThan(20);
            expect(metrics.grade).toBeGreaterThan(5);
            expect(metrics.ease).toBeGreaterThan(30);
            expect(typeof metrics.label).toBe('string');
        });

        test('should handle empty text gracefully', () => {
            const metrics = StrunkEngine.calculateReadability('');
            expect(metrics.words).toBe(0);
            expect(metrics.grade).toBe(0);
            expect(metrics.ease).toBe(100);
        });
    });

    describe('applyHighlights and cleanStrunkMarkers', () => {
        test('should wrap passive voice and adverbs non-destructively and restore clean HTML', () => {
            const originalHtml = '<p>The gate was opened quickly by the guard.</p>';

            const highlighted = StrunkEngine.applyHighlights(originalHtml, {
                passive: true,
                adverbs: true
            });

            expect(highlighted).toContain('class="strunk-passive"');
            expect(highlighted).toContain('class="strunk-adverb"');

            const cleaned = StrunkEngine.cleanStrunkMarkers(highlighted);
            expect(cleaned).toBe(originalHtml);
        });
    });
});
