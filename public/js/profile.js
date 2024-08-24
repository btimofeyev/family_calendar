document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get("userId");
  const familyId = urlParams.get("familyId");

  // Set the default family if not already set
  await setDefaultFamily(familyId);

  if (userId && currentFamilyId) {
    // Viewing another family member's profile
    await fetchFamilyMemberProfile(userId, currentFamilyId);
  } else if (currentFamilyId) {
    // Viewing own profile
    await fetchUserProfile();
  } else {
    console.error("No family selected");
  }

  setupTabNavigation();
});

let currentFamilyId = null;
let currentPage = 1;
let totalPages = 1;

async function setDefaultFamily(familyId) {
  try {
    const families = await fetchUserFamilies();
    if (families.length > 0) {
      currentFamilyId = familyId || families[0].family_id;
    }
  } catch (error) {
    console.error("Error setting default family:", error);
  }
}

async function fetchUserProfile() {
  try {
    const response = await makeAuthenticatedRequest('/api/dashboard/profile');
    if (!response || !response.ok) {
      throw new Error(`HTTP error! status: ${response ? response.status : 'Unknown'}`);
    }
    const data = await response.json();
    updateProfileUI(data.user, data.families, data.posts);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    document.getElementById("profileContent").innerHTML = `<p>Error loading user profile: ${error.message}</p>`;
  }
}

async function fetchFamilyMemberProfile(userId, familyId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/dashboard/users/${userId}/family/${familyId}`);
    if (!response || !response.ok) {
      throw new Error(`HTTP error! status: ${response ? response.status : 'Unknown'}`);
    }
    const data = await response.json();
    updateFamilyMemberProfileUI(data.user, data.posts);
  } catch (error) {
    console.error("Error fetching family member profile:", error);
    document.getElementById("profileContent").innerHTML = `<p>Error loading profile: ${error.message}</p>`;
  }
}

function updateProfileUI(user, families, posts) {
  document.getElementById("userAvatar").textContent = user.name.charAt(0);
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userEmail").textContent = user.email;

  const familySelector = document.createElement("select");
  familySelector.id = "familySelector";
  families.forEach(family => {
    const option = document.createElement("option");
    option.value = family.family_id;
    option.textContent = family.family_name;
    familySelector.appendChild(option);
  });

  document.querySelector(".profile-header").appendChild(familySelector);

  familySelector.addEventListener("change", async (e) => {
    currentFamilyId = e.target.value;
    await fetchAndDisplayPosts();
  });

  if (families.length > 0) {
    currentFamilyId = families[0].family_id;
    displayPosts(posts.filter(post => post.family_id === currentFamilyId));
  }
}

function updateFamilyMemberProfileUI(user, posts) {
  document.getElementById("userAvatar").textContent = user.name.charAt(0);
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userEmail").textContent = user.email;

  displayPosts(posts, false);
}

async function fetchAndDisplayPosts(page = 1, append = false) {
  try {
    if (!currentFamilyId) {
      console.warn("No family selected");
      return;
    }

    const response = await makeAuthenticatedRequest(`/api/family/${currentFamilyId}/posts?page=${page}`);
    if (!response || !response.ok) {
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
    const profileContent = document.getElementById("profileContent");
    profileContent.innerHTML = `<p>Error loading posts. Please try again later.</p>`;
  }
}

function displayPosts(posts) {
  const profileContent = document.getElementById("profileContent");
  profileContent.innerHTML = '<div class="post-grid"></div>';
  const postGrid = profileContent.querySelector('.post-grid');

  posts.forEach((post) => {
    const postThumbnail = createPostThumbnail(post);
    postGrid.appendChild(postThumbnail);
  });

  // Add modal container to the page
  if (!document.getElementById('postModal')) {
    const modalHTML = `
      <div id="postModal" class="modal">
        <div class="modal-content">
          <span class="close">&times;</span>
          <div id="modalPostContent"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // Set up modal functionality
  setupModal();
}

function setupModal() {
  const modal = document.getElementById('postModal');
  const closeBtn = modal.querySelector('.close');

  closeBtn.onclick = () => {
    closeModal(modal);
  };

  window.onclick = (event) => {
    if (event.target == modal) {
      closeModal(modal);
    }
  };
}

function createPostThumbnail(post) {
  const thumbnail = document.createElement('div');
  thumbnail.className = 'post-thumbnail';
  thumbnail.dataset.postId = post.post_id;

  let thumbnailContent = '';
  if (post.media_url) {
    if (post.media_type === "image") {
      thumbnailContent = `<img src="${post.signed_image_url || post.media_url}" alt="Post thumbnail">`;
    } else {
      thumbnailContent = `<video><source src="${post.signed_image_url || post.media_url}" type="video/mp4"></video>`;
    }
  } else {
    thumbnailContent = `<div class="text-thumbnail">${post.caption.substring(0, 50)}...</div>`;
  }

  thumbnail.innerHTML = thumbnailContent;
  thumbnail.addEventListener('click', () => openPostModal(post));

  return thumbnail;
}

