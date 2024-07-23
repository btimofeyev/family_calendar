document.addEventListener('DOMContentLoaded', () => {
    initializeSocialFeed();
});

function initializeSocialFeed() {
    setupPostForm();
    fetchAndDisplayPosts();
}

async function fetchAndDisplayPosts() {
    try {
        const response = await fetch('/api/posts', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch posts');
        }

        const posts = await response.json();
        const feedContent = document.getElementById('socialFeedContent');
        feedContent.innerHTML = '';
        posts.forEach(post => displayPost(post));
    } catch (error) {
        console.error('Error fetching posts:', error);
        alert('Failed to load posts. Please try again later.');
    }
}

function displayPost(post, prepend = false) {
    const postElement = createPostElement(post);
    const feedContent = document.getElementById('socialFeedContent');
    
    if (prepend) {
        feedContent.prepend(postElement);
    } else {
        feedContent.appendChild(postElement);
    }
}

function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'social-post';
    
    let postContent = `
        <div class="post-header">
            <strong>${post.author_name}</strong>
            <span>${new Date(post.created_at).toLocaleString()}</span>
        </div>
    `;
    
    if (post.image_url) {
        postContent += `<img src="${post.image_url}" alt="Posted Image">`;
    }
    postContent += `<p>${post.caption}</p>`;
    
    postElement.innerHTML = `
        ${postContent}
        <div class="post-meta">
            <div class="post-actions">
                <button class="like-button" data-post-id="${post.post_id}">
                    Like (<span class="like-count">${post.likes_count || 0}</span>)
                </button>
                <button class="comment-button" data-post-id="${post.post_id}">Comment</button>
            </div>
        </div>
        <div class="comments-section" id="comments-${post.post_id}"></div>
    `;

    const likeButton = postElement.querySelector('.like-button');
    likeButton.addEventListener('click', () => toggleLike(post.post_id));

    const commentButton = postElement.querySelector('.comment-button');
    commentButton.addEventListener('click', () => showCommentForm(post.post_id));

    return postElement;
}
function setupPostForm() {
    const postForm = document.getElementById('postForm');
    const photoInput = document.getElementById('photoInput');
    const captionInput = document.getElementById('captionInput');

    postForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const caption = captionInput.value.trim();
        const photo = photoInput.files[0];

        if (!caption && !photo) {
            alert('Please enter a caption or select a photo.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('caption', caption);
            if (photo) {
                formData.append('photo', photo);
            }

            const response = await fetch('/api/posts', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to create post');
            }

            const newPost = await response.json();
            displayPost(newPost, true);
            postForm.reset();
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        }
    });
}
async function handlePostSubmit(event) {
    event.preventDefault();
    const photo = document.getElementById('photoInput').files[0];
    const caption = document.getElementById('captionInput').value;

    try {
        const formData = new FormData();
        formData.append('photo', photo);
        formData.append('caption', caption);

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

        const newPost = await response.json();
        const postElement = createPostElement(newPost);
        document.getElementById('socialFeedContent').prepend(postElement);
        event.target.reset(); // Reset form after successful post
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post. Please try again.');
    }
}

async function toggleLike(postId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to toggle like');
        }

        const result = await response.json();
        updateLikeCount(postId, result.likes_count);
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Failed to like post. Please try again.');
    }
}

function updateLikeCount(postId, count) {
    const likeCountElement = document.querySelector(`.like-button[data-post-id="${postId}"] .like-count`);
    if (likeCountElement) {
        likeCountElement.textContent = count;
    }
}

function showCommentForm(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (!commentsSection) {
        console.error(`Comments section not found for post ${postId}`);
        return;
    }

    // Check if the form already exists
    if (commentsSection.querySelector('.comment-form')) {
        return; // Form already exists, do nothing
    }

    const commentForm = document.createElement('form');
    commentForm.className = 'comment-form';
    commentForm.innerHTML = `
        <textarea placeholder="Write a comment..." required></textarea>
        <button type="submit">Post Comment</button>
    `;

    commentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const commentText = commentForm.querySelector('textarea').value;
        await handleCommentSubmit(postId, commentText);
        commentForm.reset();
    });

    commentsSection.appendChild(commentForm);
}

async function handleCommentSubmit(postId, commentText) {
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
            throw new Error('Failed to post comment');
        }

        const newComment = await response.json();
        displayComment(postId, newComment);
    } catch (error) {
        console.error('Error posting comment:', error);
        alert('Failed to post comment. Please try again.');
    }
}

function displayComment(postId, comment) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (!commentsSection) {
        console.error(`Comments section not found for post ${postId}`);
        return;
    }

    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.innerHTML = `
        <strong>${comment.author_name}</strong>: ${comment.text}
    `;
    commentsSection.appendChild(commentElement);
}
