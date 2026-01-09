document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('play-btn');
    const offlineMessage = document.getElementById('offline-message');
    
    function checkConnectivity() {
        // Check if navigator.onLine is available
        if (typeof navigator.onLine !== 'undefined') {
            if (navigator.onLine) {
                handleOnline();
            } else {
                handleOffline();
            }
        } else {
            // Fallback: assume online if navigator.onLine is not available
            handleOnline();
        }
    }
    
    function handleOffline() {
        // Disable the play button
        playBtn.style.pointerEvents = 'none';
        playBtn.style.opacity = '0.5';
        playBtn.style.cursor = 'not-allowed';
        
        // Show offline message
        offlineMessage.style.display = 'block';
    }
    
    function handleOnline() {
        // Enable the play button
        playBtn.style.pointerEvents = 'auto';
        playBtn.style.opacity = '1';
        playBtn.style.cursor = 'pointer';
        
        // Hide offline message
        offlineMessage.style.display = 'none';
    }
    
    // Check connectivity on page load
    checkConnectivity();
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
        checkConnectivity();
    });
    
    window.addEventListener('offline', () => {
        handleOffline();
    });
    
    // Prevent navigation if offline
    playBtn.addEventListener('click', (e) => {
        if (navigator.onLine === false || playBtn.style.pointerEvents === 'none') {
            e.preventDefault();
            return false;
        }
    });
});

