// Feed Page JavaScript
let currentFamilyId = null;
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('famlynook_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Initialize feed
    initializeFeed();
});

async function initializeFeed() {
    try {
        // Load user info
        await loadUserInfo();
        
        // Load user families
        await loadFamilies();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing feed:', error);
        showToast('Failed to load feed', 'error');
    }
}

async function loadUserInfo() {
    try {
        // Try localStorage first
        const userData = localStorage.getItem('famlynook_user');
        if (userData) {
            currentUser = JSON.parse(userData);
            updateUserDisplay();
            return;
        }

        // Fallback to API
        const response = await fetch(formatApiUrl('/auth/me'), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            localStorage.setItem('famlynook_user', JSON.stringify(currentUser));
            updateUserDisplay();
        } else {
            throw new Error('Failed to load user info');
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        showToast('Failed to load user information', 'error');
    }
}

function updateUserDisplay() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('modal-user-name').textContent = currentUser.name;
        
        // Update avatar if available
        if (currentUser.avatar) {
            document.getElementById('user-avatar').src = currentUser.avatar;
            document.getElementById('create-user-avatar').src = currentUser.avatar;
            document.getElementById('modal-user-avatar').src = currentUser.avatar;
        }
    }
}

async function loadFamilies() {
    try {
        const response = await fetch(formatApiUrl('/dashboard/user/families'), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });

        if (response.ok) {
            const families = await response.json();
            populateFamilySelector(families);
            
            // Auto-select first family or stored family
            if (families.length > 0) {
                const storedFamilyId = localStorage.getItem('famlynook_family');
                const familyToSelect = families.find(f => f.family_id == storedFamilyId) || families[0];
                currentFamilyId = familyToSelect.family_id;
                document.getElementById('family-select').value = currentFamilyId;
                await loadPosts();
            }
        } else {
            throw new Error('Failed to load families');
        }
    } catch (error) {
        console.error('Error loading families:', error);
        showToast('Failed to load families', 'error');
    }
}

function populateFamilySelector(families) {
    const select = document.getElementById('family-select');
    select.innerHTML = '';
    
    if (families.length === 0) {
        select.innerHTML = '<option value="">No families found</option>';
        return;
    }
    
    families.forEach(family => {
        const option = document.createElement('option');
        option.value = family.family_id;
        option.textContent = family.family_name;
        select.appendChild(option);
    });
}

