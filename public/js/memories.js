document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    initializeMemories();
    setupEventListeners();
    initializeNotifications();
    checkForTargetMemory();
    setupMobileMenu();
});

let currentFamilyId = null;
let currentMemoryId = null;
let currentAlbumContent = [];
let currentImageIndex = 0;

function checkForTargetMemory() {
    const targetMemoryId = localStorage.getItem('targetMemoryId');
    const targetFamilyId = localStorage.getItem('targetFamilyId');

    if (targetMemoryId && targetFamilyId) {
        localStorage.removeItem('targetMemoryId');
        localStorage.removeItem('targetFamilyId');

        currentFamilyId = targetFamilyId;
        fetchMemories(currentFamilyId).then(() => {
            openMemoryDetails({ memory_id: targetMemoryId });
        });
    }
}

async function initializeMemories() {
    currentFamilyId = localStorage.getItem('selectedFamilyId');
    if (!currentFamilyId) {
        const families = await fetchUserFamilies();
        if (families.length > 0) {
            currentFamilyId = families[0].family_id;
        }
    }
    await fetchUserFamilies();
    if (currentFamilyId) {
        fetchMemories(currentFamilyId);
    }
}

async function fetchUserFamilies() {
    try {
        const response = await makeAuthenticatedRequest('/api/dashboard/user/families');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const families = await response.json();
        updateFamilySelector(families);
        return families;
    } catch (error) {
        console.error('Error fetching user families:', error);
        return [];
    }
}

