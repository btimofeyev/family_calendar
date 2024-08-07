document.addEventListener('DOMContentLoaded', () => {
    const userId = new URLSearchParams(window.location.search).get('id');
    if (userId) {
        fetchUserProfile(userId);
    } else {
        console.error('No user ID provided');
    }

    setupTabNavigation();
});

async function fetchUserProfile(userId) {
    try {
        const response = await fetch(`/api/dashboard/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const data = await response.json();
        updateProfileUI(data.user, data.posts);
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}

function updateProfileUI(user, posts) {
    document.getElementById('userAvatar').textContent = user.name.charAt(0);
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userEmail').textContent = user.email;

    const allPostsTab = document.getElementById('allPostsTab');
    const imagesTab = document.getElementById('imagesTab');

    allPostsTab.innerHTML = '';
    imagesTab.innerHTML = '';

    posts.forEach(post => {
        const postElement = createPostElement(post);
        allPostsTab.appendChild(postElement);

        if (post.image_url) {
            const imagePostElement = createPostElement(post);
            imagesTab.appendChild(imagePostElement);
        }
    });
}

function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'profile-post';
    postElement.setAttribute('data-post-id', post.post_id);

    let postContent = '';

    // Check if the post contains an image
    if (post.media_url && post.media_type === 'image') {
        postContent += `<img src="${post.media_url}" alt="Posted Image">`;
    }

    // Check if the post contains a link preview
    if (post.link_preview) {
        const linkPreview = typeof post.link_preview === 'string' ? JSON.parse(post.link_preview) : post.link_preview;
        const imageHtml = linkPreview.image ? `<img src="${linkPreview.image}" alt="Link preview" style="max-width: 100%;">` : '';
        postContent += `
            <a href="${linkPreview.url}" target="_blank" style="text-decoration: none; color: inherit;">
                <div class="link-preview" style="border: 1px solid #ccc; padding: 10px; display: flex; flex-direction: column; align-items: center;">
                    ${imageHtml}
                    <div class="link-info" style="text-align: center;">
                        <h3>${linkPreview.title || 'No title available'}</h3>
                        <p>${linkPreview.description || 'No description available'}</p>
                    </div>
                </div>
            </a>
        `;
    }
    const currentUserId = getCurrentUserId();
    console.log('Post author ID:', post.author_id, 'Current user ID:', currentUserId);
    postContent += `<p>${post.caption.replace(/(https?:\/\/[^\s]+)/g, '')}</p>`;
    postElement.innerHTML = `
    ${postContent}
    <div class="post-meta">
        <span>${new Date(post.created_at).toLocaleString()}</span>
        <span>Likes: ${post.likes_count}</span>
    </div>
    <div class="post-actions">
        <button class="like-button" data-post-id="${post.post_id}">
            ${post.is_liked ? 'Unlike' : 'Like'} (${post.likes_count})
        </button>
        <button class="comment-button" data-post-id="${post.post_id}">
            Comment (${post.comments_count || 0})
        </button>
        ${currentUserId === post.author_id ? `<button class="delete-button" data-post-id="${post.post_id}">Delete</button>` : ''}
    </div>
    <div class="comments-section" id="comments-${post.post_id}"></div>
    <form class="comment-form" data-post-id="${post.post_id}">
        <input type="text" placeholder="Write a comment..." required>
        <button type="submit">Post</button>
    </form>
`;

    const likeButton = postElement.querySelector('.like-button');
    likeButton.addEventListener('click', () => toggleLike(post.post_id));

    const commentButton = postElement.querySelector('.comment-button');
    commentButton.addEventListener('click', () => fetchComments(post.post_id));

    const commentForm = postElement.querySelector('.comment-form');
    commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const commentText = commentForm.querySelector('input').value;
        addComment(post.post_id, commentText);
        commentForm.reset();
    });

    const deleteButton = postElement.querySelector('.delete-button');
    if (deleteButton) {
        console.log('Delete button added for post:', post.post_id);
        deleteButton.addEventListener('click', () => deletePost(post.post_id));
    } else {
        console.log('Delete button not added for post:', post.post_id);
    }

    return postElement;
}
function getCurrentUserId() {
    const userId = localStorage.getItem('userId');
    console.log('Current user ID:', userId || 'No user logged in');
    return userId ? parseInt(userId, 10) : null;
}


async function toggleLike(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to toggle like');
        }

        const data = await response.json();
        updateLikeUI(postId, data.likes_count);
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}

function updateLikeUI(postId, likesCount) {
    const likeButton = document.querySelector(`.like-button[data-post-id="${postId}"]`);
    likeButton.textContent = `${likeButton.textContent.includes('Unlike') ? 'Like' : 'Unlike'} (${likesCount})`;
}

async function fetchComments(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/comments`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch comments');
        }

        const comments = await response.json();
        displayComments(postId, comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }
}

function displayComments(postId, comments) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    commentsSection.innerHTML = comments.map(comment => `
        <div class="comment">
            <strong>${comment.author_name}</strong>: ${comment.text}
        </div>
    `).join('');
}

async function addComment(postId, commentText) {
    try {
        const response = await fetch(`/api/posts/${postId}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ text: commentText })
        });

        if (!response.ok) {
            throw new Error('Failed to add comment');
        }

        const newComment = await response.json();
        appendComment(postId, newComment);
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

function appendComment(postId, comment) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.innerHTML = `<strong>${comment.author_name}</strong>: ${comment.text}`;
    commentsSection.appendChild(commentElement);

    const commentButton = document.querySelector(`.comment-button[data-post-id="${postId}"]`);
    const currentCount = parseInt(commentButton.textContent.match(/\d+/)[0]);
    commentButton.textContent = `Comment (${currentCount + 1})`;
}

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
        });
    });
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }

    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete post');
        }

        // Remove the post from the UI
        const postElement = document.querySelector(`.profile-post[data-post-id="${postId}"]`);
        if (postElement) {
            postElement.remove();
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        alert(error.message);
    }
}