async function loadPosts(page = 1, append = false) {
    if (!currentFamilyId || isLoading) return;
    
    isLoading = true;
    
    try {
        if (!append) {
            document.getElementById('loading-spinner').classList.remove('hidden');
            document.getElementById('posts-container').innerHTML = '';
        }
        
        const response = await fetch(formatApiUrl('/family/{familyId}/posts', { familyId: currentFamilyId }) + `?page=${page}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentPage = data.currentPage;
            totalPages = data.totalPages;
            
            if (data.posts.length === 0 && page === 1) {
                showNoPosts();
            } else {
                renderPosts(data.posts, append);
                updateLoadMoreButton();
            }
        } else {
            throw new Error('Failed to load posts');
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        showToast('Failed to load posts', 'error');
    } finally {
        isLoading = false;
        document.getElementById('loading-spinner').classList.add('hidden');
    }
}

function renderPosts(posts, append = false) {
    const container = document.getElementById('posts-container');
    
    if (!append) {
        container.innerHTML = '';
    }
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
    
    document.getElementById('no-posts').classList.add('hidden');
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.dataset.postId = post.post_id;
    
    // Format date
    const createdAt = new Date(post.created_at);
    const timeAgo = formatTimeAgo(createdAt);
    
    // Handle media
    let mediaHtml = '';
    if (post.media_urls && post.media_urls.length > 0) {
        mediaHtml = '<div class="post-media">';
        post.media_urls.forEach((url, index) => {
            if (isVideoUrl(url) || post.media_type === 'video') {
                console.log('Video URL:', url); // Debug log
                mediaHtml += `
                    <div class="video-container" onclick="playVideo(this)">
                        <video 
                            preload="metadata"
                            muted
                            playsinline
                            controls
                            onloadedmetadata="handleVideoLoad(this)"
                            onloadeddata="console.log('Video data loaded:', this.src)"
                            oncanplay="console.log('Video can play:', this.src)"
                            onerror="handleVideoError(this, '${url}')"
                            onloadstart="console.log('Video load start:', this.src)"
                            style="display: block; width: 100%; height: auto;"
                        >
                            <source src="${url}" type="video/mp4">
                            <source src="${url}">
                            Your browser does not support the video tag.
                        </video>
                        <div class="video-overlay">
                            <div class="play-button">
                                <i class="fas fa-play"></i>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                mediaHtml += `
                    <div class="image-container">
                        <img 
                            src="${url}" 
                            alt="Post media" 
                            onclick="openImageModal('${url}')"
                            onload="handleImageLoad(this)"
                            onerror="handleImageError(this, '${url}')"
                            loading="lazy"
                        >
                    </div>
                `;
            }
        });
        mediaHtml += '</div>';
    }
    
    // Handle link preview
    let linkPreviewHtml = '';
    if (post.link_preview) {
        if (post.link_preview.type === 'twitter') {
            linkPreviewHtml = `<div class="link-preview twitter-embed">${post.link_preview.html}</div>`;
        } else {
            linkPreviewHtml = `
                <div class="link-preview" onclick="window.open('${post.link_preview.url}', '_blank')">
                    ${post.link_preview.image ? `<img src="${post.link_preview.image}" alt="Link preview">` : ''}
                    <div class="link-info">
                        <h4>${post.link_preview.title || 'Link'}</h4>
                        <p>${post.link_preview.description || ''}</p>
                        <span class="link-url">${post.link_preview.url}</span>
                    </div>
                </div>
            `;
        }
    }
    
    postDiv.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <div class="author-avatar">
                    <img src="img/default-avatar.png" alt="${post.author_name}">
                </div>
                <div class="author-info">
                    <h4>${post.author_name}</h4>
                    <span class="post-time">${timeAgo}</span>
                </div>
            </div>
            ${post.is_owner ? `
                <div class="post-actions">
                    <button class="post-menu-btn" onclick="togglePostMenu(${post.post_id})">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                    <div class="post-menu hidden" id="menu-${post.post_id}">
                        <button onclick="deletePost(${post.post_id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="post-content">
            ${post.caption ? `<p>${linkifyText(post.caption)}</p>` : ''}
            ${mediaHtml}
            ${linkPreviewHtml}
        </div>
        
        <div class="post-footer">
            <div class="post-stats">
                <span class="likes-count">${post.likes_count || 0} likes</span>
                <span class="comments-count">${post.comments_count || 0} comments</span>
            </div>
            
            <div class="post-interactions">
                <button class="interaction-btn like-btn ${post.is_liked ? 'liked' : ''}" onclick="toggleLike(${post.post_id}, this)">
                    <i class="fas fa-heart"></i>
                    <span>Like</span>
                </button>
                <button class="interaction-btn comment-btn" onclick="openCommentsModal(${post.post_id})">
                    <i class="fas fa-comment"></i>
                    <span>Comment</span>
                </button>
                <button class="interaction-btn share-btn" onclick="sharePost(${post.post_id})">
                    <i class="fas fa-share"></i>
                    <span>Share</span>
                </button>
            </div>
        </div>
    `;
    
    return postDiv;
}

