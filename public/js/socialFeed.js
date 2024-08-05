document.addEventListener("DOMContentLoaded", () => {
  initializeSocialFeed();
});

function initializeSocialFeed() {
  setupPostForm();
  fetchAndDisplayPosts();
}

function setupPostForm() {
  const postForm = document.getElementById('postForm');
  const mediaInput = document.getElementById('mediaInput');
  const captionInput = document.getElementById('captionInput');

  mediaInput.addEventListener('change', (event) => {
      handleFileSelection(event.target.files[0]);
  });

  captionInput.addEventListener('input', handleLinkPreview);

  postForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitPost();
  });
}

function handleLinkPreview() {
  const captionInput = document.getElementById('captionInput');
  const mediaPreview = document.getElementById('mediaPreview');
  const urls = extractUrls(captionInput.value);

  if (urls.length > 0) {
      // For simplicity, we'll just preview the first URL found
      fetchLinkPreview(urls[0]);
  } else {
      mediaPreview.innerHTML = '';
  }
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

async function fetchLinkPreview(url) {
  try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      if (!response.ok) {
          throw new Error('Failed to fetch link preview');
      }
      const preview = await response.json();
      displayLinkPreview(preview);
  } catch (error) {
      console.error('Error fetching link preview:', error);
  }
}

function displayLinkPreview(preview) {
  const mediaPreview = document.getElementById('mediaPreview');
  const imageHtml = preview.image ? `<img src="${preview.image}" alt="Link preview" style="max-width: 100%;">` : '';
  mediaPreview.innerHTML = `
      <div class="link-preview" style="border: 1px solid #ccc; padding: 10px; display: flex; flex-direction: column; align-items: center;">
          ${imageHtml}
          <div class="link-info" style="text-align: center;">
              <h3>${preview.title || 'No title available'}</h3>
              <p>${preview.description || 'No description available'}</p>
              <a href="${preview.url}" target="_blank">${preview.url}</a>
          </div>
      </div>
  `;
}

function handleFileSelection(file) {
  const preview = document.getElementById("mediaPreview");
  preview.innerHTML = "";

  if (file) {
      if (file.type.startsWith("image/")) {
          const img = document.createElement("img");
          img.src = URL.createObjectURL(file);
          img.onload = () => URL.revokeObjectURL(img.src);
          img.style.maxWidth = "100%";
          preview.appendChild(img);
      } else if (file.type.startsWith("video/")) {
          const video = document.createElement("video");
          video.src = URL.createObjectURL(file);
          video.controls = true;
          video.style.maxWidth = "100%";
          preview.appendChild(video);
      }
  }
}

async function submitPost() {
  const caption = document.getElementById('captionInput').value;
  const mediaInput = document.getElementById('mediaInput');
  const mediaFile = mediaInput.files[0];

  if (!caption && !mediaFile) {
      alert('Please enter a caption or select a media file.');
      return;
  }

  const formData = new FormData();
  formData.append('caption', caption);
  if (mediaFile) {
      formData.append('media', mediaFile);
  }

  try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`
          },
          body: formData
      });

      if (!response.ok) {
          throw new Error('Failed to create post');
      }

      const result = await response.json();
      console.log('Post created successfully:', result);
      document.getElementById('postForm').reset();
      document.getElementById('mediaPreview').innerHTML = '';
      mediaInput.value = '';
      await fetchAndDisplayPosts();
  } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
  }
}

async function fetchAndDisplayPosts() {
  try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/posts", {
          headers: {
              Authorization: `Bearer ${token}`,
          },
      });

      if (!response.ok) {
          throw new Error("Failed to fetch posts");
      }

      const posts = await response.json();
      displayPosts(posts);
  } catch (error) {
      console.error("Error fetching posts:", error);
  }
}
function displayPosts(posts) {
  const socialFeedContent = document.getElementById('socialFeedContent');
  socialFeedContent.innerHTML = '';

  posts.forEach(post => {
      const postElement = document.createElement('div');
      postElement.className = 'social-post';

      let mediaContent = '';
      if (post.media_url) {
          if (post.media_type === 'image') {
              mediaContent = `<img src="${post.media_url}" alt="Post image" class="post-media">`;
          } else if (post.media_type === 'video') {
              mediaContent = `<video controls class="post-media"><source src="${post.media_url}" type="video/mp4"></video>`;
          }
      } else if (post.link_preview) {
          const linkPreview = post.link_preview;
          const imageHtml = linkPreview.image
              ? `<img src="${linkPreview.image}" alt="Link preview" style="max-width: 100%;">`
              : '';
          mediaContent = `
              <a href="${linkPreview.url}" target="_blank" style="text-decoration: none; color: inherit;">
                  <div class="link-preview" style="border: 1px solid #ccc; padding: 10px; display: flex; flex-direction: column; align-items: center;">
                      ${imageHtml}
                      <div class="link-info" style="text-align: center;">
                          <h3>${linkPreview.title || 'No title available'}</h3>
                          <p>${linkPreview.description || 'No description available'}</p>
                          <span>${linkPreview.url}</span>
                      </div>
                  </div>
              </a>
          `;
      }

      let captionContent = post.caption;
      if (post.link_preview) {
          captionContent = post.caption.replace(/(https?:\/\/[^\s]+)/g, '');
      }

      postElement.innerHTML = `
          <div class="post-header">
              <span class="post-author">${post.author_name}</span>
              <span class="post-date">${new Date(post.created_at).toLocaleString()}</span>
          </div>
          <div class="post-content">
              <p>${captionContent}</p>
              ${mediaContent}
          </div>
          <div class="post-actions">
              <button class="like-button" data-post-id="${post.post_id}">
                  <i class="fas fa-heart"></i> Like (${post.likes_count || 0})
              </button>
              <button class="comment-button" data-post-id="${post.post_id}">
                  <i class="fas fa-comment"></i> Comment
              </button>
          </div>
          <div class="comments-section" id="comments-${post.post_id}"></div>
      `;

      socialFeedContent.appendChild(postElement);
  });
}
// Export functions that need to be called from dashboard.js
window.socialFeed = {
  initializeSocialFeed,
  fetchAndDisplayPosts,
};
