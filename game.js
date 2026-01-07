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
        // Generate level with exactly 5 words of 3 letters each
        const wordLength = 3;
        const wordCount = 5;
        
        // Get available words of the specified length
        const availableWords = dictionary.wordsOfLength(wordLength);
        
        if (availableWords.length < wordCount) {
            console.error(`Not enough ${wordLength}-letter words in dictionary. Available: ${availableWords.length}, needed: ${wordCount}`);
            // Fallback to basic words
            const fallbackWords = ['CAT', 'DOG', 'BAT', 'HAT', 'MAT'];
            this.currentLevelWords = fallbackWords;
        } else {
            // Select exactly 5 random words
            const shuffled = this.shuffleArray([...availableWords]);
            this.currentLevelWords = shuffled.slice(0, wordCount);
        }
        
        console.log(`Level ${this.currentLevelNumber}: Generated ${wordCount} words of length ${wordLength}: ${this.currentLevelWords.join(', ')}`);
        
        // Set current word length for validation
        this.currentWordLength = wordLength;
        
        // Generate letter grid from words
        this.letters = this.generateLettersGrid(this.currentLevelWords);
        
        // Initialize selection to center of each row
        this.initializeSelection();
        
        // Reset found words for this level
        this.foundWords.clear();
        this.clearSubmittedWords();
        
        // Initialize drag state
        this.initializeDragState();
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
        let word = '';
        for (let row = 0; row < this.selectedColumnIndices.length; row++) {
            const col = this.selectedColumnIndices[row];
            if (row < this.letters.length && col >= 0 && col < this.letters[row].length) {
                const letter = this.letters[row][col];
                if (letter && letter !== ' ') {
                    word += letter;
                }
            }
        }
        return word;
    }

    /**
     * Confirm word and validate
     */
    confirmWord() {
        const word = this.buildWordFromSelection();
        
        if (!word || word.length === 0) {
            this.showResult('Not a valid word', 'error');
            return;
        }

        // Validate word
        const isValid = dictionary.isValidWord(word);
        const correctLength = word.length === this.currentWordLength;

        if (isValid && correctLength) {
            // Valid word found!
            this.foundWords.add(word.toUpperCase());
            this.totalWordsFoundInSession++;
            this.coins += this.COINS_PER_WORD;
            
            console.log(`Found valid ${this.currentWordLength}-letter word '${word.toUpperCase()}' (${this.foundWords.size}/${this.wordsNeededForProgression} words found)`);
            
            // Add word to submitted words display
            this.addSubmittedWord(word.toUpperCase());
            
            // Remove used letters
            this.removeUsedLetters();
            
            // Check if grid is empty (level complete)
            if (this.isGridEmpty()) {
                this.progressToNextLevel();
                return;
            }
            
            // Auto-advance selection
            this.autoAdvanceSelection();
            
            // Re-render grid
            this.renderGrid();
            this.updateUI();
            this.showResult(`Found "${word.toUpperCase()}"`, 'success');
        } else {
            // Invalid word - lose a life
            this.lives--;
            this.showResult('Not a valid word. -1', 'error');
            
            if (!correctLength) {
                console.log(`Wrong length word '${word}' (needs ${this.currentWordLength} letters)`);
            } else {
                console.log(`Invalid word '${word}'`);
            }
            
            if (this.lives <= 0) {
                this.handleGameOver();
            }
            
            this.updateUI();
        }
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
     * Add a word to the submitted words display
     */
    addSubmittedWord(word) {
        const wordsList = document.getElementById('words-list');
        if (!wordsList) return;
        
        const wordBadge = document.createElement('div');
        wordBadge.className = 'word-badge';
        wordBadge.textContent = word;
        wordsList.appendChild(wordBadge);
    }

    /**
     * Clear submitted words display
     */
    clearSubmittedWords() {
        const wordsList = document.getElementById('words-list');
        if (wordsList) {
            wordsList.innerHTML = '';
        }
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
        this.clearSubmittedWords();
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
            // Remove color animation: only allow transform to transition
            button.style.transitionProperty = 'transform';
            button.style.transitionDuration = '300ms';
            button.style.transitionTimingFunction = 'ease-out';
            
            row.appendChild(button);
        }
        
        rowContainer.appendChild(row);
        
        // Setup drag handlers
        this.setupRowDragHandlers(rowContainer, row, rowIndex);

        // After the row is in the DOM, center the initially selected letter
        requestAnimationFrame(() => {
        const selected = this.selectedColumnIndices[rowIndex] || 0;
        const targetOffset = this.calculateOffsetForIndex(rowIndex, selected, rowContainer, row);
        this.dragOffset[rowIndex] = targetOffset;
        this.baseOffset[rowIndex] = targetOffset;
        row.style.transform = `translateX(${targetOffset}px)`;
        this.updateRowSelection(rowIndex);
        });

        return rowContainer;
    }

    /**
     * Setup drag handlers for a row - STARTING FRESH
     */
    /**
 * Setup drag handlers for a row
 * Continuous snapping while dragging (step-by-step, center-sticky)
 */
