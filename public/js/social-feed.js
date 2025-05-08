// Social Feed Functionality
document.addEventListener('DOMContentLoaded', () => {
  // Initialize post creation functionality
  initializePostCreation();
  
  // Initialize post modals
  initializePostModals();
  
  // Set up filter buttons
  setupFilterButtons();
  
  // Listen for family change events
  document.addEventListener('familyChanged', (event) => {
      const familyId = event.detail.familyId;
      loadPosts(familyId);
  });
  
  // Initial load with current family
  const currentFamilyId = localStorage.getItem(CONFIG.FAMILY_KEY);
  if (currentFamilyId) {
      loadPosts(currentFamilyId);
  }
});

// Initialize post creation functionality
function initializePostCreation() {
  const postInput = document.getElementById('post-input');
  const postComposer = document.getElementById('post-composer');
  const postText = document.getElementById('post-text');
  const fileUpload = document.getElementById('file-upload');
  const mediaPreview = document.getElementById('media-preview');
  const submitPostBtn = document.getElementById('submit-post');
  const cancelPostBtn = document.getElementById('cancel-post');
  
  if (!postInput || !postComposer || !postText || !submitPostBtn || !cancelPostBtn) return;
  
  // Show composer when clicking on input
  postInput.addEventListener('click', () => {
      postInput.classList.add('hidden');
      postComposer.classList.remove('hidden');
      postText.focus();
  });
  
  // Cancel post
  cancelPostBtn.addEventListener('click', () => {
      postComposer.classList.add('hidden');
      postInput.classList.remove('hidden');
      postText.value = '';
      mediaPreview.innerHTML = '';
      submitPostBtn.disabled = true;
  });
  
  // Enable/disable submit button based on content
  postText.addEventListener('input', () => {
      submitPostBtn.disabled = postText.value.trim() === '' && mediaPreview.children.length === 0;
  });
  
  // Handle file upload
  if (fileUpload) {
      fileUpload.addEventListener('change', () => {
          handleFileSelection(fileUpload.files);
      });
  }
  
  // Handle post submission
  submitPostBtn.addEventListener('click', () => {
      createPost();
  });
}

// Handle file selection for post creation
function handleFileSelection(files) {
  const mediaPreview = document.getElementById('media-preview');
  const submitPostBtn = document.getElementById('submit-post');
  
  if (!mediaPreview) return;
  
  // Limit number of files
  const maxFiles = CONFIG.MEDIA.MAX_UPLOAD_COUNT;
  const currentFiles = mediaPreview.children.length;
  const allowedFiles = Math.min(files.length, maxFiles - currentFiles);
  
  if (allowedFiles <= 0) {
      alert(`You can only upload a maximum of ${maxFiles} files.`);
      return;
  }
  
  // Process selected files
  for (let i = 0; i < allowedFiles; i++) {
      const file = files[i];
      
      // Check file type
      if (!isFileTypeAllowed(file.type)) {
          alert(`File type ${file.type} is not allowed.`);
          continue;
      }
      
      // Check file size
      if (file.size > CONFIG.MEDIA.MAX_FILE_SIZE) {
          alert(`File ${file.name} exceeds the maximum file size of ${CONFIG.MEDIA.MAX_FILE_SIZE / (1024 * 1024)}MB.`);
          continue;
      }
      
      // Create preview
      const mediaItem = document.createElement('div');
      mediaItem.className = 'media-item';
      mediaItem.dataset.tempId = generateTempId();
      mediaItem.dataset.file = file.name;
      
      // Create remove button
      const removeBtn = document.createElement('div');
      removeBtn.className = 'remove-media';
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          mediaItem.remove();
          
          // Disable submit button if no content
          const postText = document.getElementById('post-text');
          if (postText && postText.value.trim() === '' && mediaPreview.children.length === 0) {
              submitPostBtn.disabled = true;
          }
      });
      
      // Create preview based on file type
      if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.file = file;
          
          // Read file as data URL
          const reader = new FileReader();
          reader.onload = (e) => {
              img.src = e.target.result;
          };
          reader.readAsDataURL(file);
          
          mediaItem.appendChild(img);
      } else if (file.type.startsWith('video/')) {
          const video = document.createElement('video');
          video.controls = true;
          video.file = file;
          
          // Read file as data URL
          const reader = new FileReader();
          reader.onload = (e) => {
              video.src = e.target.result;
          };
          reader.readAsDataURL(file);
          
          mediaItem.appendChild(video);
      }
      
      mediaItem.appendChild(removeBtn);
      mediaPreview.appendChild(mediaItem);
  }
  
  // Enable submit button if there are files
  if (mediaPreview.children.length > 0) {
      submitPostBtn.disabled = false;
  }
}