function linkifyText(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

function showNoPosts() {
    document.getElementById('posts-container').innerHTML = '';
    document.getElementById('no-posts').classList.remove('hidden');
}

function updateLoadMoreButton() {
    const container = document.getElementById('load-more-container');
    if (currentPage < totalPages) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('back-btn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
    
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Family selector
    document.getElementById('family-select').addEventListener('change', async (e) => {
        currentFamilyId = e.target.value;
        localStorage.setItem('famlynook_family', currentFamilyId);
        currentPage = 1;
        await loadPosts();
    });
    
    // Create post
    document.getElementById('create-post-btn').addEventListener('click', openCreatePostModal);
    document.getElementById('create-first-post').addEventListener('click', openCreatePostModal);
    
    // Load more
    document.getElementById('load-more-btn').addEventListener('click', async () => {
        await loadPosts(currentPage + 1, true);
    });
    
    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Create post form
    document.getElementById('create-post-form').addEventListener('submit', createPost);
    document.getElementById('cancel-post').addEventListener('click', closeAllModals);
    
    // Comment form
    document.getElementById('comment-form').addEventListener('submit', submitComment);
    document.getElementById('cancel-comment').addEventListener('click', closeAllModals);
    
    // Media upload
    document.getElementById('media-upload').addEventListener('change', handleMediaUpload);
    
    // Character counters
    document.getElementById('post-caption').addEventListener('input', updateCharCount);
    document.getElementById('comment-text').addEventListener('input', updateCommentCharCount);
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
}

function openCreatePostModal() {
    if (!currentFamilyId) {
        showToast('Please select a family first', 'error');
        return;
    }
    
    document.getElementById('create-post-modal').classList.remove('hidden');
    document.getElementById('post-caption').focus();
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
    
    // Reset forms
    document.getElementById('create-post-form').reset();
    document.getElementById('comment-form').reset();
    document.getElementById('media-preview').innerHTML = '';
    document.getElementById('media-preview').classList.add('hidden');
    updateCharCount();
    updateCommentCharCount();
}

async function createPost(e) {
    e.preventDefault();
    
    const caption = document.getElementById('post-caption').value.trim();
    const mediaFiles = document.getElementById('media-upload').files;
    
    if (!caption && mediaFiles.length === 0) {
        showToast('Please add some content to your post', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-post');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    
    try {
        const formData = new FormData();
        formData.append('caption', caption);
        
        // Add media files
        for (let i = 0; i < mediaFiles.length; i++) {
            formData.append('media', mediaFiles[i]);
        }
        
        const response = await fetch(formatApiUrl('/family/{familyId}/posts', { familyId: currentFamilyId }), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            },
            body: formData
        });
        
        if (response.ok) {
            closeAllModals();
            showToast('Post created successfully!', 'success');
            currentPage = 1;
            await loadPosts();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create post');
        }
    } catch (error) {
        console.error('Error creating post:', error);
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Post';
    }
}

function handleMediaUpload(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('media-preview');
    
    if (files.length === 0) {
        preview.classList.add('hidden');
        return;
    }
    
    preview.innerHTML = '';
    preview.classList.remove('hidden');
    
    files.forEach((file, index) => {
        const mediaItem = document.createElement('div');
        mediaItem.className = 'media-item';
        
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = 'Preview';
            mediaItem.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = true;
            mediaItem.appendChild(video);
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-media-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = () => removeMediaItem(index);
        mediaItem.appendChild(removeBtn);
        
        preview.appendChild(mediaItem);
    });
    
    updateSubmitButton();
}

function removeMediaItem(index) {
    const input = document.getElementById('media-upload');
    const dt = new DataTransfer();
    
    Array.from(input.files).forEach((file, i) => {
        if (i !== index) dt.items.add(file);
    });
    
    input.files = dt.files;
    handleMediaUpload({ target: input });
}

function updateCharCount() {
    const textarea = document.getElementById('post-caption');
    const counter = document.getElementById('char-count');
    counter.textContent = textarea.value.length;
    updateSubmitButton();
}

function updateCommentCharCount() {
    const textarea = document.getElementById('comment-text');
    const counter = document.getElementById('comment-char-count');
    counter.textContent = textarea.value.length;
}

function updateSubmitButton() {
    const caption = document.getElementById('post-caption').value.trim();
    const mediaFiles = document.getElementById('media-upload').files;
    const submitBtn = document.getElementById('submit-post');
    
    submitBtn.disabled = !caption && mediaFiles.length === 0;
}

async function toggleLike(postId, button) {
    try {
        const response = await fetch(formatApiUrl('/posts/{postId}/like', { postId }), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const likesCount = button.closest('.post').querySelector('.likes-count');
            likesCount.textContent = `${data.likes_count} likes`;
            
            if (data.action === 'liked') {
                button.classList.add('liked');
            } else {
                button.classList.remove('liked');
            }
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('Failed to update like', 'error');
    }
}

async function openCommentsModal(postId) {
    const modal = document.getElementById('post-modal');
    modal.classList.remove('hidden');
    
    // Load post details and comments
    await loadPostWithComments(postId);
}

async function loadPostWithComments(postId) {
    const contentContainer = document.getElementById('post-detail-content');
    contentContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><span>Loading...</span></div>';
    
    try {
        // Load post details
        const postResponse = await fetch(formatApiUrl('/posts/{postId}', { postId }), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });
        
        if (!postResponse.ok) throw new Error('Failed to load post');
        const post = await postResponse.json();
        
        // Load comments
        const commentsResponse = await fetch(formatApiUrl('/posts/{postId}/comments', { postId }), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });
        
        if (!commentsResponse.ok) throw new Error('Failed to load comments');
        const comments = await commentsResponse.json();
        
        // Render post with comments
        renderPostWithComments(post, comments);
        
    } catch (error) {
        console.error('Error loading post details:', error);
        contentContainer.innerHTML = '<div class="error-message">Failed to load post details</div>';
    }
}

function renderPostWithComments(post, comments) {
    const contentContainer = document.getElementById('post-detail-content');
    
    // Format date
    const createdAt = new Date(post.created_at);
    const timeAgo = formatTimeAgo(createdAt);
    
    // Handle media (simplified for modal)
    let mediaHtml = '';
    if (post.media_urls && post.media_urls.length > 0) {
        mediaHtml = '<div class="post-media-modal">';
        post.media_urls.forEach(url => {
            if (isVideoUrl(url) || post.media_type === 'video') {
                mediaHtml += `<video controls src="${url}"></video>`;
            } else {
                mediaHtml += `<img src="${url}" alt="Post media" onclick="openImageModal('${url}')">`;
            }
        });
        mediaHtml += '</div>';
    }
    
    // Organize comments into threads
    const commentThreads = organizeComments(comments);
    
    contentContainer.innerHTML = `
        <div class="post-detail">
            <div class="post-header">
                <div class="post-author">
                    <div class="author-avatar">
                        <img src="img/default-avatar.png" alt="${post.author_name}">
                    </div>
                    <div class="author-info">
                        <h4>${post.author_name}</h4>
                        <span class="post-time">${timeAgo}</span>
                    </div>
                </div>
            </div>
            
            <div class="post-content">
                ${post.caption ? `<p>${linkifyText(post.caption)}</p>` : ''}
                ${mediaHtml}
            </div>
            
            <div class="post-stats">
                <span class="likes-count">${post.likes_count || 0} likes</span>
                <span class="comments-count">${post.comments_count || 0} comments</span>
            </div>
            
            <div class="post-interactions">
                <button class="interaction-btn like-btn ${post.is_liked ? 'liked' : ''}" onclick="toggleLike(${post.post_id}, this)">
                    <i class="fas fa-heart"></i>
                    <span>Like</span>
                </button>
            </div>
        </div>
        
        <div class="comments-section">
            <div class="add-comment">
                <div class="user-avatar-small">
                    <img src="img/default-avatar.png" alt="Your avatar">
                </div>
                <div class="comment-input-container">
                    <textarea 
                        id="new-comment-text" 
                        placeholder="Write a comment..." 
                        rows="2"
                        maxlength="500"
                    ></textarea>
                    <button 
                        id="submit-new-comment" 
                        class="btn btn-primary btn-sm"
                        onclick="submitComment(${post.post_id}, null)"
                    >
                        Comment
                    </button>
                </div>
            </div>
            
            <div class="comments-list">
                ${renderCommentThreads(commentThreads, post.post_id)}
            </div>
        </div>
    `;
}

function organizeComments(comments) {
    const commentMap = {};
    const threads = [];
    
    // First pass: create comment map
    comments.forEach(comment => {
        comment.replies = [];
        commentMap[comment.comment_id] = comment;
    });
    
    // Second pass: organize into threads
    comments.forEach(comment => {
        if (comment.parent_comment_id) {
            // This is a reply
            const parent = commentMap[comment.parent_comment_id];
            if (parent) {
                parent.replies.push(comment);
            }
        } else {
            // This is a top-level comment
            threads.push(comment);
        }
    });
    
    return threads;
}

function renderCommentThreads(threads, postId) {
    if (threads.length === 0) {
        return '<div class="no-comments">No comments yet. Be the first to comment!</div>';
    }
    
    return threads.map(comment => renderComment(comment, postId, 0)).join('');
}

function renderComment(comment, postId, depth = 0) {
    const createdAt = new Date(comment.created_at);
    const timeAgo = formatTimeAgo(createdAt);
    const isOwn = currentUser && comment.author_id === currentUser.id;
    
    let html = `
        <div class="comment ${depth > 0 ? 'comment-reply' : ''}" style="margin-left: ${depth * 20}px">
            <div class="comment-avatar">
                <img src="img/default-avatar.png" alt="${comment.author_name}">
            </div>
            <div class="comment-content">
                <div class="comment-header">
                    <span class="comment-author">${comment.author_name}</span>
                    <span class="comment-time">${timeAgo}</span>
                </div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-actions">
                    <button class="comment-action-btn" onclick="toggleReplyForm(${comment.comment_id})">
                        <i class="fas fa-reply"></i> Reply
                    </button>
                    ${isOwn ? `
                        <button class="comment-action-btn delete-btn" onclick="deleteComment(${comment.comment_id}, ${postId})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
                <div class="reply-form hidden" id="reply-form-${comment.comment_id}">
                    <div class="user-avatar-small">
                        <img src="img/default-avatar.png" alt="Your avatar">
                    </div>
                    <div class="comment-input-container">
                        <textarea 
                            id="reply-text-${comment.comment_id}"
                            placeholder="Write a reply..." 
                            rows="2"
                            maxlength="500"
                        ></textarea>
                        <div class="reply-actions">
                            <button 
                                class="btn btn-secondary btn-sm"
                                onclick="hideReplyForm(${comment.comment_id})"
                            >
                                Cancel
                            </button>
                            <button 
                                class="btn btn-primary btn-sm"
                                onclick="submitComment(${postId}, ${comment.comment_id})"
                            >
                                Reply
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add replies
    if (comment.replies && comment.replies.length > 0) {
        html += comment.replies.map(reply => renderComment(reply, postId, depth + 1)).join('');
    }
    
    return html;
}

async function submitComment(postId, parentCommentId = null) {
    const textElement = parentCommentId 
        ? document.getElementById(`reply-text-${parentCommentId}`)
        : document.getElementById('new-comment-text');
    
    const text = textElement.value.trim();
    if (!text) return;
    
    const originalText = textElement.value;
    textElement.value = 'Posting...';
    textElement.disabled = true;
    
    try {
        const response = await fetch(formatApiUrl('/posts/{postId}/comment', { postId }), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            },
            body: JSON.stringify({ 
                text,
                parentCommentId: parentCommentId || undefined 
            })
        });
        
        if (response.ok) {
            showToast('Comment added successfully!', 'success');
            
            // Hide reply form if it was a reply
            if (parentCommentId) {
                hideReplyForm(parentCommentId);
            }
            
            // Reload comments
            await loadPostWithComments(postId);
            
            // Update comment count in main feed
            const feedPost = document.querySelector(`[data-post-id="${postId}"]`);
            if (feedPost) {
                const commentsCount = feedPost.querySelector('.comments-count');
                const currentCount = parseInt(commentsCount.textContent.split(' ')[0]) || 0;
                commentsCount.textContent = `${currentCount + 1} comments`;
            }
        } else {
            throw new Error('Failed to add comment');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment', 'error');
        textElement.value = originalText;
    } finally {
        textElement.disabled = false;
        if (!parentCommentId) {
            textElement.value = '';
        }
    }
}