setupRowDragHandlers(rowContainer, rowElement, rowIndex) {
    let isDragging = false;
    let startX = 0;
    let startOffset = 0;
  
    // Measurements
    let baseCenters = null; // center-x of each button when translateX == 0, relative to container
    let stepPx = null;      // distance between adjacent centers
  
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  
    const computeMetrics = () => {
      const buttons = Array.from(rowElement.querySelectorAll('.letter-button'));
      if (buttons.length === 0) {
        baseCenters = [];
        stepPx = 0;
        return;
      }
  
      const containerRect = rowContainer.getBoundingClientRect();
      const currentOffset = this.dragOffset[rowIndex] || 0;
  
      const centers = buttons.map(btn => {
        const r = btn.getBoundingClientRect();
        const center = (r.left - containerRect.left) + (r.width / 2);
        return {
          col: parseInt(btn.dataset.col, 10),
          baseCenter: center - currentOffset // normalize to "no transform"
        };
      });
  
      centers.sort((a, b) => a.col - b.col);
      baseCenters = centers.map(x => x.baseCenter);
  
      if (baseCenters.length >= 2) {
        stepPx = baseCenters[1] - baseCenters[0];
      } else {
        stepPx = this.BUTTON_WIDTH + this.BUTTON_SPACING; // fallback
      }
    };
  
    const getBounds = () => {
      if (!baseCenters || baseCenters.length === 0) return { min: 0, max: 0 };
  
      const screenCenter = rowContainer.offsetWidth / 2;
      const firstCenter = baseCenters[0];
      const lastCenter = baseCenters[baseCenters.length - 1];
  
      return {
        max: screenCenter - firstCenter, // center first
        min: screenCenter - lastCenter   // center last
      };
    };
  
    const offsetToIndex = (offset) => {
      if (!baseCenters || baseCenters.length === 0) return 0;
  
      const screenCenter = rowContainer.offsetWidth / 2;
      const firstCenter = baseCenters[0];
  
      const raw = (screenCenter - (firstCenter + offset)) / stepPx;
      return clamp(Math.round(raw), 0, baseCenters.length - 1);
    };
  
    const indexToOffset = (idx) => {
      if (!baseCenters || baseCenters.length === 0) return 0;
      const screenCenter = rowContainer.offsetWidth / 2;
      return screenCenter - baseCenters[idx];
    };
  
    const applyOffset = (offset) => {
      this.dragOffset[rowIndex] = offset;
      this.baseOffset[rowIndex] = offset;
      rowElement.style.transform = `translateX(${offset}px)`;
    };

    const applySelection = (snappedIndex) => {
      const prevIndex = this.selectedColumnIndices[rowIndex] || 0;
      if (snappedIndex !== prevIndex) {
        this.selectedColumnIndices[rowIndex] = snappedIndex;
        this.updateRowSelection(rowIndex);
      }
    };
  
    const handleStart = (clientX) => {
      isDragging = true;
      this.isDragging[rowIndex] = true;
      startX = clientX;
      startOffset = this.dragOffset[rowIndex] || 0;
  
      rowContainer.style.cursor = 'grabbing';
      rowElement.style.transition = 'none';
  
      computeMetrics();
    };
  
    // RAF throttle to keep movement smooth
    let pendingMove = null;
    let rafId = null;

    const processMove = (clientX) => {
      if (!isDragging || !this.isDragging[rowIndex]) return;

      if (!baseCenters || baseCenters.length === 0 || !stepPx) computeMetrics();

      const deltaX = clientX - startX;
      const proposedOffset = startOffset + deltaX;

      const bounds = getBounds();
      const clampedOffset = clamp(proposedOffset, bounds.min, bounds.max);

      // SMOOTH DRAG: follow the finger exactly (shows direction),
      // but update the selected index based on which letter is closest to center.
      applyOffset(clampedOffset);

      const idx = offsetToIndex(clampedOffset);
      applySelection(idx);
    };

    const handleMove = (clientX) => {
      pendingMove = clientX;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pendingMove !== null) {
          processMove(pendingMove);
          pendingMove = null;
        }
      });
    };
  
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      this.isDragging[rowIndex] = false;
      rowContainer.style.cursor = 'grab';

      // SNAP ON RELEASE: animate to the nearest centered letter
      computeMetrics();
      const idx = clamp(this.selectedColumnIndices[rowIndex] || 0, 0, (baseCenters?.length || 1) - 1);
      const snappedOffset = indexToOffset(idx);

      rowElement.style.transition = 'transform 120ms ease-out';
      applyOffset(snappedOffset);

      // Clear transition after it settles
      setTimeout(() => {
        rowElement.style.transition = 'none';
      }, 140);
    };
  
    // Mouse events
    const mouseMoveHandler = (e) => handleMove(e.clientX);
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
      document.addEventListener('touchmove', touchMoveHandler, { passive: false });
      document.addEventListener('touchend', touchEndHandler);
      e.preventDefault();
    });
  
    // Keep centered selection stable after resizes
    window.addEventListener('resize', () => {
      computeMetrics();
      const idx = clamp(this.selectedColumnIndices[rowIndex] || 0, 0, (baseCenters?.length || 1) - 1);
      const snappedOffset = indexToOffset(idx);
      rowElement.style.transition = 'none';
      applyOffset(snappedOffset);
      applySelection(idx);
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
