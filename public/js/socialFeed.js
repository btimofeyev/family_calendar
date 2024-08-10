document.addEventListener("DOMContentLoaded", () => {
  initializeSocialFeed();
});

function initializeSocialFeed() {
  setupPostForm();
  fetchAndDisplayPosts();
}

function setupPostForm() {
  const postForm = document.getElementById("postForm");
  const mediaInput = document.getElementById("mediaInput");
  const captionInput = document.getElementById("captionInput");

  mediaInput.addEventListener("change", (event) => {
    handleFileSelection(event.target.files[0]);
  });

  captionInput.addEventListener("input", handleLinkPreview);

  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitPost();
  });
}

function handleLinkPreview() {
  const captionInput = document.getElementById("captionInput");
  const mediaPreview = document.getElementById("mediaPreview");
  const urls = extractUrls(captionInput.value);

  if (urls.length > 0) {
    fetchLinkPreview(urls[0]);
  } else {
    mediaPreview.innerHTML = "";
  }
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

async function fetchLinkPreview(url) {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest(
      `/api/link-preview?url=${encodeURIComponent(url)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
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
  const imageHtml = preview.image
    ? `<img src="${preview.image}" alt="Link preview" style="max-width: 100%;">`
    : "";
  mediaPreview.innerHTML = `
    <div class="link-preview" style="border: 1px solid #ccc; padding: 10px; display: flex; flex-direction: column; align-items: center;">
      ${imageHtml}
      <div class="link-info" style="text-align: center;">
        <h3>${preview.title || "No title available"}</h3>
        <p>${preview.description || "No description available"}</p>
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
  const caption = document.getElementById("captionInput").value;
  const mediaInput = document.getElementById("mediaInput");
  const mediaFile = mediaInput.files[0];

  if (!caption && !mediaFile) {
    alert("Please enter a caption or select a media file.");
    return;
  }

  const formData = new FormData();
  formData.append("caption", caption);
  if (mediaFile) {
    formData.append("media", mediaFile);
  }

  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest("/api/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to create post");
    }

    const result = await response.json();
    console.log("Post created successfully:", result);
    document.getElementById("postForm").reset();
    document.getElementById("mediaPreview").innerHTML = "";
    mediaInput.value = "";
    await fetchAndDisplayPosts();
  } catch (error) {
    console.error("Error creating post:", error);
    alert("Failed to create post. Please try again.");
  }
}

async function fetchAndDisplayPosts() {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest("/api/posts", {
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
    } else if (post.link_preview) {
      const linkPreview = post.link_preview;
      const imageHtml = linkPreview.image
        ? `<img src="${linkPreview.image}" alt="Link preview" style="max-width: 100%;">`
        : "";
      mediaContent = `
        <a href="${
          linkPreview.url
        }" target="_blank" style="text-decoration: none; color: inherit;">
          <div class="link-preview" style="border: 1px solid #ccc; padding: 10px; display: flex; flex-direction: column; align-items: center;">
            ${imageHtml}
            <div class="link-info" style="text-align: center;">
              <h3>${linkPreview.title || "No title available"}</h3>
              <p>${linkPreview.description || "No description available"}</p>
            </div>
          </div>
        </a>
      `;
    }

    let captionContent = post.caption;
    if (post.link_preview) {
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
        ${mediaContent}
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
    commentButton.addEventListener("click", () => fetchComments(post.post_id));

    const commentForm = postElement.querySelector(".comment-form");
    commentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const commentText = commentForm.querySelector("input").value;
      addComment(post.post_id, commentText);
      commentForm.reset();
    });

    socialFeedContent.appendChild(postElement);
  });
}

async function toggleLike(postId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}/like`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

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
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}/comments`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch comments");
    }

    const comments = await response.json();
    console.log("Fetched comments:", comments);
    displayComments(postId, comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
  }
}

function displayComments(postId, comments) {
  console.log(`Displaying comments for post ${postId}:`, comments);
  const commentsSection = document.getElementById(`comments-${postId}`);
  commentsSection.innerHTML = "";

  // Sort comments by creation date
  comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Create a map to store comments by their ID
  const commentMap = new Map();
  comments.forEach((comment) =>
    commentMap.set(comment.comment_id, { ...comment, replies: [] })
  );

  // Organize comments into a tree structure
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

  // Render the comments
  topLevelComments.forEach((comment) => {
    const commentElement = createCommentElement(comment, postId);
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
    console.log(
      `Adding comment/reply: postId=${postId}, parentCommentId=${parentCommentId}, text=${commentText}`
    );
    const token = localStorage.getItem("token");
    console.log("Token:", token);
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: commentText,
        parentCommentId: parentCommentId,
      }),
    });

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response text:", responseText);

    if (!response.ok) {
      throw new Error(`Failed to add comment/reply: ${responseText}`);
    }

    const newComment = JSON.parse(responseText);
    console.log("New comment/reply:", newComment);

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
  console.log(
    `Appending reply: postId=${postId}, parentCommentId=${parentCommentId}`,
    reply
  );
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

  // Add event listeners (same as before)

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
