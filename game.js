/**
 * WordJam Game - Main game logic
 * Implements WordJam mechanics for web
 */

class WordJamGame {
    constructor() {
        // Game state
        this.lives = 3;
        this.coins = 0;
        this.currentLevelNumber = 1;
        this.currentWordLength = 5;
        this.wordsNeededForProgression = 5;
        this.foundWords = []; // Array to preserve order (level words only)
        this.foundWordsSet = new Set(); // Set for quick lookup (level words only)
        this.otherFoundWords = []; // Array to preserve order (valid words not in level)
        this.otherFoundWordsSet = new Set(); // Set for quick lookup (other words)
        this.totalWordsFoundInSession = 0;
        this.highscore = this.loadHighscore();
        this.resetCount = 0;
        
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
        // Service worker is registered via sw-register.js
        
        // Load dictionary first
        await dictionary.load();
        
        // Generate initial level (will try Firebase first, fallback to random)
        await this.generateNewLevel();
        
        // Check if all words have been found - if so, redirect to completion page
        if (this.checkAllWordsFound()) {
            return; // Redirect will happen in checkAllWordsFound
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Render initial grid
        this.renderGrid();
        this.updateUI();
    }

    setupEventListeners() {
        document.getElementById('confirm-btn').addEventListener('click', () => this.confirmWord());
        document.getElementById('reset-btn').addEventListener('click', () => this.resetLevel().catch(console.error));
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame().catch(console.error));
        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
        
        // Words found accordion toggle
        const wordsFoundCounter = document.getElementById('words-found-counter');
        const wordsFoundAccordion = document.getElementById('words-found-accordion');
        const accordionClose = document.getElementById('accordion-close');
        
        if (wordsFoundCounter && wordsFoundAccordion) {
            wordsFoundCounter.addEventListener('click', () => {
                const isExpanded = wordsFoundAccordion.classList.contains('show');
                if (isExpanded) {
                    this.closeAccordion();
                } else {
                    this.openAccordion();
                }
            });
        }
        
        if (accordionClose) {
            accordionClose.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeAccordion();
            });
        }
        
        // Close accordion when clicking outside
        document.addEventListener('click', (e) => {
            const wrapper = document.querySelector('.words-found-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                this.closeAccordion();
            }
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
     * Generate a new level - tries Firebase first, falls back to random words
     */
    async generateNewLevel() {
        let words = null;
        
        // Try to fetch words from Firebase
        try {
            if (typeof firebaseService !== 'undefined') {
                words = await firebaseService.getTodaysWords();
            }
        } catch (error) {
            console.error('Firebase fetch error:', error);
        }
        
        // If Firebase didn't return words, generate random words as fallback
        if (!words || words.length === 0) {
            console.log('Using fallback: generating random words');
            const wordLength = 5;
            const wordCount = 5;
            
            // Get available words of the specified length
            const availableWords = dictionary.wordsOfLength(wordLength);
            
            if (availableWords.length < wordCount) {
                console.error(`Not enough ${wordLength}-letter words in dictionary. Available: ${availableWords.length}, needed: ${wordCount}`);
                // Fallback to basic words
                words = ['CAT', 'DOG', 'BAT', 'HAT', 'MAT'];
            } else {
                // Select exactly 5 random words
                const shuffled = this.shuffleArray([...availableWords]);
                words = shuffled.slice(0, wordCount);
            }
        }
        
        // Ensure words are uppercase
        this.currentLevelWords = words.map(word => word.toUpperCase());
        
        // Determine word length from the words (they should all be the same length)
        this.currentWordLength = this.currentLevelWords[0] ? this.currentLevelWords[0].length : 5;
        
        // Set words needed for progression to match the number of words used to generate the level
        this.wordsNeededForProgression = this.currentLevelWords.length;
        
        // console.log(`Level ${this.currentLevelNumber}: Using ${this.currentLevelWords.length} words of length ${this.currentWordLength}: ${this.currentLevelWords.join(', ')}`);
        
        // Generate letter grid from words
        this.letters = this.generateLettersGrid(this.currentLevelWords);
        
        // Initialize selection to center of each row
        this.initializeSelection();
        
        // Load found words from localStorage for this level
        this.loadFoundWords();
        
        // Reset tries count to 1 for new level (first play is try 1)
        this.resetCount = 1;
        
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
            const wordUpper = word.toUpperCase();
            
            // Check if this word is one of the words used to generate the level
            const isLevelWord = this.currentLevelWords.some(levelWord => 
                levelWord.toUpperCase() === wordUpper
            );
            
            // Track level words
            if (isLevelWord && !this.foundWordsSet.has(wordUpper)) {
                // Valid level word found! Add to array (preserves order) and set
                this.foundWords.push(wordUpper);
                this.foundWordsSet.add(wordUpper);
                this.saveFoundWords();
            } else if (!isLevelWord && !this.otherFoundWordsSet.has(wordUpper)) {
                // Valid word but not a level word - track as "other word"
                this.otherFoundWords.push(wordUpper);
                this.otherFoundWordsSet.add(wordUpper);
                this.saveFoundWords();
            }
            
            this.totalWordsFoundInSession++;
            this.coins += this.COINS_PER_WORD;
            
            const levelWordsFound = this.foundWords.length;
            // console.log(`Found valid ${this.currentWordLength}-letter word '${wordUpper}' (${levelWordsFound}/${this.wordsNeededForProgression} level words found)`);
            
            // Remove used letters
            this.removeUsedLetters();
            
            // Check if all words are found first
            if (this.foundWords.length >= this.wordsNeededForProgression) {
                // Store found words in localStorage
                localStorage.setItem('completedWords', JSON.stringify(this.foundWords));
                
                // Store reset count in localStorage
                localStorage.setItem('completedResetCount', this.resetCount.toString());
                
                // Redirect to completion page
                window.location.href = 'completion.html';
                return;
            }
            
            // Check if grid is empty (level complete)
            if (this.isGridEmpty()) {
                this.progressToNextLevel().catch(console.error);
                return;
            }
            
            // Auto-advance selection
            this.autoAdvanceSelection();
            
            // Re-render grid
            this.renderGrid();
            this.updateUI();
            this.showResult(`Found word "${word.toUpperCase()}"`, 'success');
        } else {
            // Invalid word - just show error message
            this.showResult('Not a valid word.', 'error');
            
            if (!correctLength) {
                console.log(`Wrong length word '${word}' (needs ${this.currentWordLength} letters)`);
            } else {
                console.log(`Invalid word '${word}'`);
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
     * Check if all words have been found and redirect to completion page if so
     */
    checkAllWordsFound() {
        if (this.foundWords.length >= this.wordsNeededForProgression) {
            console.log('All words already found, redirecting to completion page');
            // Store found words in localStorage (in case they weren't already stored)
            localStorage.setItem('completedWords', JSON.stringify(this.foundWords));
            
            // Store reset count in localStorage (load from existing or use current)
            const savedResetCount = localStorage.getItem('completedResetCount');
            if (!savedResetCount) {
                localStorage.setItem('completedResetCount', this.resetCount.toString());
            }
            
            // Redirect to completion page
            window.location.href = 'completion.html';
            return true;
        }
        return false;
    }

    /**
     * Progress to next level
     */
    async progressToNextLevel() {
        // Check if user can progress
        if (this.foundWords.length < this.wordsNeededForProgression) {
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
        await this.generateNewLevel();
        this.renderGrid();
        this.updateUI();
        this.showResult(`Level ${this.currentLevelNumber} - Find ${this.wordsNeededForProgression} words!`, 'info');
    }

    /**
     * Reset current level using the same words
     */
    async resetLevel() {
        // Increment reset counter
        this.resetCount++;
        
        // Check if we have current level words, if not generate a new level
        if (!this.currentLevelWords || this.currentLevelWords.length === 0) {
            await this.generateNewLevel();
        } else {
            // Use the same words to regenerate the level
            console.log(`Resetting level ${this.currentLevelNumber} with same words: ${this.currentLevelWords.join(', ')}`);
            
            // Generate letter grid from the same words
            this.letters = this.generateLettersGrid(this.currentLevelWords);
            
            // Initialize selection to center of each row
            this.initializeSelection();
            
            // Keep found words (don't clear on reset)
            
            // Initialize drag state
            this.initializeDragState();
        }
        
        // Clear any result messages
        const banner = document.getElementById('result-banner');
        banner.classList.remove('show');
        banner.textContent = '';
        this.result = '';
        this.showGameOver = false;
        
        // Re-render the grid
        this.renderGrid();
        this.updateUI();
        document.getElementById('game-over-modal').classList.remove('show');
    }

    /**
     * Restart game (full reset)
     */
    async restartGame() {
        this.lives = 3;
        this.coins = 0;
        this.currentLevelNumber = 1;
        this.totalWordsFoundInSession = 0;
        this.resetCount = 1; // Start at 1 since the first play is try 1
        this.foundWords = [];
        this.foundWordsSet.clear();
        this.otherFoundWords = [];
        this.otherFoundWordsSet.clear();
        this.showGameOver = false;
        await this.generateNewLevel();
        this.renderGrid();
        this.updateUI();
        document.getElementById('game-over-modal').classList.remove('show');
    }

    /**
     * Render the letter grid
     */
    renderGrid() {
        const container = document.getElementById('letter-grid-container');
        // Clear container safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        if (this.letters.length === 0) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'empty-grid';
            loadingDiv.textContent = 'Loading...';
            container.appendChild(loadingDiv);
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
        // Update reset counter (tries) next to Restart button
        const resetDisplay = document.getElementById('reset-count');
        if (resetDisplay) {
            resetDisplay.textContent = this.resetCount;
        }
        
        // Update words found counter (X / Y)
        const wordsFoundCount = document.getElementById('words-found-count');
        const wordsTotalCount = document.getElementById('words-total-count');
        if (wordsFoundCount && wordsTotalCount) {
            // Count only words that match the level's generated words
            const levelWordsFound = this.foundWords.filter(word => 
                this.currentLevelWords.some(levelWord => 
                    levelWord.toUpperCase() === word.toUpperCase()
                )
            ).length;
            wordsFoundCount.textContent = levelWordsFound;
            wordsTotalCount.textContent = this.currentLevelWords.length;
        }
        
        // Update found words display
        this.updateFoundWordsDisplay();
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
     * Get storage key for found words based on current level words
     */
    getFoundWordsStorageKey() {
        if (!this.currentLevelWords || this.currentLevelWords.length === 0) {
            return 'wordjam_foundWords_default';
        }
        // Create a key based on sorted level words (so same level = same key)
        const sortedWords = [...this.currentLevelWords].sort().join(',');
        return `wordjam_foundWords_${sortedWords}`;
    }

    /**
     * Load found words from localStorage
     */
    loadFoundWords() {
        const key = this.getFoundWordsStorageKey();
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                
                // Handle both old format (array) and new format (object)
                if (Array.isArray(data)) {
                    // Old format - migrate to new format
                    this.foundWords = data.filter(word => 
                        this.currentLevelWords.some(levelWord => 
                            levelWord.toUpperCase() === word.toUpperCase()
                        )
                    );
                    this.otherFoundWords = [];
                } else {
                    // New format with levelWords and otherWords
                    const loadedLevelWords = data.levelWords || [];
                    const loadedOtherWords = data.otherWords || [];
                    
                    // Filter to only include words that are in the current level's words
                    this.foundWords = loadedLevelWords.filter(word => 
                        this.currentLevelWords.some(levelWord => 
                            levelWord.toUpperCase() === word.toUpperCase()
                        )
                    );
                    this.otherFoundWords = loadedOtherWords;
                }
                
                this.foundWordsSet = new Set(this.foundWords);
                this.otherFoundWordsSet = new Set(this.otherFoundWords);
                console.log(`Loaded ${this.foundWords.length} level words and ${this.otherFoundWords.length} other words from storage`);
            } catch (e) {
                console.error('Error loading found words:', e);
                this.foundWords = [];
                this.foundWordsSet = new Set();
                this.otherFoundWords = [];
                this.otherFoundWordsSet = new Set();
            }
        } else {
            this.foundWords = [];
            this.foundWordsSet = new Set();
            this.otherFoundWords = [];
            this.otherFoundWordsSet = new Set();
        }
        this.updateFoundWordsDisplay();
    }

    /**
     * Save found words to localStorage
     */
    saveFoundWords() {
        const key = this.getFoundWordsStorageKey();
        const data = {
            levelWords: this.foundWords,
            otherWords: this.otherFoundWords
        };
        localStorage.setItem(key, JSON.stringify(data));
        this.updateFoundWordsDisplay();
    }

    /**
     * Update the found words display in the accordion
     */
    updateFoundWordsDisplay() {
        const levelWordsList = document.getElementById('found-words-list');
        const otherWordsList = document.getElementById('other-found-words-list');
        
        // Display today's words (level words)
        if (levelWordsList) {
            // Filter to only show words that are in the current level's words
            const levelWordsFound = this.foundWords.filter(word => 
                this.currentLevelWords.some(levelWord => 
                    levelWord.toUpperCase() === word.toUpperCase()
                )
            );

            // Clear existing content
            levelWordsList.textContent = '';
            
            if (levelWordsFound.length === 0) {
                const noWordsSpan = document.createElement('span');
                noWordsSpan.className = 'no-words-message';
                noWordsSpan.textContent = 'No words found yet';
                levelWordsList.appendChild(noWordsSpan);
            } else {
                levelWordsFound.forEach(word => {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'found-word';
                    wordSpan.textContent = word;
                    levelWordsList.appendChild(wordSpan);
                });
            }
        }
        
        // Display other words found
        if (otherWordsList) {
            // Clear existing content
            otherWordsList.textContent = '';
            
            if (this.otherFoundWords.length === 0) {
                const noWordsSpan = document.createElement('span');
                noWordsSpan.className = 'no-words-message';
                noWordsSpan.textContent = 'No other words found yet';
                otherWordsList.appendChild(noWordsSpan);
            } else {
                this.otherFoundWords.forEach(word => {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'found-word';
                    wordSpan.textContent = word;
                    otherWordsList.appendChild(wordSpan);
                });
            }
        }
    }

    /**
     * Open the accordion
     */
    openAccordion() {
        const wordsFoundAccordion = document.getElementById('words-found-accordion');
        const wordsFoundCounter = document.getElementById('words-found-counter');
        if (wordsFoundAccordion && wordsFoundCounter) {
            wordsFoundAccordion.classList.add('show');
            wordsFoundCounter.classList.add('expanded');
        }
    }

    /**
     * Close the accordion
     */
    closeAccordion() {
        const wordsFoundAccordion = document.getElementById('words-found-accordion');
        const wordsFoundCounter = document.getElementById('words-found-counter');
        if (wordsFoundAccordion && wordsFoundCounter) {
            wordsFoundAccordion.classList.remove('show');
            wordsFoundCounter.classList.remove('expanded');
        }
    }

    /**
     * Load highscore from localStorage
     */
    loadHighscore() {
        const saved = localStorage.getItem('wordjam_highscore');
        return saved ? parseInt(saved, 10) : 0;
    }

    /**
     * Save highscore to localStorage
     */
    saveHighscore() {
        localStorage.setItem('wordjam_highscore', this.highscore.toString());
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
    game = new WordJamGame();
});
