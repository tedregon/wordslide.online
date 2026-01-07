/**
 * WordSlide Game - Main game logic
 * Implements WordJam mechanics for web
 */

class WordSlideGame {
    constructor() {
        // Game state
        this.lives = 3;
        this.coins = 0;
        this.currentLevelNumber = 1;
        this.currentWordLength = 3;
        this.wordsNeededForProgression = 3;
        this.foundWords = new Set();
        this.totalWordsFoundInSession = 0;
        this.highscore = this.loadHighscore();
        
        // Grid state
        this.letters = []; // [[String]] - rows of letters
        this.selectedColumnIndices = []; // [Int] - selected column for each row
        this.currentLevelWords = [];
        
        // UI state
        this.isDragging = [];
        this.dragStartX = [];
        this.dragOffset = [];
        this.baseOffset = [];
        
        // Constants
        this.BUTTON_WIDTH = 42;
        this.BUTTON_SPACING = 4;
        this.ADD_WORD_COST = 30;
        this.ADD_LIFE_COST = 60;
        this.COINS_PER_WORD = 10;
        
        // Result message
        this.result = '';
        this.resultImage = null;
        
        // Game over state
        this.showGameOver = false;
        
        this.init();
    }

    async init() {
        // Load dictionary first
        await dictionary.load();
        
        // Generate initial level
        this.generateNewLevel();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render initial grid
        this.renderGrid();
        this.updateUI();
    }

