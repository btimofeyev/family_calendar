// public/js/socialFeed.js - Enhanced version with support for multiple media, videos, etc.

document.addEventListener("DOMContentLoaded", async () => {
  const scrollToTopLink = document.getElementById("scrollToTop");
  if (scrollToTopLink) {
    scrollToTopLink.addEventListener("click", function (event) {
      event.preventDefault();
      document.querySelector(".center-column").scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }
  
  // Fetch the user's families and set the default family
  await setDefaultFamily();
  await initializeSocialFeed();
});

let currentFamilyId = null;
let currentPage = 1;
let totalPages = 1;
let isLoadingMore = false;

async function setDefaultFamily() {
  try {
    const families = await fetchUserFamilies();
    if (families.length > 0) {
      currentFamilyId = families[0].family_id;
    }
  } catch (error) {
    console.error("Error setting default family:", error);
  }
}

// Add the missing appendComment and appendReply functions
function appendComment(postId, comment) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  
  // Check if this is the first comment
  const emptyComments = commentsSection.querySelector('.empty-comments');
  if (emptyComments) {
    // Remove the "No comments" message
    emptyComments.remove();
    
    // Add comment counter
    const commentCounter = document.createElement('div');
    commentCounter.className = 'comment-counter';
    commentCounter.textContent = '1 Comment';
    commentsSection.appendChild(commentCounter);
    
    // Add comments container
    const commentsContainer = document.createElement('div');
    commentsContainer.className = 'comments-container';
    commentsSection.appendChild(commentsContainer);
  } else {
    // Update comment counter
    const commentCounter = commentsSection.querySelector('.comment-counter');
    if (commentCounter) {
      const currentCount = parseInt(commentCounter.textContent.match(/\d+/)[0]) || 0;
      commentCounter.textContent = `${currentCount + 1} Comment${currentCount + 1 !== 1 ? 's' : ''}`;
    }
  }
  
  const commentsContainer = commentsSection.querySelector('.comments-container');
  if (commentsContainer) {
    const commentElement = createCommentElement(comment, postId);
    commentsContainer.appendChild(commentElement);
    
    // Update comment count on post
    updateCommentCount(postId);
  }
}

function appendReply(postId, parentCommentId, reply) {
  const parentComment = document.querySelector(`.comment[data-comment-id="${parentCommentId}"]`);
  if (parentComment) {
    // Check if replies container exists
    let repliesContainer = parentComment.querySelector('.replies');
    
    if (!repliesContainer) {
      // Create replies container and connector
      repliesContainer = document.createElement('div');
      repliesContainer.className = 'replies';
      
      const replyConnector = document.createElement('div');
      replyConnector.className = 'reply-connector';
      parentComment.appendChild(replyConnector);
      parentComment.appendChild(repliesContainer);
    }
    
    const replyElement = createCommentElement(reply, postId, true);
    repliesContainer.appendChild(replyElement);
    
    // Update comment count on post
    updateCommentCount(postId);
  } else {
    console.error(`Parent comment not found: ${parentCommentId}`);
  }
}

function updateCommentCount(postId) {
  const commentButtons = document.querySelectorAll(`.comment-button[data-post-id="${postId}"]`);
  
  commentButtons.forEach(button => {
    const currentCountMatch = button.textContent.match(/\d+/);
    const currentCount = currentCountMatch ? parseInt(currentCountMatch[0]) : 0;
    button.innerHTML = `<i class="fas fa-comment"></i> Comment (${currentCount + 1})`;
  });
}

// Add the missing updateLoadMoreButton function
function updateLoadMoreButton() {
  const loadMoreButton = document.getElementById("loadMoreButton");
  
  if (loadMoreButton) {
    loadMoreButton.style.display = currentPage < totalPages ? "block" : "none";
  }
}

// Add missing loadMorePosts function
async function loadMorePosts() {
  if (isLoadingMore || currentPage >= totalPages) return;

  isLoadingMore = true;
  const loadMoreButton = document.getElementById("loadMoreButton");
  loadMoreButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  loadMoreButton.disabled = true;

  try {
    await fetchAndDisplayPosts(currentPage + 1, true);
  } catch (error) {
    console.error("Error loading more posts:", error);
    showNotification("Failed to load more posts. Please try again.");
  } finally {
    loadMoreButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
    loadMoreButton.disabled = false;
    isLoadingMore = false;
  }
}

// Add fetchUserFamilies function
async function fetchUserFamilies() {
  try {
    const response = await makeAuthenticatedRequest("/api/dashboard/user/families");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching user families:", error);
    return [];
  }
}

async function initializeSocialFeed(familyId = null) {
  if (familyId) {
    currentFamilyId = familyId;
  }
  setupPostForm();
  if (currentFamilyId) {
    await fetchAndDisplayPosts();
    updateLoadMoreButton();
  } else {
    console.warn("No family selected. Please select a family to view posts.");
    const socialFeedContent = document.getElementById("socialFeedContent");
    if (socialFeedContent) {
      socialFeedContent.innerHTML = "<p>Please select a family to view posts.</p>";
    }
  }
}

async function updateSocialFeed(familyId) {
  currentFamilyId = familyId;
  currentPage = 1;
  totalPages = 1;
  await fetchAndDisplayPosts();
  updateLoadMoreButton();
}

function setupPostForm() {
  const postForm = document.getElementById("postForm");
  const mediaInput = document.getElementById("mediaInput");
  const captionInput = document.getElementById("captionInput");
  const mediaPreview = document.getElementById("mediaPreview");

  if (!postForm || !mediaInput || !captionInput || !mediaPreview) {
    console.error("Post form elements not found");
    return;
  }

  // Clear existing listeners to avoid duplicates
  const newMediaInput = mediaInput.cloneNode(true);
  mediaInput.parentNode.replaceChild(newMediaInput, mediaInput);
  
  newMediaInput.addEventListener("change", (event) => {
    handleFileSelection(event.target.files);
  });

  captionInput.addEventListener("input", handleCaptionInput);

  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitPost();
  });
}

