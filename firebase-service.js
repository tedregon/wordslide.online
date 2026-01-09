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
                console.log(`Fetched ${words.length} words from Firebase for ${today}:`, words);
                return words;
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

        try {
            const docRef = this.db.collection('daily_words').doc(date);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                const words = data.words || [];
                console.log(`Fetched ${words.length} words from Firebase for ${date}:`, words);
                return words;
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

