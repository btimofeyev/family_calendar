// media-utilities.js - Utilities for handling media in the FamlyNook app

/**
 * Plays a video when clicked and shows controls
 * This helps videos play properly on mobile devices
 * @param {HTMLElement} videoElement - The video element to play
 */
function playVideo(videoElement) {
    if (videoElement && videoElement.paused) {
      videoElement.setAttribute('controls', '');
      videoElement.play().catch(err => {
        console.error('Error playing video:', err);
        // Sometimes mobile browsers block autoplay, so we need to show controls
        videoElement.setAttribute('controls', '');
      });
      
      // Hide the play button if it exists
      const playButton = videoElement.parentElement.querySelector('.video-play-button');
      if (playButton) {
        playButton.style.display = 'none';
      }
    }
  }
  
  /**
   * Creates a global helper to handle video clicks from inline HTML
   * This is needed because we can't attach event listeners to dynamically created elements easily
   */
  window.handleVideoClick = function(event, videoIndex) {
    event.stopPropagation(); // Prevent parent click handlers (like gallery open)
    
    const videoElement = event.currentTarget.querySelector('video');
    if (videoElement) {
      playVideo(videoElement);
    }
  };
  
  /**
   * Fix video display issues by adding missing controls and proper dimensions
   * This should be called after the page loads and after any content is dynamically added
   */
  function fixVideoDisplay() {
    // Find all videos without controls and add them
    document.querySelectorAll('video:not([controls])').forEach(video => {
      video.setAttribute('controls', '');
    });
    
    // Find all video containers that need interaction
    document.querySelectorAll('.media-grid-item video').forEach(video => {
      // Add click event to the parent container if it doesn't have one
      const container = video.closest('.media-grid-item');
      if (container && !container.hasAttribute('onclick')) {
        const index = container.dataset.index || 0;
        container.setAttribute('onclick', `handleVideoClick(event, ${index})`);
      }
      
      // Make sure video fills container properly
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
    });
    
    // Fix single video display
    document.querySelectorAll('.post-media').forEach(media => {
      if (media.tagName === 'VIDEO') {
        media.setAttribute('controls', '');
        media.style.maxWidth = '100%';
        media.style.borderRadius = '12px';
      }
    });
  }
  
  // Run the fix on page load
  document.addEventListener('DOMContentLoaded', fixVideoDisplay);
  
  // Also run the fix whenever new posts are loaded (mutation observer)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        fixVideoDisplay();
      }
    });
  });
  
  // Start observing the social feed content
  document.addEventListener('DOMContentLoaded', () => {
    const socialFeedContent = document.getElementById('socialFeedContent');
    if (socialFeedContent) {
      observer.observe(socialFeedContent, { childList: true, subtree: true });
    }
  });