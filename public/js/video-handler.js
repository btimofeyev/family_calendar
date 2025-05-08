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
    // Fix video posts in the feed
    setupVideoPlayers();
    
    // Fix video play buttons
    setupVideoPlayButtons();
  }
  
  // Set up video players with proper controls and poster images
  function setupVideoPlayers() {
    // Find all videos that don't have controls yet
    const videos = document.querySelectorAll('video:not([data-initialized])');
    
    videos.forEach(video => {
      // Mark as initialized to avoid duplicating work
      video.setAttribute('data-initialized', 'true');
      
      // Add controls attribute if missing
      if (!video.hasAttribute('controls')) {
        video.setAttribute('controls', '');
      }
      
      // Hide controls by default (will show on play)
      video.controls = false;
      
      // Create poster frame if needed
      if (!video.hasAttribute('poster') && video.parentElement) {
        // Check if we need to add a play button container
        const needsPlayButton = !video.parentElement.classList.contains('video-container');
        
        if (needsPlayButton) {
          // Create a container for the video with play button
          const videoContainer = document.createElement('div');
          videoContainer.className = 'video-container';
          
          // Add play button
          const playButton = document.createElement('div');
          playButton.className = 'video-play-button';
          playButton.innerHTML = '<i class="fas fa-play"></i>';
          
          // Insert the video container before the video in the DOM
          video.parentNode.insertBefore(videoContainer, video);
          
          // Move the video inside the container
          videoContainer.appendChild(video);
          
          // Add the play button to the container
          videoContainer.appendChild(playButton);
          
          // Setup click handler for the play button
          playButton.addEventListener('click', (e) => {
            e.stopPropagation();
            playVideo(video);
          });
        }
      }
      
      // Add click handler to the video
      video.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (video.paused) {
          playVideo(video);
        } else {
          video.pause();
        }
      });
      
      // Handle video play/pause state
      video.addEventListener('play', () => {
        // Show controls when playing
        video.controls = true;
        
        // Hide play button if it exists
        const playButton = video.parentElement.querySelector('.video-play-button');
        if (playButton) {
          playButton.style.display = 'none';
        }
      });
      
      video.addEventListener('pause', () => {
        // Show play button again if it exists
        const playButton = video.parentElement.querySelector('.video-play-button');
        if (playButton && !video.ended) {
          playButton.style.display = 'flex';
        }
      });
      
      video.addEventListener('ended', () => {
        // Show play button when video ends
        const playButton = video.parentElement.querySelector('.video-play-button');
        if (playButton) {
          playButton.style.display = 'flex';
        }
        
        // Hide controls when ended
        video.controls = false;
      });
    });
  }
  
  // Set up play buttons for all video items
  function setupVideoPlayButtons() {
    // Find all media items that contain videos but don't have play buttons yet
    const videoMediaItems = document.querySelectorAll('.media-item:has(video):not(.video-item)');
    
    videoMediaItems.forEach(item => {
      // Mark as video item
      item.classList.add('video-item');
      
      // Add click handler to play the video
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const video = item.querySelector('video');
        if (video) {
          playVideo(video);
        }
      });
    });
  }
  
  // Play a video with proper controls
  function playVideo(videoElement) {
    if (!videoElement) return;
    
    // Show controls
    videoElement.controls = true;
    
    // Play the video
    videoElement.play().catch(err => {
      console.error('Error playing video:', err);
      // Sometimes mobile browsers block autoplay, so we still need to show controls
      videoElement.controls = true;
    });
    
    // Hide the play button if it exists
    const playButton = videoElement.parentElement.querySelector('.video-play-button');
    if (playButton) {
      playButton.style.display = 'none';
    }
  }
  
  // Helper function to create a post element with proper video handling
  function createPostElement(post) {
    // This function can be used as a reference for how to properly create post elements
    // with videos in the social-feed.js file
    
    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    postElement.dataset.id = post.post_id;
    
    // Add media content if available
    let mediaContent = '';
    if (post.media_urls && post.media_urls.length > 0) {
      if (post.media_urls.length === 1) {
        // Single media item
        const mediaUrl = post.media_urls[0];
        if (post.media_type === 'video') {
          mediaContent = `
            <div class="video-container">
              <video src="${mediaUrl}" preload="metadata" data-initialized="true"></video>
              <div class="video-play-button">
                <i class="fas fa-play"></i>
              </div>
            </div>
          `;
        } else {
          mediaContent = `
            <div class="post-media">
              <img src="${mediaUrl}" alt="Post image">
            </div>
          `;
        }
      } else {
        // Multiple media items in a grid
        mediaContent = '<div class="post-media-grid">';
        
        post.media_urls.forEach(mediaUrl => {
          if (post.media_type === 'video') {
            mediaContent += `
              <div class="media-item video-item">
                <video src="${mediaUrl}" preload="metadata" data-initialized="true"></video>
              </div>
            `;
          } else {
            mediaContent += `
              <div class="media-item">
                <img src="${mediaUrl}" alt="Post image">
              </div>
            `;
          }
        });
        
        mediaContent += '</div>';
      }
    }
    
    // Add mediaContent to your post HTML structure
    return postElement;
  }