// New function to handle multiple files
function handleFileSelection(files) {
  const mediaPreview = document.getElementById("mediaPreview");
  
  if (!files || files.length === 0) return;
  
  // Clear previous previews
  mediaPreview.innerHTML = '';
  
  // Create a container for multiple previews
  const previewContainer = document.createElement("div");
  previewContainer.className = "media-preview-container";
  
  // Process multiple files (up to 4)
  for (let i = 0; i < Math.min(files.length, 4); i++) {
    const file = files[i];
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const previewElement = document.createElement(file.type.startsWith("image/") ? "img" : "video");
      previewElement.src = e.target.result;
      previewElement.className = "media-preview-item";
      
      if (previewElement.tagName === "VIDEO") {
        previewElement.setAttribute("controls", "");
      }
      
      const previewWrapper = document.createElement("div");
      previewWrapper.className = "media-preview-wrapper";
      previewWrapper.appendChild(previewElement);
      
      // Add a remove button
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-media-btn";
      removeBtn.innerHTML = "×";
      removeBtn.onclick = function(e) {
        e.preventDefault();
        previewWrapper.remove();
        // If all previews are removed, clear the DataTransfer object
        if (mediaPreview.querySelectorAll('.media-preview-wrapper').length === 0) {
          document.getElementById("mediaInput").value = "";
        }
      };
      
      previewWrapper.appendChild(removeBtn);
      previewContainer.appendChild(previewWrapper);
    };
    
    reader.readAsDataURL(file);
  }
  
  mediaPreview.appendChild(previewContainer);
}

function handleCaptionInput(event) {
  const captionInput = event.target;
  const mediaPreview = document.getElementById("mediaPreview");
  const urls = extractUrls(captionInput.value);

  const existingMediaPreview = mediaPreview.querySelector('.media-preview-item');
  const existingLinkPreview = mediaPreview.querySelector('.link-preview');
  
  if (urls.length > 0 && !existingMediaPreview && !existingLinkPreview) {
    fetchLinkPreview(urls[0]);
  } else if (urls.length === 0 && !existingMediaPreview && existingLinkPreview) {
    mediaPreview.innerHTML = "";
  }
}

async function fetchLinkPreview(url) {
  try {
    const response = await makeAuthenticatedRequest(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch link preview");
    }
    const preview = await response.json();
    displayLinkPreview(preview, url);
  } catch (error) {
    console.error("Error fetching link preview:", error);
  }
}

function displayLinkPreview(preview, url) {
  const mediaPreview = document.getElementById("mediaPreview");
  const existingMediaPreview = mediaPreview.querySelector('.media-preview-item');
  const existingLinkPreview = mediaPreview.querySelector('.link-preview');
  
  if (!existingMediaPreview && !existingLinkPreview) {
    if (isYouTubeLink(url)) {
      // Extract video ID
      const videoId = getYouTubeVideoId(url);
      mediaPreview.innerHTML = `
        <div class="link-preview youtube-preview">
          <div class="youtube-embed">
            <iframe width="100%" height="215" src="https://www.youtube.com/embed/${videoId}" 
              frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen></iframe>
          </div>
          <div class="link-info">
            <h3>${preview.title || 'YouTube Video'}</h3>
            <p>${preview.description || 'Click to watch on YouTube'}</p>
          </div>
          <button class="remove-media-btn">×</button>
        </div>
      `;
    } else if (isTwitterLink(url)) {
      mediaPreview.innerHTML = `
        <div class="link-preview twitter-preview">
          <div class="twitter-embed">
            ${preview.html || '<p>Twitter Post</p>'}
          </div>
          <button class="remove-media-btn">×</button>
        </div>
      `;
      // Removed the loadTwitterWidget() call here since we need to define it first
    } else {
      mediaPreview.innerHTML = `
        <div class="link-preview">
          ${preview.image ? `<img src="${preview.image}" alt="Link preview image">` : ''}
          <div class="link-info">
            <h3>${preview.title || 'Link'}</h3>
            <p>${preview.description || 'Visit for more information'}</p>
            <span class="link-url">${url}</span>
          </div>
          <button class="remove-media-btn">×</button>
        </div>
      `;
    }
    
    // Add event listener to remove button
    const removeBtn = mediaPreview.querySelector('.remove-media-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        mediaPreview.innerHTML = '';
      });
    }
  }
}