function openPostModal(post) {
  const modal = document.getElementById('postModal');
  const modalContent = document.getElementById('modalPostContent');
  
  modalContent.innerHTML = createPostElement(post).innerHTML;
  setupPostActions(modalContent, post);

  modal.style.display = "flex";
  document.body.classList.add('modal-open');
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
}

function closeModal(modal) {
  modal.classList.remove('show');
  document.body.classList.remove('modal-open');
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
}

function appendPosts(posts) {
  const profileContent = document.getElementById("profileContent");

  posts.forEach((post) => {
    const postElement = createPostElement(post);
    profileContent.appendChild(postElement);
  });
}
function createPostElement(post) {
  console.log('Post:', post);
  console.log('Author ID:', post.author_id);
  
  const postElement = document.createElement("div");
  postElement.className = "profile-post";
  postElement.dataset.postId = post.post_id;

  let mediaContent = "";
  if (post.media_url) {
      mediaContent = post.media_type === "image"
          ? `<img src="${post.signed_image_url || post.media_url}" alt="Post image" class="post-media">`
          : `<video controls class="post-media"><source src="${post.signed_image_url || post.media_url}" type="video/mp4"></video>`;
  }

  // Get the logged-in user's ID from localStorage or another source
  const loggedInUserId = localStorage.getItem('userId'); // Assuming you have the userId stored in localStorage

  postElement.innerHTML = `
  <div class="modal-post-content">
      <div class="post-header">
          <span class="post-author">${post.author_name}</span>
          <span class="post-date">${new Date(post.created_at).toLocaleString()}</span>
          ${post.author_id == loggedInUserId ? '<button class="delete-post-btn" data-post-id="'+ post.post_id +'">Delete</button>' : ''}
      </div>
      <div class="post-content">
          <p>${post.caption}</p>
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
  </div>
  `;

  setupPostActions(postElement, post);
  return postElement;
}


function setupPostActions(postElement, post) {
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

  const deleteButton = postElement.querySelector(".delete-post-btn");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => deletePost(post.post_id));
  }
}

async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) {
    return;
  }

  try {
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}`, {
      method: 'DELETE',
    });

    if (!response || !response.ok) {
      throw new Error(`HTTP error! status: ${response ? response.status : 'Unknown'}`);
    }

    // Remove the post from the UI
    const postElement = document.querySelector(`.profile-post[data-post-id="${postId}"]`);
    if (postElement) {
      postElement.remove();
    }

    closeModal(document.getElementById('postModal'));

  } catch (error) {
    console.error("Error deleting post:", error);
    alert("Failed to delete post. Please try again.");
  }
}

async function toggleLike(postId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}/like`, {
      method: "POST",
    });

    if (!response || !response.ok) {
      throw new Error("Failed to toggle like");
    }

    const data = await response.json();
    updateLikeUI(postId, data.likes_count);
  } catch (error) {
    console.error("Error toggling like:", error);
  }
}

function updateLikeUI(postId, likesCount) {
  const likeButton = document.querySelector(`.like-button[data-post-id="${postId}"]`);
  likeButton.innerHTML = `<i class="fas fa-heart"></i> Like (${likesCount})`;
}

async function fetchComments(postId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/posts/${postId}/comments`);
    if (!response || !response.ok) {
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

async function addComment(postId, commentText, parentCommentId = null) {
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

    if (!response || !response.ok) {
      throw new Error("Failed to add comment");
    }

    const newComment = await response.json();

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
  const parentComment = document.querySelector(`.comment[data-comment-id="${parentCommentId}"]`);
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
      <button class="reply-button" id="replyButton-${comment.comment_id}">Reply</button>
      <span class="comment-date">${formatDate(comment.created_at)}</span>
    </div>
    <div class="reply-form" id="replyForm-${comment.comment_id}" style="display: none;">
      <input type="text" placeholder="Write a reply..." required>
      <button type="submit" class="post-reply-button" id="postReply-${comment.comment_id}">Post</button>
    </div>
  `;

  const replyButton = element.querySelector(`#replyButton-${comment.comment_id}`);
  const replyForm = element.querySelector(`#replyForm-${comment.comment_id}`);
  const postReplyButton = element.querySelector(`#postReply-${comment.comment_id}`);

  replyButton.addEventListener("click", () => toggleReplyForm(comment.comment_id));

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
  const commentButton = document.querySelector(`.comment-button[data-post-id="${postId}"]`);
  const currentCount = parseInt(commentButton.textContent.match(/\d+/)[0]);
  commentButton.textContent = `Comment (${currentCount + 1})`;
}

function setupTabNavigation() {
  const tabs = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.getAttribute("data-tab");

      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((content) => {
        content.classList.remove("active");
        content.style.display = "none";
      });

      tab.classList.add("active");
      const activeContent = document.getElementById(`${tabName}Tab`);
      activeContent.style.display = "block";
      setTimeout(() => {
        activeContent.classList.add("active");
      }, 50);
    });
  });
}

// Fetch user families
async function fetchUserFamilies() {
  try {
    const response = await makeAuthenticatedRequest("/api/dashboard/user/families");
    if (!response || !response.ok) {
      throw new Error(`HTTP error! status: ${response ? response.status : 'Unknown'}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching user families:", error);
    return [];
  }
}
