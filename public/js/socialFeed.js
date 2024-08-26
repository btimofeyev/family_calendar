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
  } else {
    console.error("Element with ID scrollToTop not found.");
  }
  
  // Fetch the user's families and set the default family
  await setDefaultFamily();
  await initializeSocialFeed();
});

let currentFamilyId = null;
let currentPage = 1;
let totalPages = 1;

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

  mediaInput.addEventListener("change", (event) => {
    handleFileSelection(event.target.files[0]);
  });

  captionInput.addEventListener("input", handleCaptionInput);

  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitPost();
  });
}

function handleFileSelection(file) {
  const mediaPreview = document.getElementById("mediaPreview");
  
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const previewElement = document.createElement(file.type.startsWith("image/") ? "img" : "video");
      previewElement.src = e.target.result;
      previewElement.className = "media-preview-item";
      if (previewElement.tagName === "VIDEO") {
        previewElement.setAttribute("controls", "");
      }
      mediaPreview.innerHTML = ''; // Clear existing content
      mediaPreview.appendChild(previewElement);
    };
    reader.readAsDataURL(file);
  }
}

function handleCaptionInput(event) {
  const captionInput = event.target;
  const mediaPreview = document.getElementById("mediaPreview");
  const urls = extractUrls(captionInput.value);

  // Check if there's already a media preview (image or video)
  const existingMediaPreview = mediaPreview.querySelector('.media-preview-item');
  
  if (urls.length > 0 && !existingMediaPreview) {
    fetchLinkPreview(urls[0]);
  } else if (urls.length === 0 && !existingMediaPreview) {
    mediaPreview.innerHTML = "";
  }
  // If there's an existing media preview, we don't change it
}

async function fetchLinkPreview(url) {
  try {
    const response = await makeAuthenticatedRequest(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch link preview");
    }
    const preview = await response.json();
    displayLinkPreview(preview);
  } catch (error) {
    console.error("Error fetching link preview:", error);
  }
}

function displayLinkPreview(preview) {
  const mediaPreview = document.getElementById("mediaPreview");
  const existingMediaPreview = mediaPreview.querySelector('.media-preview-item');
  
  if (!existingMediaPreview) {
    mediaPreview.innerHTML = `
      <div class="link-preview">
        <img src="${preview.image}" alt="Link preview image">
        <h3>${preview.title}</h3>
        <p>${preview.description}</p>
      </div>
    `;
  }
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

async function submitPost() {
  const caption = document.getElementById("captionInput").value;
  const mediaInput = document.getElementById("mediaInput");
  const mediaFile = mediaInput.files[0];

  if (!caption && !mediaFile) {
    alert("Please enter a caption or select a media file.");
    return;
  }

  if (!currentFamilyId) {
    alert("No family selected. Please select a family before posting.");
    return;
  }

  const formData = new FormData();
  formData.append("caption", caption);
  formData.append("familyId", currentFamilyId);
  if (mediaFile) {
    formData.append("media", mediaFile);
  }

  try {
    const response = await makeAuthenticatedRequest(`/api/family/${currentFamilyId}/posts`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to create post");
    }

    const result = await response.json();
    document.getElementById("postForm").reset();
    document.getElementById("mediaPreview").innerHTML = "";
    mediaInput.value = "";
    await fetchAndDisplayPosts();

    // Close the post form on mobile
    if (window.innerWidth <= 768) {
      closePostForm();
    }

  } catch (error) {
    console.error("Error creating post:", error);
    alert("Failed to create post. Please try again.");
  }
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

    const response = await makeAuthenticatedRequest(`/api/family/${currentFamilyId}/posts?page=${page}`);

    if (!response.ok) {
      throw new Error("Failed to fetch posts");
    }

    const data = await response.json();

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

  posts.forEach((post) => {
    const postElement = createPostElement(post);
    socialFeedContent.appendChild(postElement);
  });

  // Add this block at the end of the function
  const loadMoreButton = document.getElementById("loadMoreButton");
  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      loadMorePosts();
    });
  }
}