function isYouTubeLink(url) {
  return /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(url);
}

function isTwitterLink(url) {
  return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//.test(url);
}

function getYouTubeVideoId(url) {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text ? (text.match(urlRegex) || []) : [];
}

// Add the missing loadTwitterWidget function
function loadTwitterWidget() {
  // Check if the Twitter widget script is already loaded
  if (window.twttr) {
    window.twttr.widgets.load();
  } else {
    // Load the Twitter widget script
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.charset = 'utf-8';
    script.async = true;
    document.body.appendChild(script);
  }
}

async function submitPost() {
  const caption = document.getElementById("captionInput").value;
  const mediaInput = document.getElementById("mediaInput");
  const mediaFiles = mediaInput.files;
  const mediaPreview = document.getElementById("mediaPreview");
  const linkPreview = mediaPreview.querySelector('.link-preview');
  const postForm = document.getElementById("postForm");

  if (!caption && !mediaFiles.length && !linkPreview) {
    alert("Please enter a caption or select media files.");
    return;
  }

  if (!currentFamilyId) {
    alert("No family selected. Please select a family before posting.");
    return;
  }

  // Show loading state
  const submitButton = postForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.innerHTML;
  submitButton.disabled = true;
  submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Posting...`;

  try {
    const formData = new FormData();
    formData.append("caption", caption);
    formData.append("familyId", currentFamilyId);
    
    // Add multiple files
    for (let i = 0; i < mediaFiles.length; i++) {
      formData.append("media", mediaFiles[i]);
    }

    const response = await makeAuthenticatedRequest(`/api/family/${currentFamilyId}/posts`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to create post");
    }

    // Clear the form
    document.getElementById("postForm").reset();
    document.getElementById("mediaPreview").innerHTML = "";
    
    // Refresh the feed
    await fetchAndDisplayPosts();

    // Close the post form on mobile
    if (window.innerWidth <= 768) {
      closePostForm();
    }

    // Show success message
    showNotification("Post created successfully!");

  } catch (error) {
    console.error("Error creating post:", error);
    alert("Failed to create post. Please try again.");
  } finally {
    // Reset button state
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonText;
  }
}

// Simple notification function
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

function closePostForm() {
  const postForm = document.getElementById("postForm");
  const overlay = document.getElementById("overlay");
  
  if (postForm) {
    postForm.classList.remove("open");
  }
  
  if (overlay) {
    overlay.classList.remove("active");
  }
}

async function fetchAndDisplayPosts(page = 1, append = false) {
  try {
    if (!currentFamilyId) {
      console.warn("No family selected");
      return;
    }

    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading posts...';
    
    const socialFeedContent = document.getElementById("socialFeedContent");
    if (!append) {
      socialFeedContent.innerHTML = '';
      socialFeedContent.appendChild(loadingIndicator);
    } else {
      const loadMoreButton = document.getElementById("loadMoreButton");
      if (loadMoreButton) {
        loadMoreButton.disabled = true;
        loadMoreButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      }
    }

    const response = await makeAuthenticatedRequest(`/api/family/${currentFamilyId}/posts?page=${page}`);

    if (!response.ok) {
      throw new Error("Failed to fetch posts");
    }

    const data = await response.json();

    // Remove loading indicator
    const indicator = document.querySelector('.loading-indicator');
    if (indicator) {
      indicator.remove();
    }

    if (Array.isArray(data.posts)) {
      currentPage = data.currentPage;
      totalPages = data.totalPages;

      if (append) {
        appendPosts(data.posts);
      } else {
        displayPosts(data.posts);
      }

      updateLoadMoreButton();
    } else {
      console.error("Invalid posts data:", data);
      throw new Error("Invalid posts data received from the server");
    }
  } catch (error) {
    console.error("Error fetching posts:", error);
    const socialFeedContent = document.getElementById("socialFeedContent");
    socialFeedContent.innerHTML = `<p>Error loading posts. Please try again later.</p>`;
  }
}

function displayPosts(posts) {
  const socialFeedContent = document.getElementById("socialFeedContent");
  socialFeedContent.innerHTML = "";

  if (posts.length === 0) {
    socialFeedContent.innerHTML = `
      <div class="empty-feed">
        <i class="fas fa-comment-slash"></i>
        <h3>No posts yet</h3>
        <p>Be the first to share something with your family!</p>
      </div>
    `;
    return;
  }

  posts.forEach((post) => {
    const postElement = createPostElement(post);
    socialFeedContent.appendChild(postElement);
  });

  loadTwitterWidget();

  // Add load more button
  const loadMoreContainer = document.createElement('div');
  loadMoreContainer.className = 'load-more-container';
  
  const loadMoreButton = document.createElement('button');
  loadMoreButton.id = 'loadMoreButton';
  loadMoreButton.className = 'load-more-button';
  loadMoreButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
  loadMoreButton.style.display = currentPage < totalPages ? 'block' : 'none';
  loadMoreButton.addEventListener('click', loadMorePosts);
  
  loadMoreContainer.appendChild(loadMoreButton);
  socialFeedContent.appendChild(loadMoreContainer);
}

function appendPosts(posts) {
  const socialFeedContent = document.getElementById("socialFeedContent");
  const loadMoreContainer = document.querySelector('.load-more-container');

  posts.forEach((post) => {
    const postElement = createPostElement(post);
    if (loadMoreContainer) {
      socialFeedContent.insertBefore(postElement, loadMoreContainer);
    } else {
      socialFeedContent.appendChild(postElement);
    }
  });

  loadTwitterWidget();
}

function createPostElement(post) {
  const postElement = document.createElement("div");
  postElement.className = "social-post";
  postElement.dataset.postId = post.post_id;

  // Process caption to format links
  let captionContent = post.caption || '';
  
  // Check for link preview
  let linkPreviewContent = '';
  
  if (post.link_preview) {
    if (post.link_preview.type === 'twitter') {
      linkPreviewContent = `
        <div class="twitter-embed">
          ${post.link_preview.html}
        </div>
      `;
      // Remove Twitter URL from caption
      if (post.link_preview.url) {
        captionContent = captionContent.replace(post.link_preview.url, "");
      }
    } else if (post.link_preview.url && isYouTubeLink(post.link_preview.url)) {
      const videoId = getYouTubeVideoId(post.link_preview.url);
      linkPreviewContent = `
        <div class="youtube-embed">
          <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" 
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>
        </div>
      `;
      // Remove YouTube URL from caption
      captionContent = captionContent.replace(post.link_preview.url, "");
    } else {
      linkPreviewContent = `
        <a href="${post.link_preview.url}" target="_blank" rel="noopener noreferrer" class="link-preview-wrapper">
          <div class="link-preview">
            ${post.link_preview.image ? `<img src="${post.link_preview.image}" alt="Link preview image">` : ''}
            <div class="link-info">
              <h3>${post.link_preview.title || 'Link'}</h3>
              <p>${post.link_preview.description || ''}</p>
            </div>
          </div>
        </a>
      `;
      // Remove link URL from caption
      if (post.link_preview.url) {
        captionContent = captionContent.replace(post.link_preview.url, "");
      }
    }
  }

  // Generate media content
  let mediaContent = '';
  
  if (post.media_urls && post.media_urls.length > 0) {
    // Multiple media items
    if (post.media_urls.length === 1) {
      // Single media item
      const mediaUrl = post.media_urls[0];
      if (post.media_type === "image") {
        mediaContent = `<img src="${mediaUrl}" alt="Post image" class="post-media">`;
      } else if (post.media_type === "video") {
        mediaContent = `<video controls class="post-media"><source src="${mediaUrl}" type="video/mp4"></video>`;
      }
    } else {
      // Multiple media items - create a carousel/grid
      mediaContent = `<div class="media-grid media-count-${Math.min(post.media_urls.length, 4)}">`;
      
      post.media_urls.forEach((mediaUrl, index) => {
        if (index < 4) { // limit to 4 items
          if (post.media_type === "image") {
            mediaContent += `
              <div class="media-grid-item" data-index="${index}">
                <img src="${mediaUrl}" alt="Post image ${index + 1}" loading="lazy">
              </div>`;
          } else if (post.media_type === "video") {
            mediaContent += `
              <div class="media-grid-item" data-index="${index}">
                <video><source src="${mediaUrl}" type="video/mp4"></video>
                <div class="video-play-button"><i class="fas fa-play"></i></div>
              </div>`;
          }
        }
      });
      
      if (post.media_urls.length > 4) {
        mediaContent += `
          <div class="media-grid-item media-more-indicator">
            <span>+${post.media_urls.length - 4}</span>
          </div>`;
      }
      
      mediaContent += `</div>`;
    }
  }

  // Create the post HTML
  postElement.innerHTML = `
    <div class="post-header">
      <span class="post-author">${post.author_name}</span>
      <span class="post-date">${formatTimeAgo(new Date(post.created_at))}</span>
    </div>
    <div class="post-content">
      <p>${formatCaption(captionContent)}</p>
      <div class="media-container">
        ${mediaContent}
        ${linkPreviewContent}
      </div>
    </div>
    <div class="post-actions">
      <button class="like-button ${post.is_liked ? 'liked' : ''}" data-post-id="${post.post_id}">
        <i class="fas fa-heart"></i> Like (${post.likes_count || 0})
      </button>
      <button class="comment-button" data-post-id="${post.post_id}">
        <i class="fas fa-comment"></i> Comment (${post.comments_count || 0})
      </button>
      ${post.is_owner ? `
        <button class="delete-button" data-post-id="${post.post_id}">
          <i class="fas fa-trash"></i> Delete
        </button>
      ` : ''}
    </div>
    <div class="comments-section" id="comments-${post.post_id}" style="display: none;"></div>
    <form class="comment-form" data-post-id="${post.post_id}">
      <input type="text" placeholder="Write a comment..." required>
      <button type="submit"><i class="fas fa-paper-plane"></i></button>
    </form>
  `;

  // Add event listeners
  setupPostEventListeners(postElement, post);

  return postElement;
}

function setupPostEventListeners(postElement, post) {
  const likeButton = postElement.querySelector(".like-button");
  likeButton.addEventListener("click", () => toggleLike(post.post_id, likeButton));

  const commentButton = postElement.querySelector(".comment-button");
  commentButton.addEventListener("click", () => toggleComments(post.post_id));

  const commentForm = postElement.querySelector(".comment-form");
  commentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const commentText = commentForm.querySelector("input").value;
    addComment(post.post_id, commentText);
    commentForm.reset();
  });

  const deleteButton = postElement.querySelector(".delete-button");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => deletePost(post.post_id));
  }

  // Set up media grid item click events
  const mediaGridItems = postElement.querySelectorAll('.media-grid-item:not(.media-more-indicator)');
  mediaGridItems.forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      openMediaGallery(post, index);
    });
  });

  // Video play button
  const videoPlayButtons = postElement.querySelectorAll('.video-play-button');
  videoPlayButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const mediaItem = button.closest('.media-grid-item');
      const video = mediaItem.querySelector('video');
      if (video) {
        if (video.paused) {
          video.setAttribute('controls', '');
          video.play();
          button.style.display = 'none';
        } else {
          video.pause();
          button.style.display = 'flex';
        }
      }
    });
  });

  // Set up click event for YouTube embeds (they should open in full screen)
  const youtubeEmbed = postElement.querySelector('.youtube-embed');
  if (youtubeEmbed) {
    youtubeEmbed.addEventListener('click', () => {
      const iframe = youtubeEmbed.querySelector('iframe');
      if (iframe && iframe.src) {
        openYouTubeModal(iframe.src);
      }
    });
  }
}

function formatCaption(caption) {
  // Convert URLs to clickable links
  return caption.replace(
    /(https?:\/\/[^\s]+)/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {
    return interval === 1 ? '1 year ago' : interval + ' years ago';
  }
  
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) {
    return interval === 1 ? '1 month ago' : interval + ' months ago';
  }
  
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) {
    return interval === 1 ? '1 day ago' : interval + ' days ago';
  }
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) {
    return interval === 1 ? '1 hour ago' : interval + ' hours ago';
  }
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) {
    return interval === 1 ? '1 minute ago' : interval + ' minutes ago';
  }
  
  return 'Just now';
}

// Missing function openYouTubeModal
function openYouTubeModal(embedSrc) {
  // Create YouTube modal if it doesn't exist
  let youtubeModal = document.getElementById('youtube-modal');
  if (!youtubeModal) {
    youtubeModal = document.createElement('div');
    youtubeModal.id = 'youtube-modal';
    youtubeModal.className = 'modal youtube-modal';
    youtubeModal.innerHTML = `
      <div class="modal-content youtube-modal-content">
        <span class="close">&times;</span>
        <div class="youtube-container">
          <iframe width="100%" height="100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>
    `;
    document.body.appendChild(youtubeModal);
    
    // Set up close button
    youtubeModal.querySelector('.close').addEventListener('click', () => {
      youtubeModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      // Reset iframe src to stop video
      youtubeModal.querySelector('iframe').src = '';
    });
    
    // Close on click outside
    youtubeModal.addEventListener('click', (e) => {
      if (e.target === youtubeModal) {
        youtubeModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        // Reset iframe src to stop video
        youtubeModal.querySelector('iframe').src = '';
      }
    });
  }
  
  // Set iframe src
  youtubeModal.querySelector('iframe').src = embedSrc;
  
  // Show modal
  youtubeModal.style.display = 'flex';
  document.body.classList.add('modal-open');
}

function openMediaGallery(post, startIndex = 0) {
  if (!post.media_urls || post.media_urls.length === 0) return;
  
  // Create modal if it doesn't exist
  let galleryModal = document.getElementById('media-gallery-modal');
  if (!galleryModal) {
    galleryModal = document.createElement('div');
    galleryModal.id = 'media-gallery-modal';
    galleryModal.className = 'modal media-gallery-modal';
    galleryModal.innerHTML = `
      <div class="modal-content gallery-modal-content">
        <span class="close">&times;</span>
        <div class="gallery-container">
          <div class="gallery-main"></div>
          <div class="gallery-caption">
            <div class="gallery-author"></div>
            <div class="gallery-text"></div>
          </div>
          <div class="gallery-thumbnails"></div>
        </div>
        <button class="gallery-nav prev"><i class="fas fa-chevron-left"></i></button>
        <button class="gallery-nav next"><i class="fas fa-chevron-right"></i></button>
      </div>
    `;
    document.body.appendChild(galleryModal);
    
    // Set up close button
    galleryModal.querySelector('.close').addEventListener('click', () => {
      galleryModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      
      // Pause any playing videos
      const videos = galleryModal.querySelectorAll('video');
      videos.forEach(video => {
        video.pause();
      });
    });
    
    // Close on click outside
    galleryModal.addEventListener('click', (e) => {
      if (e.target === galleryModal) {
        galleryModal.style.display = 'none';
        document.body.classList.remove('modal-open');
      }
    });
  }
  
  // Populate the gallery
  const galleryMain = galleryModal.querySelector('.gallery-main');
  const galleryThumbnails = galleryModal.querySelector('.gallery-thumbnails');
  const galleryCaption = galleryModal.querySelector('.gallery-text');
  const galleryAuthor = galleryModal.querySelector('.gallery-author');
  
  galleryMain.innerHTML = '';
  galleryThumbnails.innerHTML = '';
  galleryCaption.textContent = post.caption || '';
  galleryAuthor.textContent = post.author_name;
  
  // Add all media items to the gallery
  post.media_urls.forEach((mediaUrl, index) => {
    // Main view
    const mediaItem = document.createElement('div');
    mediaItem.className = `gallery-item ${index === startIndex ? 'active' : ''}`;
    
    if (post.media_type === "image") {
      mediaItem.innerHTML = `<img src="${mediaUrl}" alt="Gallery image ${index + 1}">`;
    } else if (post.media_type === "video") {
      mediaItem.innerHTML = `<video controls><source src="${mediaUrl}" type="video/mp4"></video>`;
    }
    
    galleryMain.appendChild(mediaItem);
    
    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = `gallery-thumbnail ${index === startIndex ? 'active' : ''}`;
    thumbnail.dataset.index = index;
    
    if (post.media_type === "image") {
      thumbnail.innerHTML = `<img src="${mediaUrl}" alt="Thumbnail ${index + 1}">`;
    } else if (post.media_type === "video") {
      thumbnail.innerHTML = `
        <video><source src="${mediaUrl}" type="video/mp4"></video>
        <div class="video-indicator"><i class="fas fa-play"></i></div>
      `;
    }
    
    thumbnail.addEventListener('click', () => {
      switchGalleryItem(index);
    });
    
    galleryThumbnails.appendChild(thumbnail);
  });
  
  // Set up navigation buttons
  const prevBtn = galleryModal.querySelector('.prev');
  const nextBtn = galleryModal.querySelector('.next');
  
  prevBtn.onclick = () => {
    const currentIndex = parseInt(galleryModal.querySelector('.gallery-thumbnail.active').dataset.index);
    switchGalleryItem((currentIndex - 1 + post.media_urls.length) % post.media_urls.length);
  };
  
  nextBtn.onclick = () => {
    const currentIndex = parseInt(galleryModal.querySelector('.gallery-thumbnail.active').dataset.index);
    switchGalleryItem((currentIndex + 1) % post.media_urls.length);
  };
  
  // Function to switch between gallery items
  function switchGalleryItem(index) {
    // Pause any playing videos
    const videos = galleryMain.querySelectorAll('video');
    videos.forEach(video => {
      video.pause();
    });
    
    // Update active classes
    galleryModal.querySelectorAll('.gallery-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
    
    galleryModal.querySelectorAll('.gallery-thumbnail').forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });
    
    // Play the video if it's a video item
    const newActiveItem = galleryModal.querySelector('.gallery-item.active');
    const video = newActiveItem.querySelector('video');
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {
        // Silent catch for autoplay restrictions
      });
    }
  }
  
  // Show the modal
  galleryModal.style.display = 'flex';
  document.body.classList.add('modal-open');
  
  // Start at the selected index
  switchGalleryItem(startIndex);
  
  // Enable keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      prevBtn.click();
    } else if (e.key === 'ArrowRight') {
      nextBtn.click();
    } else if (e.key === 'Escape') {
      galleryModal.querySelector('.close').click();
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Remove event listener when modal is closed
  galleryModal.addEventListener('close', () => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}

// Add the missing toggleLike function
function toggleLike(postId, likeButton) {
  likeButton.disabled = true;
  
  makeAuthenticatedRequest(`/api/posts/${postId}/like`, {
    method: "POST",
  })
  .then(response => {
    if (!response.ok) {
      throw new Error("Failed to toggle like");
    }
    return response.json();
  })
  .then(data => {
    likeButton.innerHTML = `<i class="fas fa-heart"></i> Like (${data.likes_count})`;
    
    // Toggle the liked class
    if (data.action === 'liked') {
      likeButton.classList.add('liked');
    } else {
      likeButton.classList.remove('liked');
    }
  })
  .catch(error => {
    console.error("Error toggling like:", error);
    showNotification("Failed to like post. Please try again.");
  })
  .finally(() => {
    likeButton.disabled = false;
  });
}

// Add the missing deletePost function
function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) {
    return;
  }
  
  const postElement = document.querySelector(`.social-post[data-post-id="${postId}"]`);
  if (postElement) {
    // Add deleting state
    postElement.classList.add('deleting');
    postElement.innerHTML = `
      <div class="deleting-message">
        <i class="fas fa-spinner fa-spin"></i> Deleting post...
      </div>
    `;
  }

  makeAuthenticatedRequest(`/api/posts/${postId}`, {
    method: "DELETE",
  })
  .then(response => {
    if (!response.ok) {
      throw new Error("Failed to delete post");
    }
    
    if (postElement) {
      // Add deleted class for animation
      postElement.classList.add('deleted');
      
      // Remove the post after animation
      setTimeout(() => {
        postElement.remove();
        
        // Show empty feed message if no posts remain
        const socialFeedContent = document.getElementById("socialFeedContent");
        if (socialFeedContent.querySelectorAll('.social-post:not(.deleted)').length === 0) {
          socialFeedContent.innerHTML = `
            <div class="empty-feed">
              <i class="fas fa-comment-slash"></i>
              <h3>No posts yet</h3>
              <p>Be the first to share something with your family!</p>
            </div>
          `;
        }
        
        showNotification("Post deleted successfully");
      }, 300);
    }
  })
  .catch(error => {
    console.error("Error deleting post:", error);
    
    if (postElement) {
      // Restore the post element on error
      postElement.classList.remove('deleting');
      fetchAndDisplayPosts();
    }
    
    showNotification("Failed to delete post. Please try again.");
  });
}

// Add the missing toggleComments function
function toggleComments(postId) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  
  if (commentsSection.style.display === "none") {
    // Show loading indicator
    commentsSection.style.display = "block";
    commentsSection.innerHTML = '<div class="comments-loading"><i class="fas fa-spinner fa-spin"></i> Loading comments...</div>';
    
    fetchComments(postId)
      .then(comments => {
        displayComments(`comments-${postId}`, comments);
      })
      .catch(error => {
        console.error("Error loading comments:", error);
        commentsSection.innerHTML = '<p class="comments-error">Failed to load comments. Please try again.</p>';
      });
  } else {
    commentsSection.style.display = "none";
  }
}

// Add the missing fetchComments function
async function fetchComments(postId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}/comments`);
    if (!response.ok) {
      throw new Error("Failed to fetch comments");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
}