    setupEventListeners() {
        document.getElementById('confirm-btn').addEventListener('click', () => this.confirmWord());
        document.getElementById('progress-btn').addEventListener('click', () => this.progressToNextLevel());
        document.getElementById('reset-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            // For now, just restart
            this.restartGame();
        });
    }

    /**
     * Generate letters grid from valid words
     * Same logic as WordJam's generateLettersGrid
     */
    generateLettersGrid(validWords) {
        const maxLength = Math.max(...validWords.map(w => w.length));
        const columns = validWords.length;
        const grid = Array(maxLength).fill(null).map(() => Array(columns).fill(' '));

        // Distribute letters into grid
        for (let wordIndex = 0; wordIndex < validWords.length; wordIndex++) {
            const word = validWords[wordIndex];
            for (let letterIndex = 0; letterIndex < word.length; letterIndex++) {
                grid[letterIndex][wordIndex] = word[letterIndex].toUpperCase();
            }
        }

        // Shuffle each row
        for (let row = 0; row < maxLength; row++) {
            grid[row] = this.shuffleArray([...grid[row]]);
        }

        return grid;
    }

    /**
     * Generate random words for a level
     */
    generateRandomWordsForLevel(levelNumber, wordLength) {
        const availableWords = dictionary.wordsOfLength(wordLength);
        const wordsToSelect = Math.min(10, availableWords.length);

        if (wordsToSelect === 0) {
            console.warn(`No words of length ${wordLength}, using fallback`);
            return ['CAT', 'DOG', 'BAT', 'HAT', 'MAT'];
        }

        const shuffled = this.shuffleArray([...availableWords]);
        const selected = shuffled.slice(0, wordsToSelect);
        console.log(`Level ${levelNumber}: Generated ${selected.length} words of length ${wordLength}: ${selected.join(', ')}`);
        return selected;
    }

    /**
     * Generate a new level
     */
    generateNewLevel() {
        // TEMPORARY: Single row with 9 random letters for development
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const randomLetters = [];
        for (let i = 0; i < 9; i++) {
            randomLetters.push(letters[Math.floor(Math.random() * letters.length)]);
        }
        
        // Create single row grid
        this.letters = [randomLetters];
        
        // Initialize selection to center of the row
        this.initializeSelection();
        
        // Reset found words for this level
        this.foundWords.clear();
        
        // Initialize drag state
        this.initializeDragState();
        
        console.log(`Development mode: Single row with letters: ${randomLetters.join(' ')}`);
    }

    /**
     * Initialize selection indices to center of each row
     */
    initializeSelection() {
        this.selectedColumnIndices = [];
        for (let row = 0; row < this.letters.length; row++) {
            if (this.letters[row].length > 0) {
                const centerIndex = Math.floor(this.letters[row].length / 2);
                this.selectedColumnIndices[row] = centerIndex;
            } else {
                this.selectedColumnIndices[row] = 0;
            }
        }
    }

    /**
     * Initialize drag state arrays
     */
    initializeDragState() {
        const rowCount = this.letters.length;
        this.isDragging = Array(rowCount).fill(false);
        this.dragStartX = Array(rowCount).fill(0);
        this.dragOffset = Array(rowCount).fill(0);
        this.baseOffset = Array(rowCount).fill(0);
    }

    /**
     * Build word from currently selected letters
     */
    buildWordFromSelection() {
        // TEMPORARY: For single row development, just return the selected letter
        if (this.letters.length === 0 || this.letters[0].length === 0) return '';
        
        const col = this.selectedColumnIndices[0] || 0;
        if (col >= 0 && col < this.letters[0].length) {
            return this.letters[0][col];
        }
        return '';
    }

    /**
     * Confirm word and validate
     */
    confirmWord() {
        const letter = this.buildWordFromSelection();
        
        if (!letter || letter.length === 0) {
            this.showResult('No letter selected', 'error');
            return;
        }

        // TEMPORARY: For development, just show which letter was selected
        console.log(`Selected letter: ${letter}`);
        this.showResult(`Selected: ${letter}`, 'success');
        
        // Re-render to update UI
        this.renderGrid();
        this.updateUI();
    }

    /**
     * Remove used letters from grid
     */
    removeUsedLetters() {
        // Mark selected letters as used (set to space)
        for (let row = 0; row < this.selectedColumnIndices.length; row++) {
            const col = this.selectedColumnIndices[row];
            if (row < this.letters.length && col >= 0 && col < this.letters[row].length) {
                this.letters[row][col] = ' ';
            }
        }
        
        // Clean up grid
        this.cleanUpGrid();
    }

    /**
     * Clean up grid by removing empty spaces and rows
     */
    cleanUpGrid() {
        // Remove empty columns (spaces) from each row
        for (let row = 0; row < this.letters.length; row++) {
            this.letters[row] = this.letters[row].filter(letter => letter !== ' ');
        }
        
        // Remove empty rows
        this.letters = this.letters.filter(row => row.length > 0);
        
        // Ensure all rows have the same length by padding with spaces if necessary
        const maxLength = Math.max(...this.letters.map(row => row.length), 0);
        if (maxLength > 0) {
            for (let row = 0; row < this.letters.length; row++) {
                while (this.letters[row].length < maxLength) {
                    this.letters[row].push(' ');
                }
            }
        }
        
        // Validate and fix indices
        this.validateAndFixIndices();
    }

    /**
     * Validate and fix selected indices
     */
    validateAndFixIndices() {
        // Ensure array is right size
        while (this.selectedColumnIndices.length < this.letters.length) {
            this.selectedColumnIndices.push(0);
        }
        
        // Fix out-of-bounds indices
        for (let row = 0; row < this.selectedColumnIndices.length; row++) {
            if (row >= this.letters.length) {
                this.selectedColumnIndices[row] = 0;
            } else {
                const currentIndex = this.selectedColumnIndices[row];
                if (currentIndex < 0) {
                    this.selectedColumnIndices[row] = 0;
                } else if (currentIndex >= this.letters[row].length) {
                    this.selectedColumnIndices[row] = Math.max(0, this.letters[row].length - 1);
                }
            }
        }
    }

    /**
     * Auto-advance selection after grid cleanup
     */
    autoAdvanceSelection() {
        for (let row = 0; row < this.letters.length; row++) {
            if (row < this.selectedColumnIndices.length) {
                const currentIndex = this.selectedColumnIndices[row];
                
                if (currentIndex >= this.letters[row].length) {
                    const newIndex = Math.max(0, currentIndex - 1);
                    if (newIndex < this.letters[row].length) {
                        this.selectedColumnIndices[row] = newIndex;
                    }
                }
            }
        }
        this.validateAndFixIndices();
    }

    /**
     * Check if grid is empty
     */
    isGridEmpty() {
        return this.letters.length === 0 || this.letters.every(row => row.every(letter => letter === ' '));
    }

    /**
     * Progress to next level
     */
    progressToNextLevel() {
        // Check if user can progress
        if (this.foundWords.size < this.wordsNeededForProgression) {
            this.showResult(`Find at least ${this.wordsNeededForProgression} words to progress`, 'info');
            return;
        }
        
        // Update highscore
        if (this.totalWordsFoundInSession > this.highscore) {
            this.highscore = this.totalWordsFoundInSession;
            this.saveHighscore();
        }
        
        // Progress to next level
        this.currentLevelNumber++;
        this.generateNewLevel();
        this.renderGrid();
        this.updateUI();
        this.showResult(`Level ${this.currentLevelNumber} - Find ${this.wordsNeededForProgression} words!`, 'info');
    }

    /**
     * Add random word to grid
     */
    addRandomWord() {
        if (this.coins < this.ADD_WORD_COST) {
            this.showResult('Not enough coins', 'error');
            return;
        }
        
        const randomWord = dictionary.randomWord(this.currentWordLength);
        if (!randomWord) {
            this.showResult('Could not find a word', 'error');
            return;
        }
        
        this.coins -= this.ADD_WORD_COST;
        
        // Ensure we have enough rows
        while (this.letters.length < this.currentWordLength) {
            this.letters.push([]);
            this.selectedColumnIndices.push(0);
        }
        
        // Add each letter to its corresponding row
        for (let i = 0; i < randomWord.length; i++) {
            if (i < this.letters.length) {
                this.letters[i].push(randomWord[i]);
            }
        }
        
        // Shuffle each row
        for (let row = 0; row < this.letters.length; row++) {
            this.letters[row] = this.shuffleArray(this.letters[row]);
        }
        
        this.validateAndFixIndices();
        this.renderGrid();
        this.updateUI();
        this.showResult('Added random letters', 'success');
    }

    /**
     * Add one life
     */
    addLife() {
        if (this.coins < this.ADD_LIFE_COST) {
            this.showResult('Not enough coins', 'error');
            return;
        }
        
        this.coins -= this.ADD_LIFE_COST;
        this.lives++;
        this.updateUI();
        this.showResult('Received an extra heart', 'success');
    }

    /**
     * Restart game
     */
    restartGame() {
        this.lives = 3;
        this.coins = 0;
        this.currentLevelNumber = 1;
        this.totalWordsFoundInSession = 0;
        this.foundWords.clear();
        this.showGameOver = false;
        this.generateNewLevel();
        this.renderGrid();
        this.updateUI();
        document.getElementById('game-over-modal').classList.remove('show');
    }

    /**
     * Handle game over
     */
    handleGameOver() {
        this.showGameOver = true;
        
        // Update highscore
        if (this.totalWordsFoundInSession > this.highscore) {
            this.highscore = this.totalWordsFoundInSession;
            this.saveHighscore();
        }
        
        const message = `No more lives.\nScore: ${this.totalWordsFoundInSession}, Highscore: ${this.highscore}`;
        document.getElementById('game-over-message').textContent = message;
        document.getElementById('game-over-modal').classList.add('show');
    }

    /**
     * Render the letter grid
     */
    renderGrid() {
        const container = document.getElementById('letter-grid-container');
        container.innerHTML = '';
        
        if (this.letters.length === 0) {
            container.innerHTML = '<div class="empty-grid">Loading...</div>';
            return;
        }
        
        for (let row = 0; row < this.letters.length; row++) {
            const rowElement = this.createLetterRow(row);
            container.appendChild(rowElement);
        }
    }

    /**
     * Create a letter row element - STARTING FRESH
     */
    createLetterRow(rowIndex) {
        // Create outer container (visible area)
        const rowContainer = document.createElement('div');
        rowContainer.className = 'letter-row-container';
        rowContainer.dataset.row = rowIndex;
        
        // Create inner scrollable row
        const row = document.createElement('div');
        row.className = 'letter-row';
        row.dataset.row = rowIndex;
        
        const rowData = this.letters[rowIndex];
        const selectedCol = this.selectedColumnIndices[rowIndex] || 0;
        
        // Create letter buttons
        for (let col = 0; col < rowData.length; col++) {
            const letter = rowData[col];
            if (letter === ' ') continue;
            
            const button = document.createElement('div');
            button.className = 'letter-button';
            if (col === selectedCol) {
                button.classList.add('active');
            }
            button.textContent = letter;
            button.dataset.row = rowIndex;
            button.dataset.col = col;
            
            row.appendChild(button);
        }
        
        rowContainer.appendChild(row);
        
        // Initialize drag offset to 0
        this.dragOffset[rowIndex] = 0;
        this.baseOffset[rowIndex] = 0;
        
        // Setup drag handlers - will be implemented step by step
        this.setupRowDragHandlers(rowContainer, row, rowIndex);
        
        return rowContainer;
    }

    /**
     * Setup drag handlers for a row - STARTING FRESH
     */
    setupRowDragHandlers(rowContainer, rowElement, rowIndex) {
        let isDragging = false;
        let startX = 0;
        let startOffset = 0;
        
        // Calculate bounds: rightmost = first letter centered, leftmost = last letter centered
        const getBounds = () => {
            const containerWidth = rowContainer.offsetWidth;
            const rowData = this.letters[rowIndex];
            if (rowData.length === 0) return { min: 0, max: 0 };
            
            const screenCenter = containerWidth / 2;
            
            // Get actual button positions by measuring them
            const buttons = rowElement.querySelectorAll('.letter-button');
            if (buttons.length === 0) return { min: 0, max: 0 };
            
            // Get first and last button positions
            const firstButton = buttons[0];
            const lastButton = buttons[buttons.length - 1];
            
            const containerRect = rowContainer.getBoundingClientRect();
            const firstButtonRect = firstButton.getBoundingClientRect();
            const lastButtonRect = lastButton.getBoundingClientRect();
            
            // Calculate button centers relative to container
            const firstButtonCenter = (firstButtonRect.left - containerRect.left) + (firstButtonRect.width / 2);
            const lastButtonCenter = (lastButtonRect.left - containerRect.left) + (lastButtonRect.width / 2);
            
            // Calculate offsets needed to center each letter
            // Rightmost: first letter centered (positive offset moves row left, showing first letter)
            const maxOffset = screenCenter - firstButtonCenter;
            // Leftmost: last letter centered (negative offset moves row right, showing last letter)
            const minOffset = screenCenter - lastButtonCenter;
            
            return { min: minOffset, max: maxOffset };
        };
        
        const handleStart = (clientX) => {
            isDragging = true;
            this.isDragging[rowIndex] = true;
            startX = clientX;
            startOffset = this.dragOffset[rowIndex] || 0;
            rowContainer.style.cursor = 'grabbing';
            rowElement.style.transition = 'none';
        };
        
        const handleMove = (clientX) => {
            if (!isDragging || !this.isDragging[rowIndex]) return;
            
            const deltaX = clientX - startX;
            const newOffset = startOffset + deltaX;
            
            // Clamp to bounds
            const bounds = getBounds();
            const clampedOffset = Math.max(bounds.min, Math.min(bounds.max, newOffset));
            
            // Apply the offset
            this.dragOffset[rowIndex] = clampedOffset;
            rowElement.style.transform = `translateX(${clampedOffset}px)`;
        };
        
        const handleEnd = () => {
            if (isDragging) {
                isDragging = false;
                this.isDragging[rowIndex] = false;
                rowContainer.style.cursor = 'grab';
            }
        };
        
        // Mouse events
        const mouseMoveHandler = (e) => {
            handleMove(e.clientX);
        };
        
        const mouseUpHandler = () => {
            handleEnd();
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };
        
        rowContainer.addEventListener('mousedown', (e) => {
            handleStart(e.clientX);
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            e.preventDefault();
        });
        
        // Touch events
        const touchMoveHandler = (e) => {
            handleMove(e.touches[0].clientX);
            e.preventDefault();
        };
        
        const touchEndHandler = () => {
            handleEnd();
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);
        };
        
        rowContainer.addEventListener('touchstart', (e) => {
            handleStart(e.touches[0].clientX);
            document.addEventListener('touchmove', touchMoveHandler);
            document.addEventListener('touchend', touchEndHandler);
            e.preventDefault();
        });
    }

    /**
     * Calculate which letter index is currently centered
     */
    calculateCenteredIndex(rowIndex, rowContainer, rowElement) {
        const rowData = this.letters[rowIndex];
        if (rowData.length === 0) return 0;
        
        const containerWidth = rowContainer.offsetWidth;
        const screenCenter = containerWidth / 2;
        
        // Get all buttons and find which one is closest to center
        const buttons = rowElement.querySelectorAll('.letter-button');
        if (buttons.length === 0) return 0;
        
        let closestIndex = 0;
        let minDistance = Infinity;
        
        const containerRect = rowContainer.getBoundingClientRect();
        
        for (const button of buttons) {
            const buttonRect = button.getBoundingClientRect();
            const buttonCenter = (buttonRect.left - containerRect.left) + (buttonRect.width / 2);
            const distance = Math.abs(screenCenter - buttonCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = parseInt(button.dataset.col);
            }
        }
        
        return closestIndex;
    }

    /**
     * Calculate offset needed to center a specific letter index
     */
    calculateOffsetForIndex(rowIndex, index, rowContainer, rowElement) {
        const rowData = this.letters[rowIndex];
        if (index < 0 || index >= rowData.length) return 0;
        
        // Get the actual button element to measure its position
        const buttons = rowElement.querySelectorAll('.letter-button');
        if (buttons.length === 0) return 0;
        
        const containerWidth = rowContainer.offsetWidth;
        const screenCenter = containerWidth / 2;
        
        // Find the button at the specified index
        let targetButton = null;
        for (const button of buttons) {
            if (parseInt(button.dataset.col) === index) {
                targetButton = button;
                break;
            }
        }
        
        if (!targetButton) return 0;
        
        // Get the button's position relative to the container
        const buttonRect = targetButton.getBoundingClientRect();
        const containerRect = rowContainer.getBoundingClientRect();
        
        // Button center relative to container's left edge
        const buttonCenter = (buttonRect.left - containerRect.left) + (buttonRect.width / 2);
        
        // Offset needed to center this button at screen center
        return screenCenter - buttonCenter;
    }

    /**
     * Update which letter is centered based on drag position
     */
    updateCenteredLetter(rowIndex, rowContainer, rowElement) {
        const centeredIndex = this.calculateCenteredIndex(rowIndex, rowContainer, rowElement);
        
        if (centeredIndex !== this.selectedColumnIndices[rowIndex]) {
            this.selectedColumnIndices[rowIndex] = centeredIndex;
            // Update visual selection without re-rendering entire grid
            this.updateRowSelection(rowIndex);
        }
    }

    /**
     * Update visual selection for a single row
     */
    updateRowSelection(rowIndex) {
        const container = document.getElementById('letter-grid-container');
        const rowContainer = container.querySelector(`.letter-row-container[data-row="${rowIndex}"]`);
        if (!rowContainer) return;
        
        const buttons = rowContainer.querySelectorAll('.letter-button');
        const selectedCol = this.selectedColumnIndices[rowIndex];
        
        buttons.forEach((button) => {
            if (parseInt(button.dataset.col) === selectedCol) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    /**
     * Snap to nearest letter after drag ends
     */
    snapToNearestLetter(rowIndex, rowContainer, rowElement) {
        // Recalculate which letter is actually centered right now (don't trust selectedColumnIndices)
        const centeredIndex = this.calculateCenteredIndex(rowIndex, rowContainer, rowElement);
        
        // Update selection to the actually centered letter
        this.selectedColumnIndices[rowIndex] = centeredIndex;
        
        // Calculate offset to perfectly center this letter
        const targetOffset = this.calculateOffsetForIndex(rowIndex, centeredIndex, rowContainer, rowElement);
        
        this.dragOffset[rowIndex] = targetOffset;
        this.baseOffset[rowIndex] = targetOffset;
        
        // Animate to target position
        rowElement.style.transform = `translateX(${targetOffset}px)`;
        
        // Update visual selection
        this.updateRowSelection(rowIndex);
    }

    /**
     * Update UI elements
     */
    updateUI() {
        document.getElementById('lives').textContent = this.lives;
        
        const progressBtn = document.getElementById('progress-btn');
        const canProgress = this.foundWords.size >= this.wordsNeededForProgression;
        progressBtn.disabled = !canProgress;
        
        // Update button states
    }

    /**
     * Show result message
     */
    showResult(message, type = 'info') {
        this.result = message;
        const banner = document.getElementById('result-banner');
        banner.textContent = message;
        banner.className = `result-banner ${type} show`;
        
        setTimeout(() => {
            banner.classList.remove('show');
        }, 3000);
    }

    /**
     * Load highscore from localStorage
     */
    loadHighscore() {
        const saved = localStorage.getItem('wordslide_highscore');
        return saved ? parseInt(saved, 10) : 0;
    }

    /**
     * Save highscore to localStorage
     */
    saveHighscore() {
        localStorage.setItem('wordslide_highscore', this.highscore.toString());
    }

    /**
     * Utility: Shuffle array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

// Initialize game when page loads
let game;
document.addEventListener('DOMContentLoaded', async () => {
    game = new WordSlideGame();
});