function appendPosts(posts) {
  const socialFeedContent = document.getElementById("socialFeedContent");

  posts.forEach((post) => {
    const postElement = createPostElement(post);
    socialFeedContent.appendChild(postElement);
  });
}

function createPostElement(post) {
  const postElement = document.createElement("div");
  postElement.className = "social-post";
  postElement.dataset.postId = post.post_id;

  let mediaContent = "";
  if (post.media_url) {
    if (post.media_type === "image") {
      mediaContent = `<img src="${
        post.signed_image_url || post.media_url
      }" alt="Post image" class="post-media">`;
    } else if (post.media_type === "video") {
      mediaContent = `<video controls class="post-media"><source src="${
        post.signed_image_url || post.media_url
      }" type="video/mp4"></video>`;
    }
  } else if (post.caption) {
    const youtubeMatch = post.caption.match(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      mediaContent = `
        <div class="youtube-embed" style="text-align: center;">
          <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" 
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>
        </div>`;
    } else if (post.link_preview) {
      mediaContent = `
        <div class="link-preview">
          <img src="${post.link_preview.image}" alt="Link preview image">
          <h3>${post.link_preview.title}</h3>
          <p>${post.link_preview.description}</p>
          <a href="${post.link_preview.url}" target="_blank" rel="noopener noreferrer">Visit Link</a>
        </div>
      `;
    }
  }

  let captionContent = post.caption;
  if (mediaContent.includes("youtube-embed")) {
    captionContent = post.caption.replace(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      ""
    );
  } else if (post.link_preview) {
    captionContent = post.caption.replace(/(https?:\/\/[^\s]+)/g, "");
  }

  postElement.innerHTML = `
    <div class="post-header">
      <span class="post-author">${post.author_name}</span>
      <span class="post-date">${new Date(
        post.created_at
      ).toLocaleString()}</span>
    </div>
    <div class="post-content">
      <p>${captionContent}</p>
      <div class="media-container">${mediaContent}</div>
    </div>
    <div class="post-actions">
      <button class="like-button" data-post-id="${post.post_id}">
        <i class="fas fa-heart"></i> Like (${post.likes_count || 0})
      </button>
      <button class="comment-button" data-post-id="${post.post_id}">
        <i class="fas fa-comment"></i> Comment (${post.comments_count || 0})
      </button>
    </div>
    <div class="comments-section" id="comments-${post.post_id}"></div>
    <form class="comment-form" data-post-id="${post.post_id}">
      <input type="text" placeholder="Write a comment..." required>
      <button type="submit">Post</button>
    </form>
  `;

  const likeButton = postElement.querySelector(".like-button");
  likeButton.addEventListener("click", () => toggleLike(post.post_id));

  const commentButton = postElement.querySelector(".comment-button");
  commentButton.addEventListener("click", () => toggleComments(post.post_id));

  const commentForm = postElement.querySelector(".comment-form");
  commentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const commentText = commentForm.querySelector("input").value;
    addComment(post.post_id, commentText);
    commentForm.reset();
  });

  const mediaContainer = postElement.querySelector(".media-container");
  if (mediaContainer) {
    mediaContainer.addEventListener("click", () => showFullScreenPost(post));
  }

  return postElement;
}

