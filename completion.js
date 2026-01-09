document.addEventListener('DOMContentLoaded', () => {
    // Get and display reset count (tries)
    const resetCount = localStorage.getItem('completedResetCount');
    const triesMessage = document.getElementById('tries-message');
    let tries = 1;
    if (resetCount !== null) {
        tries = parseInt(resetCount, 10);
        triesMessage.textContent = ` in ${tries} ${tries === 1 ? 'try' : 'tries'}`;
    } else {
        triesMessage.textContent = ' in 1 try';
    }

    // Function to get share text
    function getShareText() {
        return `I have completed today's WordSlide puzzle in ${tries} ${tries === 1 ? 'try' : 'tries'} https://tedregon.github.io/wordslide.online/`;
    }

    // Share button - share to X/Twitter
    document.getElementById('share-btn').addEventListener('click', () => {
        const message = `I have completed today's WordSlide puzzle in ${tries} ${tries === 1 ? 'try' : 'tries'}`;
        const url = 'https://tedregon.github.io/wordslide.online/';
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`;
        window.open(twitterUrl, '_blank', 'width=550,height=420');
    });

    // Copy button - copy share text to clipboard
    document.getElementById('copy-btn').addEventListener('click', async () => {
        const shareText = getShareText();
        try {
            await navigator.clipboard.writeText(shareText);
            // Show feedback
            const copyBtn = document.getElementById('copy-btn');
            const originalText = copyBtn.querySelector('.btn-label').textContent;
            copyBtn.querySelector('.btn-label').textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.querySelector('.btn-label').textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareText;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                const copyBtn = document.getElementById('copy-btn');
                const originalText = copyBtn.querySelector('.btn-label').textContent;
                copyBtn.querySelector('.btn-label').textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.querySelector('.btn-label').textContent = originalText;
                }, 2000);
            } catch (fallbackErr) {
                console.error('Fallback copy failed:', fallbackErr);
            }
            document.body.removeChild(textArea);
        }
    });

    // Reset button - clear all found words and reset count, then redirect to game
    document.getElementById('reset-btn').addEventListener('click', () => {
        // Clear completed words and reset count
        localStorage.removeItem('completedWords');
        localStorage.removeItem('completedResetCount');
        
        // Clear all found words storage keys (they start with 'wordslide_foundWords_')
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('wordslide_foundWords_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Redirect to game page
        window.location.href = 'game.html';
    });
});

