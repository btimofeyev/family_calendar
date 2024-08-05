document.addEventListener("DOMContentLoaded", () => {
  initializeSocialFeed();
});

function initializeSocialFeed() {
  setupPostForm();
  fetchAndDisplayPosts();
}

function setupPostForm() {
  const postForm = document.getElementById('postForm');
  const cameraButton = document.getElementById('cameraButton');
  const galleryButton = document.getElementById('galleryButton');
  const cameraInput = document.getElementById('cameraInput');
  const imageUpload = document.getElementById('imageUpload');

  cameraButton.addEventListener('click', () => {
      cameraInput.click();
  });

  galleryButton.addEventListener('click', () => {
      imageUpload.click();
  });

  cameraInput.addEventListener('change', (event) => {
      handleFileSelection(event.target.files[0]);
  });

  imageUpload.addEventListener('change', (event) => {
      handleFileSelection(event.target.files[0]);
  });

  postForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitPost();
  });
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

function previewImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.createElement("img");
    preview.src = e.target.result;
    preview.style.maxWidth = "100%";
    document.getElementById("postForm").appendChild(preview);
  };
  reader.readAsDataURL(file);
}

function previewVideo(file) {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.controls = true;
  video.style.maxWidth = "100%";
  document.getElementById("postForm").appendChild(video);
}

async function submitPost() {
  const caption = document.getElementById('captionInput').value;
  const cameraInput = document.getElementById('cameraInput');
  const imageUpload = document.getElementById('imageUpload');
  const mediaFile = cameraInput.files[0] || imageUpload.files[0];

  if (!caption && !mediaFile) {
      alert('Please enter a caption or select/capture a media file.');
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
      cameraInput.value = '';
      imageUpload.value = '';
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
  const socialFeedContent = document.getElementById("socialFeedContent");
  socialFeedContent.innerHTML = "";

  posts.forEach((post) => {
    const postElement = document.createElement("div");
    postElement.className = "social-post";

    let mediaContent = "";
    if (post.media_url) {
      if (post.media_type === "image") {
        mediaContent = `<img src="${post.media_url}" alt="Post image" class="post-media">`;
      } else if (post.media_type === "video") {
        mediaContent = `<video controls class="post-media"><source src="${post.media_url}" type="video/mp4"></video>`;
      }
    }

    postElement.innerHTML = `
        <div class="post-header">
          <span class="post-author">${post.author_name}</span>
          <span class="post-date">${new Date(
            post.created_at
          ).toLocaleString()}</span>
        </div>
        <div class="post-content">
          <p>${post.caption}</p>
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