function updateFamilySelector(families) {
    const familySelector = document.getElementById('familySelector');
    
    if (familySelector) {
        familySelector.innerHTML = '<select id="familySelect"><option value="">Select a family</option></select>';
        const select = familySelector.querySelector('select');

        families.forEach(family => {
            const option = document.createElement('option');
            option.value = family.family_id;
            option.textContent = family.family_name;
            if (family.family_id === currentFamilyId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            currentFamilyId = e.target.value;
            localStorage.setItem('selectedFamilyId', currentFamilyId);
            if (currentFamilyId) {
                fetchMemories(currentFamilyId);
                updateCurrentFamilyDisplay();
            }
        });

        updateCurrentFamilyDisplay();
    }
}

function updateCurrentFamilyDisplay() {
    const currentFamilyDisplay = document.getElementById('currentFamilyDisplay');
    const selectedFamilyName = document.getElementById('selectedFamilyName');
    const familySelect = document.getElementById('familySelect');
    
    if (currentFamilyId && familySelect) {
        const selectedOption = familySelect.querySelector(`option[value="${currentFamilyId}"]`);
        if (selectedOption) {
            const familyName = selectedOption.textContent;
            if (currentFamilyDisplay) {
                currentFamilyDisplay.textContent = `Current Family: ${familyName}`;
            }
            if (selectedFamilyName) {
                selectedFamilyName.textContent = `Creating memory for: ${familyName}`;
            }
        }
    }
}

async function fetchMemories(familyId) {
    try {
        const response = await makeAuthenticatedRequest(`/api/memories/${familyId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const memories = await response.json();
        displayMemories(memories);
    } catch (error) {
        console.error('Error fetching memories:', error);
    }
}

function displayMemories(memories) {
    const memoriesList = document.getElementById('memoriesList');
    
    if (memoriesList) {
        memoriesList.innerHTML = '';

        if (memories.length === 0) {
            memoriesList.innerHTML = '<p>No memories yet. Create your first memory!</p>';
            return;
        }

        memories.forEach(memory => {
            const memoryItem = createMemoryItem(memory);
            memoriesList.appendChild(memoryItem);
        });
    }

    const memoryDetails = document.getElementById('memoryDetails');
    if (memoryDetails) {
        memoryDetails.style.display = 'none';
    }
}

function createMemoryItem(memory) {
    const memoryItem = document.createElement('div');
    memoryItem.className = 'memory-item';

    fetchMemoryPreviews(memory.memory_id).then(previews => {
        const previewsHtml = generatePreviewsHtml(previews);

        memoryItem.innerHTML = `
            <div class="memory-item-info">
                <h3>${memory.title}</h3>
                <p>${memory.description.substring(0, 50)}${memory.description.length > 50 ? '...' : ''}</p>
            </div>
            <div class="memory-item-previews">
                ${previewsHtml}
            </div>
        `;

        memoryItem.addEventListener('click', () => {
            openMemoryDetails(memory);
        });
    });

    return memoryItem;
}

async function fetchMemoryPreviews(memoryId) {
    try {
        const response = await makeAuthenticatedRequest(`/api/memories/${memoryId}/content?limit=3`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching memory previews:', error);
        return [];
    }
}

function generatePreviewsHtml(previews) {
    let previewsHtml = '';
    for (let i = 0; i < Math.min(previews.length, 3); i++) {
        if (previews[i].content_type.startsWith('image')) {
            previewsHtml += `<img src="${previews[i].file_path}" alt="Preview" class="memory-item-preview">`;
        } else if (previews[i].content_type.startsWith('video')) {
            previewsHtml += `<div class="memory-item-preview" style="background-image: url('path/to/video-thumbnail.jpg');"></div>`;
        }
    }
    if (previews.length > 3) {
        previewsHtml += `<div class="memory-item-preview-count">+${previews.length - 3}</div>`;
    }
    return previewsHtml;
}

function setupEventListeners() {
    const createMemoryBtn = document.getElementById('createMemoryBtn');
    const memoryModal = document.getElementById('memoryModal');
    const createMemoryForm = document.getElementById('createMemoryForm');
    const addCommentForm = document.getElementById('addCommentForm');
    const addPhotoBtn = document.getElementById('addPhotoBtn');
    const fileInput = document.getElementById('fileInput');
    const memoryAlbum = document.getElementById('memoryAlbum');
    const closeModalBtn = document.querySelector('.close');

    if (createMemoryBtn) {
        createMemoryBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            console.log('Create memory button clicked');
            openMemoryModal();
        });
    } else {
        console.error('Create memory button not found');
    }

    if (closeModalBtn && memoryModal) {
        closeModalBtn.addEventListener('click', closeMemoryModal);
    }

    // Close modal when clicking outside of it
    if (memoryModal) {
        window.addEventListener('click', (event) => {
            if (event.target === memoryModal) {
                closeMemoryModal();
            }
        });
    }

    if (createMemoryForm) {
        createMemoryForm.addEventListener('submit', createMemory);
    }

    if (addCommentForm) {
        addCommentForm.addEventListener('submit', addCommentToMemory);
    }

    if (addPhotoBtn && fileInput) {
        addPhotoBtn.addEventListener('click', () => {
            console.log('Add Content button clicked');
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                addContentToMemory(e.target.files);
            }
        });
    }

    if (memoryAlbum) {
        memoryAlbum.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
        });

        memoryAlbum.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                addContentToMemory(files);
            }
        });
    }

    const memoriesList = document.getElementById('memoriesList');
    if (memoriesList) {
        memoriesList.addEventListener('click', (event) => {
            if (event.target.closest('.memory-item')) {
                closeSidebar();
            }
        });
    }
}

function closeMemoryModal() {
    const memoryModal = document.getElementById('memoryModal');
    if (memoryModal) {
        memoryModal.style.display = 'none';
    }
}

async function createMemory(e) {
    e.preventDefault();
    const title = document.getElementById('memoryTitle').value;
    const description = document.getElementById('memoryDescription').value;

    if (!currentFamilyId) {
        alert('Please select a family first');
        return;
    }

    try {
        const response = await makeAuthenticatedRequest('/api/memories/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ familyId: currentFamilyId, title, description })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        closeMemoryModal();
        fetchMemories(currentFamilyId);
    } catch (error) {
        console.error('Error creating memory:', error);
        alert('Failed to create memory. Please try again.');
    }
}

async function openMemoryDetails(memory) {
    closeSidebar(); // Close the sidebar when a memory is selected
    currentMemoryId = memory.memory_id;
    const memoryDetails = document.getElementById('memoryDetails');
    const memoryDetailTitle = document.getElementById('memoryDetailTitle');
    const memoryAlbum = document.getElementById('memoryAlbum');
    const memoryComments = document.getElementById('memoryComments');
    const deleteMemoryBtn = document.getElementById('deleteMemoryBtn');
    const addPhotoBtn = document.getElementById('addPhotoBtn');
    const addCommentForm = document.getElementById('addCommentForm');

    if (memoryDetailTitle) memoryDetailTitle.textContent = memory.title;
    if (memoryAlbum) memoryAlbum.innerHTML = '';
    if (memoryComments) memoryComments.innerHTML = '';

    if (deleteMemoryBtn) {
        deleteMemoryBtn.style.display = memory.is_owner ? 'block' : 'none';
        if (memory.is_owner) {
            deleteMemoryBtn.onclick = () => deleteMemory(memory.memory_id);
        }
    }

    await fetchMemoryContent(memory.memory_id);
    await fetchMemoryComments(memory.memory_id);

    if (memoryDetails) memoryDetails.style.display = 'block';
    if (addPhotoBtn) addPhotoBtn.style.display = 'block';
    if (addCommentForm) addCommentForm.style.display = 'block';
}

async function fetchMemoryContent(memoryId) {
    try {
        const response = await makeAuthenticatedRequest(`/api/memories/${memoryId}/content`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const content = await response.json();
        displayMemoryContent(content);
    } catch (error) {
        console.error('Error fetching memory content:', error);
    }
}

function displayMemoryContent(content) {
    const memoryAlbum = document.getElementById('memoryAlbum');
    if (!memoryAlbum) {
        console.error('Memory album element not found');
        return;
    }
    memoryAlbum.innerHTML = '';
    currentAlbumContent = content;

    if (content.length === 0) {
        memoryAlbum.innerHTML = '<p class="empty-album-message">No photos or videos yet. Add some!</p>';
        return;
    }

    content.forEach((item, index) => {
        const contentItem = document.createElement('div');
        contentItem.className = 'album-item';
        if (item.content_type.startsWith('image')) {
            const img = document.createElement('img');
            img.src = item.file_path;
            img.alt = "Memory content";
            img.addEventListener('click', () => openImageViewer(index));
            contentItem.appendChild(img);
        } else if (item.content_type.startsWith('video')) {
            contentItem.innerHTML = `<video src="${item.file_path}" controls></video>`;
        }
        memoryAlbum.appendChild(contentItem);
    });
}

async function fetchMemoryComments(memoryId) {
    try {
        const response = await makeAuthenticatedRequest(`/api/memories/${memoryId}/comments`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const comments = await response.json();
        displayMemoryComments(comments);
    } catch (error) {
        console.error('Error fetching memory comments:', error);
    }
}

function displayMemoryComments(comments) {
    const memoryComments = document.getElementById('memoryComments');
    if (memoryComments) {
        memoryComments.innerHTML = '';

        if (comments.length === 0) {
            memoryComments.innerHTML = '<p class="empty-comments-message">No comments yet. Be the first to share your perspective!</p>';
            return;
        }

        comments.forEach(comment => {
            const commentItem = document.createElement('div');
            commentItem.className = 'comment';
            commentItem.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.user_name}</span>
                    <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <p>${comment.comment_text}</p>
            `;
            memoryComments.appendChild(commentItem);
        });
    }
}