function toggleReplyForm(commentId) {
    const replyForm = document.getElementById(`reply-form-${commentId}`);
    const isHidden = replyForm.classList.contains('hidden');
    
    // Hide all other reply forms
    document.querySelectorAll('.reply-form').forEach(form => {
        form.classList.add('hidden');
    });
    
    if (isHidden) {
        replyForm.classList.remove('hidden');
        const textarea = document.getElementById(`reply-text-${commentId}`);
        textarea.focus();
    }
}

function hideReplyForm(commentId) {
    const replyForm = document.getElementById(`reply-form-${commentId}`);
    replyForm.classList.add('hidden');
    document.getElementById(`reply-text-${commentId}`).value = '';
}

async function deleteComment(commentId, postId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
        const response = await fetch(formatApiUrl('/comments/{commentId}', { commentId }), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });
        
        if (response.ok) {
            showToast('Comment deleted successfully!', 'success');
            await loadPostWithComments(postId);
            
            // Update comment count in main feed
            const feedPost = document.querySelector(`[data-post-id="${postId}"]`);
            if (feedPost) {
                const commentsCount = feedPost.querySelector('.comments-count');
                const currentCount = parseInt(commentsCount.textContent.split(' ')[0]) || 0;
                commentsCount.textContent = `${Math.max(0, currentCount - 1)} comments`;
            }
        } else {
            throw new Error('Failed to delete comment');
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Failed to delete comment', 'error');
    }
}