// Add the missing displayComments function
function displayComments(commentsContainerId, comments) {
  const commentsSection = document.getElementById(commentsContainerId);
  commentsSection.innerHTML = "";

  if (comments.length === 0) {
    commentsSection.innerHTML = `
      <div class="empty-comments">
        <p>No comments yet. Be the first to comment!</p>
      </div>
    `;
    return;
  }

  // Sort comments by date
  comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Create a map of comments and their replies
  const commentMap = new Map();
  comments.forEach((comment) =>
    commentMap.set(comment.comment_id, { ...comment, replies: [] })
  );

  // Organize comments into a hierarchy
  const topLevelComments = [];
  comments.forEach((comment) => {
    if (comment.parent_comment_id) {
      const parentComment = commentMap.get(comment.parent_comment_id);
      if (parentComment) {
        parentComment.replies.push(commentMap.get(comment.comment_id));
      }
    } else {
      topLevelComments.push(commentMap.get(comment.comment_id));
    }
  });

  // Create comment counter
  const commentCounter = document.createElement('div');
  commentCounter.className = 'comment-counter';
  commentCounter.textContent = `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`;
  commentsSection.appendChild(commentCounter);

  // Create comments container
  const commentsContainer = document.createElement('div');
  commentsContainer.className = 'comments-container';
  
  // Add each top level comment and its replies
  topLevelComments.forEach((comment) => {
    const commentElement = createCommentElement(comment, commentsContainerId.split('-')[1]);
    commentsContainer.appendChild(commentElement);
  });
  
  commentsSection.appendChild(commentsContainer);
}