async function addContentToMemory(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('content', files[i]);
    }

    try {
        const response = await makeAuthenticatedRequest(`/api/memories/${currentMemoryId}/content`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchMemoryContent(currentMemoryId);
    } catch (error) {
        console.error('Error adding content to memory:', error);
        alert('Failed to add content. Please try again.');
    }
}

async function addCommentToMemory(e) {
    e.preventDefault();
    const commentText = document.getElementById('commentInput').value;

    try {
        const response = await makeAuthenticatedRequest(`/api/memories/${currentMemoryId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commentText })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await fetchMemoryComments(currentMemoryId);
        document.getElementById('commentInput').value = '';
    } catch (error) {
        console.error('Error adding comment to memory:', error);
        alert('Failed to add comment. Please try again.');
    }
}

async function deleteMemory(memoryId) {
    if (!confirm('Are you sure you want to delete this memory?')) {
        return;
    }

    try {
        const response = await makeAuthenticatedRequest(`/api/memories/${memoryId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        fetchMemories(currentFamilyId);
    } catch (error) {
        console.error('Error deleting memory:', error);
        alert('Failed to delete memory. Please try again.');
    }
}

function openImageViewer(index) {
    currentImageIndex = index;
    const imageViewerModal = document.getElementById('imageViewerModal');
    const modalImg = document.getElementById('imgModalContent');
    const captionText = document.getElementById('imgCaption');

    if (imageViewerModal && modalImg && captionText) {
        imageViewerModal.style.display = 'flex';
        updateImageViewer();
        
        // Add touch swipe functionality for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        imageViewerModal.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);
        
        imageViewerModal.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, false);
        
        function handleSwipe() {
            if (touchEndX < touchStartX) {
                showNextImage();
            }
            if (touchEndX > touchStartX) {
                showPreviousImage();
            }
        }
    }
}

function closeImageViewer() {
    const imageViewerModal = document.getElementById('imageViewerModal');
    if (imageViewerModal) {
        imageViewerModal.style.display = 'none';
    }
}

function showPreviousImage() {
    currentImageIndex = (currentImageIndex - 1 + currentAlbumContent.length) % currentAlbumContent.length;
    updateImageViewer();
}

function showNextImage() {
    currentImageIndex = (currentImageIndex + 1) % currentAlbumContent.length;
    updateImageViewer();
}

function updateImageViewer() {
    const modalImg = document.getElementById('imgModalContent');
    const captionText = document.getElementById('imgCaption');

    if (modalImg && captionText) {
        modalImg.src = currentAlbumContent[currentImageIndex].file_path;
        captionText.innerHTML = `${currentImageIndex + 1} / ${currentAlbumContent.length}`;
    }
}

function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const memoriesSidebar = document.getElementById('memoriesSidebar');
    const mobileCreateMemoryBtn = document.getElementById('mobileCreateMemoryBtn');

    if (mobileMenuBtn && memoriesSidebar) {
        mobileMenuBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent the click from immediately closing the sidebar
            memoriesSidebar.classList.toggle('show');
        });
    }

    if (mobileCreateMemoryBtn) {
        mobileCreateMemoryBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            console.log('Mobile create memory button clicked');
            if (!currentFamilyId) {
                alert('Please select a family first');
                memoriesSidebar.classList.add('show');
            } else {
                openMemoryModal();
            }
        });
    }

    // Close sidebar when clicking outside of it
    document.addEventListener('click', (event) => {
        if (memoriesSidebar && memoriesSidebar.classList.contains('show')) {
            if (!memoriesSidebar.contains(event.target) && event.target !== mobileMenuBtn) {
                closeSidebar();
            }
        }
    });
}

function closeSidebar() {
    const memoriesSidebar = document.getElementById('memoriesSidebar');
    if (memoriesSidebar) {
        memoriesSidebar.classList.remove('show');
    }
}

function openMemoryModal() {
    const memoryModal = document.getElementById('memoryModal');
    if (memoryModal) {
        memoryModal.style.display = 'block';
    }
}