// Create a new post
async function createPost() {
  const postText = document.getElementById('post-text');
  const mediaPreview = document.getElementById('media-preview');
  const submitPostBtn = document.getElementById('submit-post');
  const cancelPostBtn = document.getElementById('cancel-post');
  
  if (!postText || !submitPostBtn || !cancelPostBtn) return;
  
  // Get current family ID
  const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
  if (!familyId) {
      alert('No family selected.');
      return;
  }
  
  // Disable buttons during submission
  submitPostBtn.disabled = true;
  cancelPostBtn.disabled = true;
  submitPostBtn.textContent = 'Posting...';
  
  // Prepare form data
  const formData = new FormData();
  formData.append('caption', postText.value.trim());
  formData.append('familyId', familyId);
  
  // Append media files
  const mediaItems = mediaPreview.querySelectorAll('.media-item');
  let mediaCount = 0;
  
  for (const item of mediaItems) {
      const mediaElement = item.querySelector('img') || item.querySelector('video');
      if (mediaElement && mediaElement.file) {
          formData.append('content', mediaElement.file);
          mediaCount++;
      }
  }
  
  try {
      // Submit the post
      const url = formatApiUrl(CONFIG.ROUTES.FEED.CREATE_POST, { familyId });
      
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`
          },
          body: formData
      });
      
      if (!response.ok) {
          throw new Error('Failed to create post');
      }
      
      const post = await response.json();
      
      // Reset form
      postText.value = '';
      mediaPreview.innerHTML = '';
      document.getElementById('post-composer').classList.add('hidden');
      document.getElementById('post-input').classList.remove('hidden');
      
      // Refresh posts to show the new one
      loadPosts(familyId);
      
      // Show success message
      showToast('Post created successfully!', 'success');
  } catch (error) {
      console.error('Error creating post:', error);
      showToast('Failed to create post. Please try again.', 'error');
  } finally {
      // Re-enable buttons
      submitPostBtn.disabled = false;
      cancelPostBtn.disabled = false;
      submitPostBtn.textContent = 'Post';
  }
}

// Load posts from server
async function loadPosts(familyId, page = 1, filter = 'all') {
  const postsContainer = document.getElementById('posts-container');
  const paginationContainer = document.getElementById('pagination');
  
  if (!postsContainer) return;
  
  // Show loading state
  postsContainer.innerHTML = `
      <div class="loading-posts">
          <div class="spinner"></div>
          <p>Loading posts...</p>
      </div>
  `;
  
  try {
      // Build URL with pagination and filter
      let url = formatApiUrl(CONFIG.ROUTES.FEED.POSTS, { familyId });
      url += `?page=${page}`;
      
      if (filter !== 'all') {
          url += `&filter=${filter}`;
      }
      
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to fetch posts');
      }
      
      const data = await response.json();
      const posts = data.posts;
      
      if (posts.length === 0) {
          postsContainer.innerHTML = `
              <div class="empty-posts">
                  <i class="fas fa-photo-film"></i>
                  <p>No posts found. Be the first to share something!</p>
              </div>
          `;
          
          if (paginationContainer) {
              paginationContainer.innerHTML = '';
          }
          
          return;
      }
      
      // Render posts
      postsContainer.innerHTML = '';
      
      posts.forEach(post => {
          const postElement = createPostElement(post);
          postsContainer.appendChild(postElement);
      });
      
      // Render pagination
      if (paginationContainer) {
          renderPagination(paginationContainer, data.currentPage, data.totalPages, familyId, filter);
      }
  } catch (error) {
      console.error('Error loading posts:', error);
      postsContainer.innerHTML = `
          <div class="error-posts">
              <i class="fas fa-exclamation-circle"></i>
              <p>Could not load posts. Please try again later.</p>
          </div>
      `;
  }
}

// Create post element
function createPostElement(post) {
  const postElement = document.createElement('div');
  postElement.className = 'post-card';
  postElement.dataset.id = post.post_id;
  
  // Format post date
  const postDate = new Date(post.created_at);
  const timeAgoStr = timeAgo(post.created_at);
  
  // Create post header
  let postHeader = `
      <div class="post-card-header">
          <div class="post-author">
              <div class="avatar">
                  <img src="${CONFIG.DEFAULT_IMAGES.AVATAR}" alt="Author">
              </div>
              <div class="post-author-info">
                  <h4>${post.author_name}</h4>
                  <span class="post-time">${timeAgoStr}</span>
              </div>
          </div>
  `;
  
  // Add options menu for post owner
  if (post.is_owner) {
      postHeader += `
          <div class="post-options">
              <button class="post-options-btn">
                  <i class="fas fa-ellipsis-h"></i>
              </button>
              <div class="post-options-menu">
                  <button class="edit-post" data-id="${post.post_id}">Edit</button>
                  <button class="delete-post" data-id="${post.post_id}">Delete</button>
              </div>
          </div>
      `;
  }
  
  postHeader += '</div>';
  
  // Create post content
  let postContent = `<div class="post-content">`;
  
  // Add post text if available
  if (post.caption) {
      postContent += `<div class="post-text">${post.caption}</div>`;
  }
  
  // Add media content if available
  if (post.media_urls && post.media_urls.length > 0) {
      if (post.media_urls.length === 1) {
          // Single media item
          const mediaUrl = post.media_urls[0];
          if (post.media_type === 'video') {
              postContent += `
                  <div class="post-media">
                      <video controls src="${mediaUrl}" preload="metadata"></video>
                  </div>
              `;
          } else {
              postContent += `
                  <div class="post-media">
                      <img src="${mediaUrl}" alt="Post image">
                  </div>
              `;
          }
      } else {
          // Multiple media items in a grid
          postContent += '<div class="post-media-grid">';
          
          post.media_urls.forEach(mediaUrl => {
              if (post.media_type === 'video') {
                  postContent += `
                      <div class="media-item">
                          <video src="${mediaUrl}" preload="metadata"></video>
                      </div>
                  `;
              } else {
                  postContent += `
                      <div class="media-item">
                          <img src="${mediaUrl}" alt="Post image">
                      </div>
                  `;
              }
          });
          
          postContent += '</div>';
      }
  }
  
  // Add link preview if available
  if (post.link_preview) {
      try {
          const linkPreview = typeof post.link_preview === 'string' 
              ? JSON.parse(post.link_preview) 
              : post.link_preview;
          
          if (linkPreview && linkPreview.url) {
              postContent += `
                  <a href="${linkPreview.url}" target="_blank" rel="noopener noreferrer" class="post-link-preview">
                      ${linkPreview.image ? `
                          <div class="post-link-preview-image">
                              <img src="${linkPreview.image}" alt="Link preview">
                          </div>
                      ` : ''}
                      <div class="post-link-preview-content">
                          <div class="post-link-preview-title">${linkPreview.title || 'Link'}</div>
                          ${linkPreview.description ? `
                              <div class="post-link-preview-description">${linkPreview.description}</div>
                          ` : ''}
                          <div class="post-link-preview-url">${linkPreview.url}</div>
                      </div>
                  </a>
              `;
          }
      } catch (error) {
          console.error('Error parsing link preview:', error);
      }
  }
  
  postContent += '</div>';
  
  // Create post stats and actions
  const likesCount = post.likes_count || 0;
  const commentsCount = post.comments_count || 0;
  
  const postStats = `
      <div class="post-stats">
          <div class="likes-count">${likesCount} ${likesCount === 1 ? 'like' : 'likes'}</div>
          <div class="comments-count">${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}</div>
      </div>
      <div class="post-actions-row">
          <button class="post-action-btn like-btn ${post.is_liked ? 'liked' : ''}" data-id="${post.post_id}">
              <i class="fas ${post.is_liked ? 'fa-heart' : 'fa-heart'}"></i> Like
          </button>
          <button class="post-action-btn comment-btn" data-id="${post.post_id}">
              <i class="fas fa-comment"></i> Comment
          </button>
          <button class="post-action-btn view-post-btn" data-id="${post.post_id}">
              <i class="fas fa-expand"></i> View
          </button>
      </div>
  `;
  
  // Combine all parts
  postElement.innerHTML = postHeader + postContent + postStats;
  
  // Add event listeners
  addPostEventListeners(postElement, post);
  
  return postElement;
}

// Add event listeners to post element
function addPostEventListeners(postElement, post) {
  // Options menu toggle
  const optionsBtn = postElement.querySelector('.post-options-btn');
  const optionsMenu = postElement.querySelector('.post-options-menu');
  
  if (optionsBtn && optionsMenu) {
      optionsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block';
      });
      
      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
          if (optionsMenu.style.display === 'block' && !optionsMenu.contains(e.target) && !optionsBtn.contains(e.target)) {
              optionsMenu.style.display = 'none';
          }
      });
      
      // Edit post
      const editBtn = optionsMenu.querySelector('.edit-post');
      if (editBtn) {
          editBtn.addEventListener('click', () => {
              // TODO: Implement edit post functionality
              alert('Edit post functionality coming soon!');
              optionsMenu.style.display = 'none';
          });
      }
      
      // Delete post
      const deleteBtn = optionsMenu.querySelector('.delete-post');
      if (deleteBtn) {
          deleteBtn.addEventListener('click', () => {
              showDeleteConfirmation(post.post_id);
              optionsMenu.style.display = 'none';
          });
      }
  }
  
  // Like button
  const likeBtn = postElement.querySelector('.like-btn');
  if (likeBtn) {
      likeBtn.addEventListener('click', () => {
          toggleLike(post.post_id);
      });
  }
  
  // Comment button
  const commentBtn = postElement.querySelector('.comment-btn');
  if (commentBtn) {
      commentBtn.addEventListener('click', () => {
          showComments(post.post_id);
      });
  }
  
  // View post button
  const viewBtn = postElement.querySelector('.view-post-btn');
  if (viewBtn) {
      viewBtn.addEventListener('click', () => {
          openPostDetails(post.post_id);
      });
  }
  
  // Make media items clickable to view post
  const mediaItems = postElement.querySelectorAll('.post-media, .media-item');
  mediaItems.forEach(item => {
      item.addEventListener('click', () => {
          openPostDetails(post.post_id);
      });
  });
}

// Render pagination controls
function renderPagination(container, currentPage, totalPages, familyId, filter) {
  if (!container) return;
  
  container.innerHTML = '';
  
  if (totalPages <= 1) return;
  
  // Previous page button
  if (currentPage > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'pagination-btn prev';
      prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
      prevBtn.addEventListener('click', () => {
          loadPosts(familyId, currentPage - 1, filter);
      });
      container.appendChild(prevBtn);
  }
  
  // Page buttons (up to 5)
  const maxButtons = 5;
  const startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);
  
  for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      
      pageBtn.addEventListener('click', () => {
          if (i !== currentPage) {
              loadPosts(familyId, i, filter);
          }
      });
      
      container.appendChild(pageBtn);
  }
  
  // Next page button
  if (currentPage < totalPages) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'pagination-btn next';
      nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
      nextBtn.addEventListener('click', () => {
          loadPosts(familyId, currentPage + 1, filter);
      });
      container.appendChild(nextBtn);
  }
}

// Initialize post modals
function initializePostModals() {
  // Post details modal
  const postModal = document.getElementById('post-modal');
  const commentsModal = document.getElementById('comments-modal');
  const deleteModal = document.getElementById('delete-confirmation-modal');
  
  if (postModal) {
      // Close modal when clicking close button
      const closeButtons = postModal.querySelectorAll('.close-modal');
      closeButtons.forEach(button => {
          button.addEventListener('click', () => {
              postModal.style.display = 'none';
          });
      });
      
      // Close modal when clicking outside
      postModal.addEventListener('click', (e) => {
          if (e.target === postModal) {
              postModal.style.display = 'none';
          }
      });
  }
  
  if (commentsModal) {
      // Close modal when clicking close button
      const closeButtons = commentsModal.querySelectorAll('.close-modal');
      closeButtons.forEach(button => {
          button.addEventListener('click', () => {
              commentsModal.style.display = 'none';
          });
      });
      
      // Close modal when clicking outside
      commentsModal.addEventListener('click', (e) => {
          if (e.target === commentsModal) {
              commentsModal.style.display = 'none';
          }
      });
      
      // Submit comment
      const submitCommentBtn = document.getElementById('submit-comment');
      if (submitCommentBtn) {
          submitCommentBtn.addEventListener('click', () => {
              const commentText = document.getElementById('comment-text');
              const postId = commentsModal.dataset.postId;
              
              if (commentText && postId && commentText.value.trim() !== '') {
                  addComment(postId, commentText.value.trim());
              }
          });
      }
  }
  
  if (deleteModal) {
      // Close modal when clicking close button
      const closeButtons = deleteModal.querySelectorAll('.close-modal');
      closeButtons.forEach(button => {
          button.addEventListener('click', () => {
              deleteModal.style.display = 'none';
          });
      });
      
      // Close modal when clicking outside
      deleteModal.addEventListener('click', (e) => {
          if (e.target === deleteModal) {
              deleteModal.style.display = 'none';
          }
      });
      
      // Cancel delete
      const cancelDeleteBtn = document.getElementById('cancel-delete');
      if (cancelDeleteBtn) {
          cancelDeleteBtn.addEventListener('click', () => {
              deleteModal.style.display = 'none';
          });
      }
      
      // Confirm delete
      const confirmDeleteBtn = document.getElementById('confirm-delete');
      if (confirmDeleteBtn) {
          confirmDeleteBtn.addEventListener('click', () => {
              const postId = deleteModal.dataset.postId;
              if (postId) {
                  deletePost(postId);
              }
          });
      }
  }
}

// Set up filter buttons
function setupFilterButtons() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  if (!filterButtons.length) return;
  
  filterButtons.forEach(button => {
      button.addEventListener('click', () => {
          // Remove active class from all buttons
          filterButtons.forEach(btn => btn.classList.remove('active'));
          
          // Add active class to clicked button
          button.classList.add('active');
          
          // Get filter value
          const filter = button.dataset.filter;
          
          // Get current family ID
          const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
          
          // Reload posts with filter
          if (familyId) {
              loadPosts(familyId, 1, filter);
          }
      });
  });
}

// Open post details modal
async function openPostDetails(postId) {
  const postModal = document.getElementById('post-modal');
  const postModalContent = document.getElementById('post-modal-content');
  
  if (!postModal || !postModalContent) return;
  
  // Show loading state
  postModalContent.innerHTML = '<div class="spinner"></div>';
  postModal.style.display = 'flex';
  
  try {
      // Fetch post details
      const url = formatApiUrl(CONFIG.ROUTES.FEED.POST_DETAILS, { postId });
      
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to fetch post details');
      }
      
      const post = await response.json();
      
      // Create post HTML
      let postHTML = `
          <div class="post-card">
              <div class="post-card-header">
                  <div class="post-author">
                      <div class="avatar">
                          <img src="${CONFIG.DEFAULT_IMAGES.AVATAR}" alt="Author">
                      </div>
                      <div class="post-author-info">
                          <h4>${post.author_name}</h4>
                          <span class="post-time">${timeAgo(post.created_at)}</span>
                      </div>
                  </div>
              </div>
              <div class="post-content">
      `;
      
      // Add post text if available
      if (post.caption) {
          postHTML += `<div class="post-text">${post.caption}</div>`;
      }
      
      // Add media content if available
      if (post.media_urls && post.media_urls.length > 0) {
          if (post.media_urls.length === 1) {
              // Single media item
              const mediaUrl = post.media_urls[0];
              if (post.media_type === 'video') {
                  postHTML += `
                      <div class="post-media">
                          <video controls src="${mediaUrl}" autoplay></video>
                      </div>
                  `;
              } else {
                  postHTML += `
                      <div class="post-media">
                          <img src="${mediaUrl}" alt="Post image">
                      </div>
                  `;
              }
          } else {
              // Multiple media items in a grid
              postHTML += '<div class="post-media-grid">';
              
              post.media_urls.forEach(mediaUrl => {
                  if (post.media_type === 'video') {
                      postHTML += `
                          <div class="media-item">
                              <video src="${mediaUrl}" controls></video>
                          </div>
                      `;
                  } else {
                      postHTML += `
                          <div class="media-item">
                              <img src="${mediaUrl}" alt="Post image">
                          </div>
                      `;
                  }
              });
              
              postHTML += '</div>';
          }
      }
      
      // Add link preview if available
      if (post.link_preview) {
          try {
              const linkPreview = typeof post.link_preview === 'string' 
                  ? JSON.parse(post.link_preview) 
                  : post.link_preview;
              
              if (linkPreview && linkPreview.url) {
                  postHTML += `
                      <a href="${linkPreview.url}" target="_blank" rel="noopener noreferrer" class="post-link-preview">
                          ${linkPreview.image ? `
                              <div class="post-link-preview-image">
                                  <img src="${linkPreview.image}" alt="Link preview">
                              </div>
                          ` : ''}
                          <div class="post-link-preview-content">
                              <div class="post-link-preview-title">${linkPreview.title || 'Link'}</div>
                              ${linkPreview.description ? `
                                  <div class="post-link-preview-description">${linkPreview.description}</div>
                              ` : ''}
                              <div class="post-link-preview-url">${linkPreview.url}</div>
                          </div>
                      </a>
                  `;
              }
          } catch (error) {
              console.error('Error parsing link preview:', error);
          }
      }
      
      // Add post stats and actions
      const likesCount = post.likes_count || 0;
      const commentsCount = post.comments_count || 0;
      
      postHTML += `
              </div>
              <div class="post-stats">
                  <div class="likes-count">${likesCount} ${likesCount === 1 ? 'like' : 'likes'}</div>
                  <div class="comments-count">${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}</div>
              </div>
              <div class="post-actions-row">
                  <button class="post-action-btn like-btn ${post.is_liked ? 'liked' : ''}" data-id="${post.post_id}">
                      <i class="fas ${post.is_liked ? 'fa-heart' : 'fa-heart'}"></i> Like
                  </button>
                  <button class="post-action-btn comment-btn" data-id="${post.post_id}">
                      <i class="fas fa-comment"></i> Comment
                  </button>
              </div>
          </div>
      `;
      
      // Set post HTML
      postModalContent.innerHTML = postHTML;
      
      // Add event listeners to like and comment buttons
      const likeBtn = postModalContent.querySelector('.like-btn');
      if (likeBtn) {
          likeBtn.addEventListener('click', () => {
              toggleLike(post.post_id);
          });
      }
      
      const commentBtn = postModalContent.querySelector('.comment-btn');
      if (commentBtn) {
          commentBtn.addEventListener('click', () => {
              postModal.style.display = 'none';
              showComments(post.post_id);
          });
      }
  } catch (error) {
      console.error('Error loading post details:', error);
      postModalContent.innerHTML = '<p class="error-message">Could not load post details. Please try again later.</p>';
  }
}

// Show comments modal
async function showComments(postId) {
  const commentsModal = document.getElementById('comments-modal');
  const commentsContainer = document.getElementById('comments-container');
  const commentText = document.getElementById('comment-text');
  
  if (!commentsModal || !commentsContainer || !commentText) return;
  
  // Clear input
  commentText.value = '';
  
  // Set post ID
  commentsModal.dataset.postId = postId;
  
  // Show loading state
  commentsContainer.innerHTML = '<div class="spinner"></div>';
  commentsModal.style.display = 'flex';
  
  try {
      // Fetch comments
      const url = formatApiUrl(CONFIG.ROUTES.FEED.GET_COMMENTS, { postId });
      
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to fetch comments');
      }
      
      const comments = await response.json();
      
      // Render comments
      if (comments.length === 0) {
          commentsContainer.innerHTML = '<p class="empty-comments">No comments yet. Be the first to comment!</p>';
          return;
      }
      
      commentsContainer.innerHTML = '';
      
      comments.forEach(comment => {
          const commentElement = document.createElement('div');
          commentElement.className = 'comment-item';
          
          commentElement.innerHTML = `
              <div class="comment-avatar">
                  <img src="${CONFIG.DEFAULT_IMAGES.AVATAR}" alt="Avatar">
              </div>
              <div class="comment-content">
                  <div class="comment-header">
                      <span class="comment-author">${comment.author_name}</span>
                      <span class="comment-time">${timeAgo(comment.created_at)}</span>
                  </div>
                  <div class="comment-text">${comment.text}</div>
              </div>
          `;
          
          commentsContainer.appendChild(commentElement);
      });
  } catch (error) {
      console.error('Error loading comments:', error);
      commentsContainer.innerHTML = '<p class="error-message">Could not load comments. Please try again later.</p>';
  }
}

// Add comment to post
async function addComment(postId, text) {
  const commentsContainer = document.getElementById('comments-container');
  const commentText = document.getElementById('comment-text');
  
  if (!commentsContainer || !commentText) return;
  
  try {
      // Send comment
      const url = formatApiUrl(CONFIG.ROUTES.FEED.COMMENT_POST, { postId });
      
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
      });
      
      if (!response.ok) {
          throw new Error('Failed to add comment');
      }
      
      const comment = await response.json();
      
      // Clear input
      commentText.value = '';
      
      // Add comment to UI
      if (commentsContainer.querySelector('.empty-comments')) {
          commentsContainer.innerHTML = '';
      }
      
      const commentElement = document.createElement('div');
      commentElement.className = 'comment-item';
      
      commentElement.innerHTML = `
          <div class="comment-avatar">
              <img src="${CONFIG.DEFAULT_IMAGES.AVATAR}" alt="Avatar">
          </div>
          <div class="comment-content">
              <div class="comment-header">
                  <span class="comment-author">${comment.author_name}</span>
                  <span class="comment-time">Just now</span>
              </div>
              <div class="comment-text">${comment.text}</div>
          </div>
      `;
      
      commentsContainer.prepend(commentElement);
      
      // Update comment count in post card
      const postCard = document.querySelector(`.post-card[data-id="${postId}"]`);
      if (postCard) {
          const commentsCountElement = postCard.querySelector('.comments-count');
          if (commentsCountElement) {
              const count = parseInt(commentsCountElement.textContent, 10) + 1;
              commentsCountElement.textContent = `${count} ${count === 1 ? 'comment' : 'comments'}`;
          }
      }
  } catch (error) {
      console.error('Error adding comment:', error);
      showToast('Failed to add comment. Please try again.', 'error');
  }
}

// Toggle like on post
async function toggleLike(postId) {
  try {
      // Send like/unlike request
      const url = formatApiUrl(CONFIG.ROUTES.FEED.LIKE_POST, { postId });
      
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to toggle like');
      }
      
      const result = await response.json();
      
      // Update like button state in post list
      const postCard = document.querySelector(`.post-card[data-id="${postId}"]`);
      if (postCard) {
          const likeBtn = postCard.querySelector('.like-btn');
          const likesCountElement = postCard.querySelector('.likes-count');
          
          if (likeBtn) {
              if (result.action === 'liked') {
                  likeBtn.classList.add('liked');
              } else {
                  likeBtn.classList.remove('liked');
              }
          }
          
          if (likesCountElement) {
              const count = result.likes_count;
              likesCountElement.textContent = `${count} ${count === 1 ? 'like' : 'likes'}`;
          }
      }
      
      // Update like button state in post modal
      const postModal = document.getElementById('post-modal');
      if (postModal && postModal.style.display === 'flex') {
          const modalLikeBtn = postModal.querySelector('.like-btn');
          const modalLikesCountElement = postModal.querySelector('.likes-count');
          
          if (modalLikeBtn) {
              if (result.action === 'liked') {
                  modalLikeBtn.classList.add('liked');
              } else {
                  modalLikeBtn.classList.remove('liked');
              }
          }
          
          if (modalLikesCountElement) {
              const count = result.likes_count;
              modalLikesCountElement.textContent = `${count} ${count === 1 ? 'like' : 'likes'}`;
          }
      }
  } catch (error) {
      console.error('Error toggling like:', error);
      showToast('Failed to like/unlike post. Please try again.', 'error');
  }
}

// Show delete confirmation
function showDeleteConfirmation(postId) {
  const deleteModal = document.getElementById('delete-confirmation-modal');
  
  if (!deleteModal) return;
  
  // Set post ID
  deleteModal.dataset.postId = postId;
  
  // Show modal
  deleteModal.style.display = 'flex';
}

// Delete post
async function deletePost(postId) {
  const deleteModal = document.getElementById('delete-confirmation-modal');
  const confirmDeleteBtn = document.getElementById('confirm-delete');
  const cancelDeleteBtn = document.getElementById('cancel-delete');
  
  if (!deleteModal || !confirmDeleteBtn || !cancelDeleteBtn) return;
  
  // Disable buttons during request
  confirmDeleteBtn.disabled = true;
  cancelDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Deleting...';
  
  try {
      // Send delete request
      const url = formatApiUrl(CONFIG.ROUTES.FEED.POST_DETAILS, { postId });
      
      const response = await fetch(url, {
          method: 'DELETE',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to delete post');
      }
      
      // Hide modal
      deleteModal.style.display = 'none';
      
      // Remove post from UI
      const postCard = document.querySelector(`.post-card[data-id="${postId}"]`);
      if (postCard) {
          postCard.remove();
      }
      
      // Show success message
      showToast('Post deleted successfully!', 'success');
      
      // Reload posts if no posts left
      const postsContainer = document.getElementById('posts-container');
      if (postsContainer && postsContainer.children.length === 0) {
          const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
          if (familyId) {
              loadPosts(familyId);
          }
      }
  } catch (error) {
      console.error('Error deleting post:', error);
      showToast('Failed to delete post. Please try again.', 'error');
  } finally {
      // Re-enable buttons
      confirmDeleteBtn.disabled = false;
      cancelDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Delete';
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  // Check if toast container exists, if not create it
  let toastContainer = document.querySelector('.toast-container');
  
  if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
          .toast-container {
              position: fixed;
              bottom: 20px;
              right: 20px;
              z-index: 9999;
          }
          
          .toast {
              padding: 12px 20px;
              margin-bottom: 10px;
              border-radius: 4px;
              color: white;
              font-size: 14px;
              display: flex;
              align-items: center;
              animation: slideIn 0.3s ease-out forwards;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          
          .toast i {
              margin-right: 10px;
          }
          
          .toast.info {
              background-color: var(--primary-color);
          }
          
          .toast.success {
              background-color: var(--success-color);
          }
          
          .toast.error {
              background-color: var(--error-color);
          }
          
          .toast.warning {
              background-color: var(--warning-color);
          }
          
          @keyframes slideIn {
              from {
                  transform: translateX(100%);
                  opacity: 0;
              }
              to {
                  transform: translateX(0);
                  opacity: 1;
              }
          }
          
          @keyframes fadeOut {
              from {
                  opacity: 1;
              }
              to {
                  opacity: 0;
              }
          }
      `;
      document.head.appendChild(style);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Add icon based on type
  let icon;
  switch (type) {
      case 'success':
          icon = 'fa-check-circle';
          break;
      case 'error':
          icon = 'fa-exclamation-circle';
          break;
      case 'warning':
          icon = 'fa-exclamation-triangle';
          break;
      default:
          icon = 'fa-info-circle';
  }
  
  toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-out forwards';
      setTimeout(() => {
          toast.remove();
      }, 300);
  }, 3000);
}