function showFullScreenPost(post) {
  const modal = document.getElementById("postModal");
  const modalContent = document.getElementById("modalPostContent");
  const closeBtn = document.getElementsByClassName("post-modal-close")[0];

  modalContent.innerHTML = `
    <div class="full-post">
      <div class="post-header">
        <span class="post-author">${post.author_name}</span>
        <span class="post-date">${new Date(
          post.created_at
        ).toLocaleString()}</span>
      </div>
      <div class="post-content">
        ${getFullScreenMediaContent(post)}
        <p>${post.caption}</p>
      </div>
      <div class="post-actions">
        <button class="like-button" data-post-id="${post.post_id}">
          <i class="fas fa-heart"></i> Like (${post.likes_count || 0})
        </button>
      </div>
      <div class="comments-section" id="modal-comments-${post.post_id}"></div>
      <form class="comment-form" data-post-id="${post.post_id}">
        <input type="text" placeholder="Write a comment..." required>
        <button type="submit">Post</button>
      </form>
    </div>
  `;

  // Fetch and display comments
  fetchComments(post.post_id).then((comments) => {
    displayComments(`modal-comments-${post.post_id}`, comments);
  });

  // Add event listeners for like and comment buttons
  const likeButton = modalContent.querySelector(".like-button");
  likeButton.addEventListener("click", () => toggleLike(post.post_id));

  const commentForm = modalContent.querySelector(".comment-form");
  commentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const commentText = commentForm.querySelector("input").value;
    addComment(post.post_id, commentText);
    commentForm.reset();
  });

  modal.style.display = "block";

  closeBtn.onclick = function () {
    modal.style.display = "none";
  };

  window.onclick = function (event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
}

function toggleComments(postId) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  if (commentsSection.style.display === "none" || commentsSection.style.display === "") {
    fetchComments(postId).then(comments => {
      displayComments(`comments-${postId}`, comments);
      commentsSection.style.display = "block";
    });
  } else {
    commentsSection.style.display = "none";
  }
}

function getFullScreenMediaContent(post) {
  if (post.media_url) {
    if (post.media_type === "image") {
      return `<img src="${
        post.signed_image_url || post.media_url
      }" alt="Post image" class="post-media">`;
    } else if (post.media_type === "video") {
      return `<video controls class="post-media"><source src="${
        post.signed_image_url || post.media_url
      }" type="video/mp4"></video>`;
    }
  } else if (post.caption) {
    const youtubeMatch = post.caption.match(
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return `
        <div class="youtube-embed">
          <iframe src="https://www.youtube.com/embed/${videoId}" 
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>
        </div>`;
    }
  }
  return "";
}

function getMediaContent(post) {
  if (post.media_url) {
    if (post.media_type === "image") {
      return `<img src="${
        post.signed_image_url || post.media_url
      }" alt="Post image" class="post-media">`;
    } else if (post.media_type === "video") {
      return `<video controls class="post-media"><source src="${
        post.signed_image_url || post.media_url
      }" type="video/mp4"></video>`;
    }
  }
  return "";
}

function updateLoadMoreButton() {
  let loadMoreButton = document.getElementById("loadMoreButton");
  if (!loadMoreButton) {
    loadMoreButton = document.createElement("button");
    loadMoreButton.id = "loadMoreButton";
    loadMoreButton.textContent = "Load More";
    loadMoreButton.addEventListener("click", () => {
      loadMorePosts();
    });
    const socialFeed = document.querySelector(".social-feed");
    if (socialFeed) {
      socialFeed.appendChild(loadMoreButton);
    }
  }

  loadMoreButton.style.display = currentPage < totalPages ? "block" : "none";
}

async function loadMorePosts() {
  if (currentPage < totalPages) {
    const loadMoreButton = document.getElementById("loadMoreButton");
    loadMoreButton.textContent = "Loading...";
    loadMoreButton.disabled = true;

    await fetchAndDisplayPosts(currentPage + 1, true);

    loadMoreButton.textContent = "Load More";
    loadMoreButton.disabled = false;
  } else {
  }
}

async function toggleLike(postId) {
  try {
    const response = await makeAuthenticatedRequest(
      `/api/posts/${postId}/like`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to toggle like");
    }

    const data = await response.json();
    updateLikeUI(postId, data.likes_count);
  } catch (error) {
    console.error("Error toggling like:", error);
  }
}

function updateLikeUI(postId, likesCount) {
  const likeButton = document.querySelector(
    `.like-button[data-post-id="${postId}"]`
  );
  likeButton.innerHTML = `<i class="fas fa-heart"></i> Like (${likesCount})`;
}