async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        const response = await fetch(formatApiUrl('/posts/{postId}', { postId }), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });
        
        if (response.ok) {
            document.querySelector(`[data-post-id="${postId}"]`).remove();
            showToast('Post deleted successfully!', 'success');
        } else {
            throw new Error('Failed to delete post');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Failed to delete post', 'error');
    }
}

function togglePostMenu(postId) {
    const menu = document.getElementById(`menu-${postId}`);
    document.querySelectorAll('.post-menu').forEach(m => {
        if (m !== menu) m.classList.add('hidden');
    });
    menu.classList.toggle('hidden');
}

function sharePost(postId) {
    if (navigator.share) {
        navigator.share({
            title: 'Family Post',
            url: `${window.location.origin}/post/${postId}`
        });
    } else {
        // Fallback - copy link
        navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
        showToast('Link copied to clipboard!', 'success');
    }
}

function logout() {
    localStorage.removeItem('famlynook_token');
    localStorage.removeItem('famlynook_user');
    localStorage.removeItem('famlynook_family');
    window.location.href = '/';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById(`${type}-toast`);
    const messageElement = document.getElementById(`${type}-message`);
    
    messageElement.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Helper functions for media handling
function isVideoUrl(url) {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
}

function handleVideoLoad(video) {
    const container = video.closest('.video-container');
    const overlay = container.querySelector('.video-overlay');
    
    console.log('Video loaded successfully:', video.src);
    console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
    console.log('Video duration:', video.duration);
    
    // Ensure video is visible and overlay is shown
    video.style.opacity = '1';
    video.style.display = 'block';
    
    // Check if video has actual content
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('Video has no dimensions - may be audio only or corrupted');
        handleVideoError(video, video.src);
        return;
    }
    
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }
    
    // Add click event to video itself as backup
    video.addEventListener('click', (e) => {
        e.stopPropagation();
        playVideo(container);
    });
    
    // Test if we can actually play the video
    video.currentTime = 0.1;
}