// Add the missing createCommentElement function
function createCommentElement(comment, postId, isReply = false) {
  const element = document.createElement("div");
  element.className = isReply ? "reply" : "comment";
  element.dataset.commentId = comment.comment_id;

  // Create avatar with first letter of user's name
  const avatarLetter = comment.author_name ? comment.author_name.charAt(0).toUpperCase() : "?";
  
  element.innerHTML = `
    <div class="comment-header">
      <div class="comment-avatar">${avatarLetter}</div>
      <div class="comment-author-info">
        <span class="comment-author">${comment.author_name}</span>
        <span class="comment-date">${formatTimeAgo(new Date(comment.created_at))}</span>
      </div>
    </div>
    <div class="comment-content">
      <span class="comment-text">${formatCommentText(comment.text)}</span>
    </div>
    <div class="comment-actions">
      <button class="reply-button" id="replyButton-${comment.comment_id}">
        <i class="fas fa-reply"></i> Reply
      </button>
      <button class="like-comment-button" id="likeComment-${comment.comment_id}">
        <i class="far fa-heart"></i> Like
      </button>
    </div>
    <div class="reply-form" id="replyForm-${comment.comment_id}" style="display: none;">
      <input type="text" placeholder="Write a reply..." required>
      <button type="submit" class="post-reply-button" id="postReply-${comment.comment_id}">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;

  // Set up reply functionality
  const replyButton = element.querySelector(`#replyButton-${comment.comment_id}`);
  const replyForm = element.querySelector(`#replyForm-${comment.comment_id}`);
  const postReplyButton = element.querySelector(`#postReply-${comment.comment_id}`);
  const likeCommentButton = element.querySelector(`#likeComment-${comment.comment_id}`);

  replyButton.addEventListener("click", () => {
    // Close any other open reply forms first
    document.querySelectorAll('.reply-form').forEach(form => {
      if (form.id !== `replyForm-${comment.comment_id}` && form.style.display !== 'none') {
        form.style.display = 'none';
      }
    });
    
    // Toggle this reply form
    replyForm.style.display = replyForm.style.display === 'none' ? 'flex' : 'none';
    
    // Focus the input if showing
    if (replyForm.style.display !== 'none') {
      replyForm.querySelector('input').focus();
    }
  });

  postReplyButton.addEventListener("click", (e) => {
    e.preventDefault();
    const replyText = replyForm.querySelector("input").value;
    
    if (replyText.trim() === '') {
      return;
    }
    
    addComment(postId, replyText, comment.comment_id);
    replyForm.querySelector("input").value = "";
    replyForm.style.display = "none";
  });
  
  // Let users submit reply with Enter key
  replyForm.querySelector('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      postReplyButton.click();
    }
  });
  
  // Like comment functionality
  likeCommentButton.addEventListener('click', () => {
    if (likeCommentButton.classList.contains('liked')) {
      likeCommentButton.classList.remove('liked');
      likeCommentButton.innerHTML = '<i class="far fa-heart"></i> Like';
    } else {
      likeCommentButton.classList.add('liked');
      likeCommentButton.innerHTML = '<i class="fas fa-heart"></i> Liked';
    }
  });

  // Render replies recursively if there are any
  if (comment.replies && comment.replies.length > 0) {
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "replies";
    
    // Add a vertical line to connect replies visually
    const replyConnector = document.createElement("div");
    replyConnector.className = "reply-connector";
    element.appendChild(replyConnector);
    
    comment.replies.forEach((reply) => {
      const replyElement = createCommentElement(reply, postId, true);
      repliesContainer.appendChild(replyElement);
    });
    
    element.appendChild(repliesContainer);
  }

  return element;
}

