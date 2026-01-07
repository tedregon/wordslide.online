/**
 * Dictionary loader and word validation
 * Loads words from dictionary.txt and organizes them by length
 */
class Dictionary {
    constructor() {
        this.wordsByLength = new Map();
        this.loaded = false;
    }

    /**
     * Load dictionary from dictionary.txt file
     */
    async load() {
        if (this.loaded) {
            return Promise.resolve();
        }

        try {
            const response = await fetch('dictionary.txt');
            if (!response.ok) {
                throw new Error(`Failed to load dictionary: ${response.status}`);
            }

            const text = await response.text();
            const words = text
                .split('\n')
                .map(word => word.trim().toUpperCase())
                .filter(word => word.length > 0);

            // Organize words by length
            for (const word of words) {
                const length = word.length;
                if (!this.wordsByLength.has(length)) {
                    this.wordsByLength.set(length, new Set());
                }
                this.wordsByLength.get(length).add(word);
            }

            this.loaded = true;
            console.log(`Dictionary loaded: ${words.length} words`);
            return Promise.resolve();
        } catch (error) {
            console.error('Error loading dictionary:', error);
            // Fallback to basic words
            this._loadFallbackWords();
            return Promise.resolve();
        }
    }

    /**
     * Fallback words if dictionary fails to load
     */
    _loadFallbackWords() {
        const fallbackWords = [
            'ANT', 'BAT', 'BEE', 'CAN', 'CAT', 'COG', 'COW', 'DOG', 'FLY', 'FOX',
            'BEAR', 'FROG', 'LION', 'WOLF',
            'EAGLE', 'MOUSE', 'SNAKE', 'TIGER',
            'BASKET', 'FRIEND', 'LAPTOP', 'MEMBER',
            'ELEPHANT', 'GIRAFFE', 'PENGUIN', 'DOLPHIN'
        ];

        for (const word of fallbackWords) {
            const length = word.length;
            if (!this.wordsByLength.has(length)) {
                this.wordsByLength.set(length, new Set());
            }
            this.wordsByLength.get(length).add(word);
        }

        this.loaded = true;
        console.log('Using fallback words');
    }

    /**
     * Get all words of a specific length
     */
    wordsOfLength(length) {
        const words = this.wordsByLength.get(length);
        return words ? Array.from(words) : [];
    }

    /**
     * Check if a word is valid
     */
    isValidWord(word) {
        if (!word || word.length === 0) return false;
        const uppercaseWord = word.toUpperCase();
        const words = this.wordsByLength.get(uppercaseWord.length);
        return words ? words.has(uppercaseWord) : false;
    }

    /**
     * Get a random word of specific length
     */
    randomWord(length) {
        const words = this.wordsOfLength(length);
        if (words.length === 0) return null;
        return words[Math.floor(Math.random() * words.length)];
    }

    /**
     * Get word count statistics
     */
    getWordCounts() {
        const counts = {};
        for (const [length, words] of this.wordsByLength) {
            counts[length] = words.size;
        }
        return counts;
    }
}

// Create global dictionary instance
const dictionary = new Dictionary();