function handleVideoError(video, originalUrl) {
    console.error('Video failed to load:', originalUrl);
    console.error('Video error details:', video.error);
    
    const container = video.closest('.video-container');
    if (container) {
        let errorMessage = 'Video unavailable';
        if (video.error) {
            switch(video.error.code) {
                case 1:
                    errorMessage = 'Video loading aborted';
                    break;
                case 2:
                    errorMessage = 'Network error loading video';
                    break;
                case 3:
                    errorMessage = 'Video format not supported';
                    break;
                case 4:
                    errorMessage = 'Video source not found';
                    break;
                default:
                    errorMessage = 'Unknown video error';
            }
        }
        
        container.innerHTML = `
            <div class="media-error">
                <i class="fas fa-video-slash"></i>
                <p>${errorMessage}</p>
                <small>URL: ${originalUrl}</small>
                <small>Click to try direct link</small>
            </div>
        `;
        container.onclick = () => {
            // Open direct link
            window.open(originalUrl, '_blank');
        };
    }
}

function handleImageLoad(img) {
    img.classList.add('loaded');
}

function handleImageError(img, originalUrl) {
    console.error('Image failed to load:', originalUrl);
    const container = img.closest('.image-container');
    if (container) {
        container.innerHTML = `
            <div class="media-error">
                <i class="fas fa-image"></i>
                <p>Image unavailable</p>
                <small>Click to try again</small>
            </div>
        `;
        container.onclick = () => {
            // Retry loading
            img.src = originalUrl;
            container.innerHTML = '';
            container.appendChild(img);
        };
    }
}

function playVideo(container) {
    const video = container.querySelector('video');
    const overlay = container.querySelector('.video-overlay');
    
    if (!video) return;
    
    // Pause other videos and show their overlays
    document.querySelectorAll('video').forEach(v => {
        if (v !== video && !v.paused) {
            v.pause();
            v.controls = false;
            const pausedContainer = v.closest('.video-container');
            const pausedOverlay = pausedContainer.querySelector('.video-overlay');
            if (pausedOverlay) {
                pausedOverlay.classList.remove('hidden');
                pausedOverlay.style.display = 'flex';
            }
        }
    });
    
    if (video.paused) {
        // Try to play the video
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // Video started playing successfully
                if (overlay) {
                    overlay.classList.add('hidden');
                    overlay.style.display = 'none';
                }
                video.controls = true;
                video.muted = false;
                
                // Add event listener for when video ends
                video.addEventListener('ended', () => {
                    if (overlay) {
                        overlay.classList.remove('hidden');
                        overlay.style.display = 'flex';
                    }
                    video.controls = false;
                }, { once: true });
                
            }).catch(err => {
                console.error('Error playing video:', err);
                showToast('Unable to play video. Try clicking again.', 'error');
                
                // Reset overlay if play failed
                if (overlay) {
                    overlay.classList.remove('hidden');
                    overlay.style.display = 'flex';
                }
            });
        }
    } else {
        // Pause the video
        video.pause();
        video.controls = false;
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        }
    }
}

