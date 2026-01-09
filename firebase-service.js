/**
 * Firebase service for fetching daily word lists
 */

class FirebaseService {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    /**
     * Initialize Firebase
     */
    async init() {
        if (this.initialized) {
            return;
        }

        try {
            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);
            
            // Initialize Firestore
            this.db = firebase.firestore();
            this.initialized = true;
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw error;
        }
    }

    /**
     * Get today's date in YYYY-MM-DD format
     */
    getTodayDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Validate and sanitize words array from Firebase
     * @param {any} words - Words data from Firebase
     * @returns {string[]|null} Validated array of words or null if invalid
     */
    validateWords(words) {
        // Check if words is an array
        if (!Array.isArray(words)) {
            console.warn('Words data is not an array:', typeof words);
            return null;
        }

        // Filter and validate each word
        const validatedWords = words
            .filter(word => {
                // Must be a string
                if (typeof word !== 'string') {
                    return false;
                }
                
                // Must contain only letters (A-Z, a-z)
                if (!/^[A-Za-z]+$/.test(word)) {
                    return false;
                }
                
                // Must be between 3 and 15 characters (reasonable word length)
                if (word.length < 3 || word.length > 15) {
                    return false;
                }
                
                return true;
            })
            .map(word => word.toUpperCase()) // Normalize to uppercase
            .filter((word, index, self) => self.indexOf(word) === index); // Remove duplicates

        // Ensure we have at least some valid words
        if (validatedWords.length === 0) {
            console.warn('No valid words found after validation');
            return null;
        }

        // Limit to reasonable number of words (prevent DoS)
        if (validatedWords.length > 20) {
            console.warn(`Too many words (${validatedWords.length}), limiting to 20`);
            return validatedWords.slice(0, 20);
        }

        return validatedWords;
    }

    /**
     * Fetch words for today's date
     * @returns {Promise<string[]>} Array of words for today
     */
    async getTodaysWords() {
        if (!this.initialized) {
            await this.init();
        }

        const today = this.getTodayDate();
        
        try {
            const docRef = this.db.collection('daily_words').doc(today);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                const words = data.words || [];
                
                // Validate and sanitize words before returning
                const validatedWords = this.validateWords(words);
                if (validatedWords) {
                    // console.log(`Fetched ${validatedWords.length} validated words from Firebase for ${today}:`, validatedWords);
                    return validatedWords;
                } else {
                    console.warn(`Invalid words data in Firebase for date: ${today}`);
                    return null;
                }
            } else {
                console.warn(`No words found in Firebase for date: ${today}`);
                return null;
            }
        } catch (error) {
            console.error('Error fetching words from Firebase:', error);
            return null;
        }
    }

    /**
     * Fetch words for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<string[]>} Array of words for the specified date
     */
    async getWordsForDate(date) {
        if (!this.initialized) {
            await this.init();
        }

        // Validate date format
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            console.warn(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
            return null;
        }

        try {
            const docRef = this.db.collection('daily_words').doc(date);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                const words = data.words || [];
                
                // Validate and sanitize words before returning
                const validatedWords = this.validateWords(words);
                if (validatedWords) {
                    console.log(`Fetched ${validatedWords.length} validated words from Firebase for ${date}:`, validatedWords);
                    return validatedWords;
                } else {
                    console.warn(`Invalid words data in Firebase for date: ${date}`);
                    return null;
                }
            } else {
                console.warn(`No words found in Firebase for date: ${date}`);
                return null;
            }
        } catch (error) {
            console.error('Error fetching words from Firebase:', error);
            return null;
        }
    }
}

// Create a singleton instance
const firebaseService = new FirebaseService();