// Add missing formatCommentText function
function formatCommentText(text) {
  if (!text) return '';
  
  // Convert URLs to clickable links
  const formattedText = text.replace(
    /(https?:\/\/[^\s]+)/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  
  return formattedText;
}

// Add the missing addComment function
async function addComment(postId, commentText, parentCommentId = null) {
  const commentForm = document.querySelector(`.comment-form[data-post-id="${postId}"]`);
  const submitButton = commentForm.querySelector('button');
  const originalButtonHtml = submitButton.innerHTML;
  
  // Disable the form and show loading state
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  
  try {
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: commentText,
        parentCommentId: parentCommentId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to add comment");
    }

    const newComment = await response.json();

    if (parentCommentId) {
      appendReply(postId, parentCommentId, newComment);
    } else {
      appendComment(postId, newComment);
    }
    
    // Show success indicator briefly
    submitButton.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      submitButton.innerHTML = originalButtonHtml;
      submitButton.disabled = false;
    }, 1000);
  } catch (error) {
    console.error("Error adding comment/reply:", error);
    submitButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    
    // Show error notification
    showNotification("Failed to add comment. Please try again.");
    
    setTimeout(() => {
      submitButton.innerHTML = originalButtonHtml;
      submitButton.disabled = false;
    }, 2000);
  }
}