async function fetchComments(postId) {
  try {
    const response = await makeAuthenticatedRequest(
      `/api/posts/${postId}/comments`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch comments");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
}

function displayComments(commentsContainerId, comments) {
  const commentsSection = document.getElementById(commentsContainerId);
  commentsSection.innerHTML = "";

  comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const commentMap = new Map();
  comments.forEach((comment) =>
    commentMap.set(comment.comment_id, { ...comment, replies: [] })
  );

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

  topLevelComments.forEach((comment) => {
    const commentElement = createCommentElement(comment, commentsContainerId.split('-')[1]);
    commentsSection.appendChild(commentElement);
  });
}

function toggleReplyForm(commentId) {
  const replyForm = document.getElementById(`replyForm-${commentId}`);
  replyForm.style.display =
    replyForm.style.display === "none" ? "block" : "none";
}

async function addComment(postId, commentText, parentCommentId = null) {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest(
      `/api/posts/${postId}/comment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: commentText,
          parentCommentId: parentCommentId,
        }),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Failed to add comment/reply: ${responseText}`);
    }

    const newComment = JSON.parse(responseText);

    if (parentCommentId) {
      appendReply(postId, parentCommentId, newComment);
    } else {
      appendComment(postId, newComment);
    }
  } catch (error) {
    console.error("Error adding comment/reply:", error);
  }
}

function appendComment(postId, comment) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  const commentElement = createCommentElement(comment);
  commentsSection.appendChild(commentElement);

  updateCommentCount(postId);
}

function appendReply(postId, parentCommentId, reply) {
  const parentComment = document.querySelector(
    `.comment[data-comment-id="${parentCommentId}"]`
  );
  if (parentComment) {
    const replyElement = createCommentElement(reply, true);
    parentComment.appendChild(replyElement);
    updateCommentCount(postId);
  } else {
    console.error(`Parent comment not found: ${parentCommentId}`);
  }
}

function createCommentElement(comment, postId, isReply = false) {
  const element = document.createElement("div");
  element.className = isReply ? "reply" : "comment";
  element.dataset.commentId = comment.comment_id;

  element.innerHTML = `
    <div class="comment-content">
      <span class="comment-author">${comment.author_name}</span>
      <span class="comment-text">${comment.text}</span>
    </div>
    <div class="comment-actions">
      <button class="reply-button" id="replyButton-${
        comment.comment_id
      }">Reply</button>
      <span class="comment-date">${formatDate(comment.created_at)}</span>
    </div>
    <div class="reply-form" id="replyForm-${
      comment.comment_id
    }" style="display: none;">
      <input type="text" placeholder="Write a reply..." required>
      <button type="submit" class="post-reply-button" id="postReply-${
        comment.comment_id
      }">Post</button>
    </div>
  `;

  const replyButton = element.querySelector(
    `#replyButton-${comment.comment_id}`
  );
  const replyForm = element.querySelector(`#replyForm-${comment.comment_id}`);
  const postReplyButton = element.querySelector(
    `#postReply-${comment.comment_id}`
  );

  replyButton.addEventListener("click", () =>
    toggleReplyForm(comment.comment_id)
  );

  postReplyButton.addEventListener("click", (e) => {
    e.preventDefault();
    const replyText = replyForm.querySelector("input").value;
    addComment(postId, replyText, comment.comment_id);
    replyForm.querySelector("input").value = "";
    replyForm.style.display = "none";
  });

  // Render replies recursively
  if (comment.replies && comment.replies.length > 0) {
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "replies";
    comment.replies.forEach((reply) => {
      const replyElement = createCommentElement(reply, postId, true);
      repliesContainer.appendChild(replyElement);
    });
    element.appendChild(repliesContainer);
  }

  return element;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function updateCommentCount(postId) {
  const commentButton = document.querySelector(
    `.comment-button[data-post-id="${postId}"]`
  );
  const currentCount = parseInt(commentButton.textContent.match(/\d+/)[0]);
  commentButton.textContent = `Comment (${currentCount + 1})`;
}

// Add this function to fetch user families
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