function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="image-modal-content">
            <img src="${imageUrl}" alt="Full size image" onload="this.classList.add('loaded')">
            <button class="close-image-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.close-image-modal')) {
            document.body.removeChild(modal);
        }
    });
    
    // Enable swipe to close on mobile
    if (isMobileDevice()) {
        enableSwipeToClose(modal);
    }
}

// Mobile optimization functions
function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function enableSwipeToClose(modal) {
    let startY = 0;
    let currentY = 0;
    let isSwipeDown = false;
    
    modal.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isSwipeDown = false;
    });
    
    modal.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        const diffY = currentY - startY;
        
        if (diffY > 50) {
            isSwipeDown = true;
            modal.style.transform = `translateY(${diffY}px)`;
            modal.style.opacity = Math.max(0.3, 1 - (diffY / 300));
        }
    });
    
    modal.addEventListener('touchend', () => {
        if (isSwipeDown && currentY - startY > 100) {
            document.body.removeChild(modal);
        } else {
            modal.style.transform = '';
            modal.style.opacity = '';
        }
    });
}

// Enhanced mobile interactions
function setupMobileOptimizations() {
    // Prevent zoom on double tap for buttons
    document.querySelectorAll('.interaction-btn, .nav-btn, .btn').forEach(btn => {
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.click();
        });
    });
    
    // Add pull-to-refresh functionality
    if (isMobileDevice()) {
        setupPullToRefresh();
    }
    
    // Optimize scroll performance
    document.addEventListener('scroll', throttle(handleScroll, 100));
    
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            // Adjust layout after orientation change
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });
}

function setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let pullDistance = 0;
    const threshold = 80;
    let isPulling = false;
    
    const refreshIndicator = document.createElement('div');
    refreshIndicator.className = 'pull-refresh-indicator';
    refreshIndicator.innerHTML = '<i class="fas fa-arrow-down"></i><span>Pull to refresh</span>';
    document.body.appendChild(refreshIndicator);
    
    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
        }
    });
    
    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && startY > 0) {
            currentY = e.touches[0].clientY;
            pullDistance = currentY - startY;
            
            if (pullDistance > 0) {
                isPulling = true;
                e.preventDefault();
                
                const opacity = Math.min(pullDistance / threshold, 1);
                refreshIndicator.style.opacity = opacity;
                refreshIndicator.style.transform = `translateY(${Math.min(pullDistance, threshold)}px)`;
                
                if (pullDistance >= threshold) {
                    refreshIndicator.innerHTML = '<i class="fas fa-sync"></i><span>Release to refresh</span>';
                } else {
                    refreshIndicator.innerHTML = '<i class="fas fa-arrow-down"></i><span>Pull to refresh</span>';
                }
            }
        }
    });
    
    document.addEventListener('touchend', () => {
        if (isPulling && pullDistance >= threshold) {
            refreshIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Refreshing...</span>';
            setTimeout(async () => {
                await loadPosts(1, false);
                refreshIndicator.style.opacity = '0';
                refreshIndicator.style.transform = 'translateY(-50px)';
                setTimeout(() => {
                    refreshIndicator.style.transform = '';
                }, 300);
            }, 500);
        } else {
            refreshIndicator.style.opacity = '0';
            refreshIndicator.style.transform = '';
        }
        
        startY = 0;
        currentY = 0;
        pullDistance = 0;
        isPulling = false;
    });
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

function handleScroll() {
    // Auto-load more posts when near bottom
    if (!isLoading && currentPage < totalPages) {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        
        if (scrollTop + clientHeight >= scrollHeight - 500) {
            loadPosts(currentPage + 1, true);
        }
    }
}

// Initialize mobile optimizations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupMobileOptimizations();
});

// Close post menu when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.post-actions')) {
        document.querySelectorAll('.post-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});