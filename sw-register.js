// Service Worker Registration and Update Checking
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful:', registration.scope);
        
        // Check if there's already a waiting service worker
        if (registration.waiting) {
          console.log('Waiting service worker found');
          showUpdateModal(registration);
        }
        
        // Check for updates on every page load
        registration.update();
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is available - show update modal
              console.log('New service worker available');
              showUpdateModal(registration);
            }
          });
        });
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// Show update modal to user
function showUpdateModal(registration) {
  const updateModal = document.getElementById('update-modal');
  if (updateModal) {
    updateModal.classList.add('show');
    
    // Handle refresh button
    const refreshBtn = document.getElementById('update-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        // Tell the new service worker to skip waiting and take control
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      }, { once: true });
    }
    
    // Handle later button (optional - user can dismiss)
    const laterBtn = document.getElementById('update-later-btn');
    if (laterBtn) {
      laterBtn.addEventListener('click', () => {
        updateModal.classList.remove('show');
      }, { once: true });
    }
  }
}

