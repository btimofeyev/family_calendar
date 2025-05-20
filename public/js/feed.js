document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
    const feedContainer = document.getElementById('feed-container');
    const createPostForm = document.getElementById('create-post-form');
    const logoutButton = document.getElementById('logout-btn');

    if (!token) {
        console.log('No token found, redirecting to login.');
        window.location.href = '/index.html';
        return;
    }

    if (!familyId) {
        console.error('Family ID not found in localStorage.');
        if (feedContainer) {
            feedContainer.innerHTML = '<p class="error-message">Error: Family ID not found. Unable to load feed.</p>';
        }
        return;
    }

    function renderPosts(posts) {
        if (!feedContainer) return;
        feedContainer.innerHTML = ''; // Clear previous content (loading/error messages)

        if (!posts || posts.length === 0) {
            feedContainer.innerHTML = '<p>No posts yet. Be the first to share!</p>';
            return;
        }

        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.classList.add('post');
            postElement.dataset.postId = post.post_id; // For easier access later

            let mediaHTML = '';
            if (post.media_urls && post.media_urls.length > 0) {
                // Assuming the backend provides a full URL. If not, prepend CONFIG.MEDIA_BASE_URL
                const mediaUrl = post.media_urls[0];
                if (mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm') || mediaUrl.endsWith('.ogv')) {
                    mediaHTML = `<video controls src="${mediaUrl}"></video>`;
                } else {
                    mediaHTML = `<img src="${mediaUrl}" alt="Post media">`;
                }
            }

            postElement.innerHTML = `
                <div class="post-header">
                    <strong class="post-author">${post.author_name || 'Anonymous'}</strong>
                    <span class="post-time">${timeAgo(post.created_at)}</span>
                </div>
                <p class="post-caption">${post.caption}</p>
                <div class="post-media">${mediaHTML}</div>
                <div class="post-actions">
                    <button class="like-btn" data-post-id="${post.post_id}">
                        Like (<span class="likes-count">${post.likes_count || 0}</span>)
                    </button>
                    <span class="comments-count">Comments: ${post.comments_count || 0}</span>
                </div>
            `;
            feedContainer.appendChild(postElement);
        });
    }

    async function fetchPosts(currentFamilyId) {
        if (!feedContainer) return;
        feedContainer.innerHTML = '<p>Loading posts...</p>'; // Loading message

        const apiUrl = formatApiUrl(CONFIG.ROUTES.FEED.POSTS, { familyId: currentFamilyId });
        console.log(`Fetching posts from: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to fetch posts and could not parse error JSON.' }));
                console.error('Failed to fetch posts:', response.status, errorData);
                throw new Error(`Failed to fetch posts: ${response.status} ${errorData.message || ''}`);
            }

            const postsData = await response.json();
            console.log('Fetched posts:', postsData.posts);
            renderPosts(postsData.posts); // Call renderPosts
            return postsData.posts;
        } catch (error) {
            console.error('Error fetching posts:', error);
            if (feedContainer) {
                feedContainer.innerHTML = `<p class="error-message">Error loading feed: ${error.message}</p>`;
            }
        }
    }

    async function handleCreatePostSubmit(event) {
        event.preventDefault();
        if (!familyId) {
            alert('Error: Family ID is missing. Cannot create post.');
            return;
        }

        const captionInput = document.getElementById('post-caption');
        const mediaInput = document.getElementById('post-media');

        const caption = captionInput.value.trim();
        const mediaFile = mediaInput.files[0];

        if (!caption && !mediaFile) {
            alert('Please provide a caption or select a media file.');
            return;
        }

        const formData = new FormData();
        formData.append('caption', caption);
        if (mediaFile) {
            formData.append('media', mediaFile); // Backend expects 'media'
        }

        const apiUrl = formatApiUrl(CONFIG.ROUTES.FEED.CREATE_POST, { familyId });
        console.log(`Creating post to: ${apiUrl}`);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // 'Content-Type' is NOT set by us, browser does it for FormData
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to create post and could not parse error JSON.' }));
                console.error('Failed to create post:', response.status, errorData);
                throw new Error(`Failed to create post: ${response.status} ${errorData.message || ''}`);
            }

            const newPost = await response.json();
            console.log('Post created successfully:', newPost);
            captionInput.value = ''; // Clear form
            mediaInput.value = ''; // Clear file input
            fetchPosts(familyId); // Refresh feed
        } catch (error) {
            console.error('Error creating post:', error);
            alert(`Error creating post: ${error.message}`);
        }
    }

    async function handleLikePost(event) {
        if (!event.target.classList.contains('like-btn')) {
            return; // Not a like button
        }

        const likeButton = event.target;
        const postId = likeButton.dataset.postId;

        if (!postId) {
            console.error('Post ID not found on like button.');
            return;
        }

        const apiUrl = formatApiUrl(CONFIG.ROUTES.FEED.LIKE_POST, { postId });
        console.log(`Liking/unliking post: ${postId} at ${apiUrl}`);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' // Assuming backend might expect this for like toggle
                }
                // No body needed if it's a simple toggle, or send {} if required by backend
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to like post and could not parse error JSON.' }));
                console.error('Failed to like post:', response.status, errorData);
                throw new Error(`Failed to like post: ${response.status} ${errorData.message || ''}`);
            }

            const result = await response.json();
            console.log('Like/Unlike action result:', result);

            // Update UI
            const likesCountElement = likeButton.querySelector('.likes-count');
            if (likesCountElement) {
                likesCountElement.textContent = result.likes_count;
            }

            if (result.action === 'liked') {
                likeButton.classList.add('liked'); // For potential styling
                likeButton.textContent = `Unlike (${result.likes_count})`;
            } else {
                likeButton.classList.remove('liked');
                likeButton.textContent = `Like (${result.likes_count})`;
            }

        } catch (error) {
            console.error('Error liking post:', error);
            alert(`Error liking post: ${error.message}`);
        }
    }

    // Initial call to fetch posts
    if (familyId) {
        fetchPosts(familyId);
    }

    // Event Listeners
    if (createPostForm) {
        createPostForm.addEventListener('submit', handleCreatePostSubmit);
    }

    if (feedContainer) {
        feedContainer.addEventListener('click', handleLikePost);
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem(CONFIG.TOKEN_KEY);
            localStorage.removeItem(CONFIG.FAMILY_KEY);
            console.log('User logged out, redirecting to login.');
            window.location.href = '/index.html';
        });
    }
});
