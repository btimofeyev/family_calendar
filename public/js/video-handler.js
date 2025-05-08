// Video handling fixes for FamlyNook
document.addEventListener('DOMContentLoaded', () => {
    // Initialize video functionality
    initializeVideos();
    
    // Re-initialize when posts are loaded or changes happen
    document.addEventListener('postsLoaded', initializeVideos);
    
    // Watch for DOM changes to catch dynamically added videos
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          initializeVideos();
        }
      });
    });
    
    // Start observing the posts container
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
      observer.observe(postsContainer, { childList: true, subtree: true });
    }
  });
  
  // Initialize all videos on the page
  function initializeVideos() {
    // Find all video containers
    const videoContainers = document.querySelectorAll('.video-container');
    
    videoContainers.forEach(container => {
      const video = container.querySelector('video');
      const playButton = container.querySelector('.video-play-button');
      
      if (!video || !playButton) return;
      
      // Mark container as initialized
      if (container.hasAttribute('data-initialized')) return;
      container.setAttribute('data-initialized', 'true');
      
      // Make sure video has proper attributes
      video.controls = false;
      video.preload = 'metadata';
      
      // Add click event to play button
      playButton.addEventListener('click', (e) => {
        e.stopPropagation();
        playVideo(video, container);
      });
      
      // Add click event to container (but not if clicking on controls)
      container.addEventListener('click', (e) => {
        // Don't trigger if clicking on controls
        if (e.target.closest('video::-webkit-media-controls')) return;
        
        if (video.paused) {
          playVideo(video, container);
        } else {
          pauseVideo(video, container);
        }
      });
      
      // Handle video events
      video.addEventListener('play', () => {
        container.classList.add('playing');
        playButton.style.display = 'none';
        video.controls = true;
      });
      
      video.addEventListener('pause', () => {
        if (!video.ended) {
          container.classList.remove('playing');
          playButton.style.display = 'flex';
        }
      });
      
      video.addEventListener('ended', () => {
        container.classList.remove('playing');
        playButton.style.display = 'flex';
        video.controls = false;
      });
    });
    
    // Handle individual videos that aren't in containers
    const standaloneVideos = document.querySelectorAll('video:not(.video-container video):not([data-initialized])');
    
    standaloneVideos.forEach(video => {
      video.setAttribute('data-initialized', 'true');
      video.controls = true;
      video.preload = 'metadata';
    });
  }
  
  // Play a video
  function playVideo(videoElement, container) {
    if (!videoElement) return;
    
    videoElement.play().then(() => {
      // Show controls when playing
      videoElement.controls = true;
      
      // Mark container as playing
      if (container) {
        container.classList.add('playing');
      }
      
      // Hide play button
      const playButton = container ? 
        container.querySelector('.video-play-button') : 
        videoElement.parentElement.querySelector('.video-play-button');
        
      if (playButton) {
        playButton.style.display = 'none';
      }
    }).catch(err => {
      console.error('Error playing video:', err);
      // Sometimes mobile browsers block autoplay, so still show controls
      videoElement.controls = true;
    });
  }
  
  // Pause a video
  function pauseVideo(videoElement, container) {
    if (!videoElement) return;
    
    videoElement.pause();
    
    // Show play button again
    if (container) {
      container.classList.remove('playing');
      const playButton = container.querySelector('.video-play-button');
      if (playButton) {
        playButton.style.display = 'flex';
      }
    }
  }
  
  // For global access in HTML onclick handlers
  window.playVideo = function(videoId) {
    const video = document.getElementById(videoId);
    const container = video ? video.closest('.video-container') : null;
    playVideo(video, container);
  };