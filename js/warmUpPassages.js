// warmUpPassages.js
if (typeof window === 'undefined') {
    global.window = global;
}

/**
 * Curated literary passages for 5-minute writing warm-ups and copywork exercises.
 * Focuses on G.K. Chesterton, Russian novelists (Tolstoy, Dostoevsky, Chekhov, Turgenev, Gogol),
 * Cormac McCarthy, and masters in that stylistic vein.
 */
window.MyProjectWarmUp = {
    passages: [
        {
            id: 'chesterton-thursday',
            author: 'G.K. Chesterton',
            work: 'The Man Who Was Thursday (1908)',
            category: 'G.K. Chesterton',
            tags: ['chesterton', 'warm-up', 'london', 'sunset'],
            text: 'The suburb of Saffron Park lay on the sunset side of London, as red and ragged as a cloud of sunset. It was built of a bright brick which seemed to have absorbed the glow of evening and refused to let it go; and its bizarre chimneys, its gables like pointed hats, its copper domes that had turned the green of verdigris, all stood up against the west like the skyline of a fantastic city in a fairy tale. The very trees seemed to have caught the infection of romanticism; they were not mere suburban lime-trees, but had twisted themselves into the gestures of gnomes.'
        },
        {
            id: 'chesterton-orthodoxy',
            author: 'G.K. Chesterton',
            work: 'Orthodoxy (1908)',
            category: 'G.K. Chesterton',
            tags: ['chesterton', 'warm-up', 'philosophy', 'vitality'],
            text: 'Because children have abounding vitality, because they are in spirit fierce and free, therefore they want things repeated and unchanged. They always say, "Do it again"; and the grown-up person does it again until he is nearly dead. For grown-up people are not strong enough to exult in monotony. But perhaps God is strong enough to exult in monotony. It is possible that God says every morning, "Do it again" to the sun; and every evening, "Do it again" to the moon.'
        },
        {
            id: 'chesterton-bluecross',
            author: 'G.K. Chesterton',
            work: 'The Innocence of Father Brown — The Blue Cross (1911)',
            category: 'G.K. Chesterton',
            tags: ['chesterton', 'warm-up', 'mystery', 'dawn'],
            text: 'Between the silver ribbon of the morning and the green glittering ribbon of the sea, the boat touched Harwich and let loose a swarm of folk like flies, among whom the man we must follow was by no means the most noticeable. There was nothing about him to suggest the secret police of Paris; yet he had in his pocket a warrant for the arrest of the most colossal genius in crime that Europe had ever produced, and his eyes under their drooping lids were as sharp as needles.'
        },
        {
            id: 'chesterton-nottinghill',
            author: 'G.K. Chesterton',
            work: 'The Napoleon of Notting Hill (1904)',
            category: 'G.K. Chesterton',
            tags: ['chesterton', 'warm-up', 'london', 'city'],
            text: 'The human race, to which so many of my readers belong, had been playing at children\'s games from the beginning, and will probably do so to the end. The game is called "Cheat the Prophet." The players listen very politely to all that the clever men have to say about what is going to happen in the next generation, and then they wait until all the clever men are dead, and do something quite different.'
        },
        {
            id: 'tolstoy-austerlitz',
            author: 'Leo Tolstoy',
            work: 'War and Peace (1869)',
            category: 'Russian Novels',
            tags: ['russian', 'tolstoy', 'warm-up', 'sky'],
            text: 'Above him there was now nothing but the sky—the lofty sky, not clear yet still immeasurably lofty, with grey clouds quietly gliding across it. "How quiet, peaceful, and solemn; not at all as I ran," thought Prince Andrei. "Not as we ran, shouting and fighting. How differently do these clouds glide across that lofty, boundless sky! How was it I did not see that lofty sky before? And how happy I am to have found it at last. Yes! All is vanity, all is delusion, except that infinite sky."'
        },
        {
            id: 'tolstoy-levin-mowing',
            author: 'Leo Tolstoy',
            work: 'Anna Karenina (1877)',
            category: 'Russian Novels',
            tags: ['russian', 'tolstoy', 'warm-up', 'earth', 'work'],
            text: 'The grass was wet with dew, and Levin walked behind the old man, his scythe cutting into the thick, sweet-scented swaths with a crisp, rhythmic hiss. The longer Levin mowed, the more often he felt those moments of oblivion, during which his arms no longer swung the scythe, but the scythe itself seemed to mow down the juicy grass, full of life and scent, while his body moved unconsciously, free of thought and full of simple, joyous strength.'
        },
        {
            id: 'dostoevsky-karamazov',
            author: 'Fyodor Dostoevsky',
            work: 'The Brothers Karamazov (1880)',
            category: 'Russian Novels',
            tags: ['russian', 'dostoevsky', 'warm-up', 'stars', 'night'],
            text: 'The silence of earth seemed to merge into the silence of the heavens. The mystery of earth was one with the mystery of the stars. Alyosha stood, gazed, and suddenly threw himself down on the earth. He did not know why he embraced it. He could not have told why he longed so irresistibly to kiss it, to kiss the whole of it; but he kissed it weeping, sobbing and watering it with his tears, and vowed passionately to love it, to love it for ever and ever.'
        },
        {
            id: 'dostoevsky-crime',
            author: 'Fyodor Dostoevsky',
            work: 'Crime and Punishment (1866)',
            category: 'Russian Novels',
            tags: ['russian', 'dostoevsky', 'warm-up', 'river', 'expanse'],
            text: 'From the high bank a broad landscape opened before him. Far off in the distance, on the other side of the river, the endless steppe stretched away, bathed in sunshine. From the vast space barely audible sounds drifted across. There, in that immense sunlit expanse, smoke curled from nomad tents like tiny specks; there was freedom, there lived other people, completely unlike those here; there time itself seemed to have stopped, as if the centuries of Abraham and his flocks were not yet past.'
        },
        {
            id: 'chekhov-steppe',
            author: 'Anton Chekhov',
            work: 'The Steppe (1888)',
            category: 'Russian Novels',
            tags: ['russian', 'chekhov', 'warm-up', 'steppe', 'sun'],
            text: 'The sun had already appeared behind the town and quietly, without haste, set about its work. First, far away ahead, where the sky met the earth, near the tumuli and the windmill, a broad bright-yellow strip spread over the ground; a minute later a similar strip gleamed a little nearer, crept to the right and embraced the hills. Something warm touched the traveler\'s back; a stream of light, darting from behind, caught the horses\' tails and the dry clay wheels, and the dust rose in gold.'
        },
        {
            id: 'turgenev-fathers',
            author: 'Ivan Turgenev',
            work: 'Fathers and Sons (1862)',
            category: 'Russian Novels',
            tags: ['russian', 'turgenev', 'warm-up', 'evening', 'nature'],
            text: 'A quiet evening set in; the sun disappeared behind a small copse of aspens that lay a quarter of a verst from the garden; its shadow stretched in an endless sheet across the motionless fields. A peasant on a white horse was trotting along the dark, narrow path by the copse; he could be seen clearly, every motion of his shoulders was distinct, although he was in the shadow; the horse\'s hooves clicked with pleasant clarity in the cooling air.'
        },
        {
            id: 'gogol-troika',
            author: 'Nikolai Gogol',
            work: 'Dead Souls (1842)',
            category: 'Russian Novels',
            tags: ['russian', 'gogol', 'warm-up', 'troika', 'motion'],
            text: 'And do you not, Russia, like a spirited troika that cannot be outdistanced, speed furiously along? The smoke curls under you, the bridges thunder, all falls back and is left behind. The spectator stands struck with fear at the divine wonder: is this not a lightning bolt cast down from heaven? What does this terror-inspiring speed mean? What mysterious power is hidden in these horses the world has never known?'
        },
        {
            id: 'mccarthy-bloodmeridian',
            author: 'Cormac McCarthy',
            work: 'Blood Meridian (1985)',
            category: 'Cormac McCarthy',
            tags: ['mccarthy', 'warm-up', 'desert', 'bloodmeridian'],
            text: 'They rode on and the sun in the east flushed pale through the long bands of wire clouds and the desert began to take color, the gray sand yellowing and the red rocks turning the color of dried blood. The riders sat their horses like figures cut from tin, their long shadows trailing west across the desert floor until the world shrank to the circle of their vision and the sun rose orange and blinding above the rims of the earth.'
        },
        {
            id: 'mccarthy-theroad',
            author: 'Cormac McCarthy',
            work: 'The Road (2006)',
            category: 'Cormac McCarthy',
            tags: ['mccarthy', 'warm-up', 'theroad', 'ash'],
            text: 'When he woke in the woods in the dark and the cold of the night he\'d reach out to touch the child sleeping beside him. Nights dark beyond darkness and the days more gray each one than what had gone before. Like the onset of some cold glaucoma dimming away the world. His hand rose and fell on each precious breath. He pushed the plastic tarp off him and stood in the stinking robes and looked toward the east for any light of dawn.'
        },
        {
            id: 'mccarthy-prettyhorses',
            author: 'Cormac McCarthy',
            work: 'All the Pretty Horses (1992)',
            category: 'Cormac McCarthy',
            tags: ['mccarthy', 'warm-up', 'horses', 'border'],
            text: 'The red run of horses took breath and wheeled and looked back at him and he sat his horse in the dusk and watched them go. The world was quiet and the ancient wind came off the plain smelling of creosote and distance. He thought that the world was very old and that men had been upon it for only a little while, and that what they had done upon it was of small consequence beside the enduring silence of the stones.'
        },
        {
            id: 'mccarthy-suttree',
            author: 'Cormac McCarthy',
            work: 'Suttree (1979)',
            category: 'Cormac McCarthy',
            tags: ['mccarthy', 'warm-up', 'river', 'suttree'],
            text: 'A seasoned winter with frost on the mud and dark waters moving under the bridge. Suttree stepped from the skiff into the cold marsh grass, his breath rising in white plumes against the river mist. The river ran brown and heavy with winter runoff, carrying the debris of the upper counties, drowned logs and sodden timber spinning in the slow eddies like heavy sleepers turning in their beds.'
        },
        {
            id: 'oconnor-goodman',
            author: 'Flannery O\'Connor',
            work: 'A Good Man Is Hard to Find (1953)',
            category: 'Masters of the Craft',
            tags: ['oconnor', 'warm-up', 'southern', 'craft'],
            text: 'The trees were full of silver-white sunlight and the meanest of them sparkled. The car turned off the highway onto a dirt road that curled through red clay banks and dense stands of pine. Behind them the dust rose like red flour and settled on the blackberry bushes that grew wild along the ditches, and the sky overhead was the pale, clear blue of porcelain that had been washed too many times.'
        },
        {
            id: 'melville-mobydick',
            author: 'Herman Melville',
            work: 'Moby-Dick (1851)',
            category: 'Masters of the Craft',
            tags: ['melville', 'warm-up', 'sea', 'opening'],
            text: 'Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people\'s hats off—then, I account it high time to get to sea as soon as I can.'
        },
        {
            id: 'conrad-heart',
            author: 'Joseph Conrad',
            work: 'Heart of Darkness (1899)',
            category: 'Masters of the Craft',
            tags: ['conrad', 'warm-up', 'thames', 'dusk'],
            text: 'The sea-reach of the Thames stretched before us like the beginning of an interminable waterway. In the offing the sea and the sky were welded together without a joint, and in the luminous space the tanned sails of the barges drifting up with the tide seemed to stand still in red clusters of canvas sharply peaked with gleams of varnished spirits. A haze rested on the low shores that ran out to sea in vanishing flatness.'
        }
    ],

    /**
     * Get all warm-up passages.
     */
    getAllPassages: function() {
        return this.passages;
    },

    /**
     * Get a random warm-up passage.
     * @param {string} [excludeId]
     */
    getRandomPassage: function(excludeId) {
        const pool = excludeId ? this.passages.filter(p => p.id !== excludeId) : this.passages;
        const index = Math.floor(Math.random() * pool.length);
        return pool[index] || this.passages[0];
    },

    /**
     * Find a passage by ID.
     */
    getPassageById: function(id) {
        return this.passages.find(p => p.id === id) || null;
    },

    /**
     * Creates or locates the dedicated "Warm Up" Portfolio on the desk,
     * pre-populating it with curated warm-up sheets if newly created.
     * @param {Array<Object>} rootNodes
     * @param {Object} nodeManager
     * @returns {Object} The Warm Up portfolio node
     */
    ensureWarmUpPortfolio: function(rootNodes, nodeManager) {
        if (!Array.isArray(rootNodes) || !nodeManager) return null;

        // Check if "Warm Up" portfolio already exists (case-insensitive)
        let portfolio = rootNodes.find(n => !n.archived && n.type === 'container' && /^(warm\s*up|warm-up)$/i.test((n.title || '').trim()));

        if (portfolio) {
            return portfolio;
        }

        // Create new Warm Up Portfolio
        const id = 'portfolio-warmup-' + Date.now();
        // Position prominently in the upper right quadrant of the desk
        const x = 50;
        const y = -180;
        portfolio = nodeManager.createNode(x, y, false, id);
        portfolio.title = 'Warm Up';
        portfolio.tags = ['warm-up', 'craft', 'morning-routine'];
        portfolio.children = [];

        // Prepopulate with a diverse starter pack of 6 curated warm-up sheets
        const starterPassageIds = [
            'chesterton-thursday',
            'tolstoy-austerlitz',
            'mccarthy-bloodmeridian',
            'dostoevsky-karamazov',
            'chekhov-steppe',
            'mccarthy-theroad'
        ];

        starterPassageIds.forEach((pid, idx) => {
            const passage = this.getPassageById(pid);
            if (passage) {
                const sheetId = 'sheet-warmup-' + (Date.now() + idx);
                // Stagger sheet cards inside portfolio
                const sheetX = 40 + (idx % 2) * 380;
                const sheetY = 40 + Math.floor(idx / 2) * 240;
                const sheet = nodeManager.createNode(sheetX, sheetY, true, sheetId);
                sheet.title = `${passage.author} — ${passage.work.split('(')[0].trim()}`;
                sheet.tags = passage.tags.slice();
                sheet.timer = { duration: 300, remaining: 300, running: false };
                sheet.wordGoal = 250;
                sheet.content = this.generateSheetContent(passage);
                portfolio.children.push(sheet);
            }
        });

        rootNodes.push(portfolio);
        return portfolio;
    },

    /**
     * Formats the sheet HTML content for a warm-up passage.
     * @param {Object} passage
     * @returns {string}
     */
    generateSheetContent: function(passage) {
        return `<h3>${passage.author} — ${passage.work}</h3>` +
            `<p class="warmup-instruction"><em>5-Minute Copywork &amp; Sensory Warm-Up: Read the passage below to absorb its cadence and concrete detail. Copy it into this sheet, or use its final cadence as a springboard for your own scene.</em></p>` +
            `<blockquote style="border-left: 3px solid #b57614; padding-left: 16px; margin: 18px 0; font-style: italic; color: #3c3836;">` +
            `"${passage.text}"` +
            `</blockquote>` +
            `<p><br></p>` +
            `<p><strong>My Writing:</strong></p>` +
            `<p></p>`;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MyProjectWarmUp;
}
