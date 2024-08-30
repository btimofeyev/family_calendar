document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    fetchUserFamilies();
    setupEventListeners();
    initializeNotifications();
    checkForTargetMemory();
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

async function fetchUserFamilies() {
    try {
        const response = await makeAuthenticatedRequest('/api/dashboard/user/families');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const families = await response.json();
        updateFamilySelector(families);
    } catch (error) {
        console.error('Error fetching user families:', error);
    }
}

function updateFamilySelector(families) {
    const familySelector = document.getElementById('familySelector');
    const mobileFamilySelector = document.getElementById('mobileFamilySelector');
    
    if (familySelector && mobileFamilySelector) {
        const selectHTML = '<select id="familySelect"><option value="">Select a family</option></select>';
        familySelector.innerHTML = selectHTML;
        mobileFamilySelector.innerHTML = selectHTML;

        const desktopSelect = familySelector.querySelector('select');
        const mobileSelect = mobileFamilySelector.querySelector('select');

        families.forEach(family => {
            const option = document.createElement('option');
            option.value = family.family_id;
            option.textContent = family.family_name;
            desktopSelect.appendChild(option.cloneNode(true));
            mobileSelect.appendChild(option);
        });

        [desktopSelect, mobileSelect].forEach(select => {
            select.addEventListener('change', (e) => {
                currentFamilyId = e.target.value;
                if (currentFamilyId) {
                    fetchMemories(currentFamilyId);
                }
            });
        });
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
    const mobileMemoriesList = document.getElementById('mobileMemoriesList');
    const memoryDetails = document.getElementById('memoryDetails');
    
    [memoriesList, mobileMemoriesList].forEach(list => {
        if (list) {
            list.innerHTML = '';

            if (memories.length === 0) {
                list.innerHTML = '<p>No memories yet. Create your first memory!</p>';
                return;
            }

            memories.forEach(memory => {
                const memoryItem = createMemoryItem(memory);
                list.appendChild(memoryItem);
            });
        }
    });

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
            if (window.innerWidth <= 768) {
                toggleMobileMenu(); // Close mobile menu after selecting a memory
            }
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
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

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

    if (closeModalBtn) {
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

    if (mobileMenuBtn && mobileMenu) {
        console.log('Mobile menu button found:', mobileMenuBtn);
        mobileMenuBtn.addEventListener('click', (e) => {
            console.log('Mobile menu button clicked');
            e.preventDefault();
            e.stopPropagation();
            toggleMobileMenu();
        });
    } else {
        console.error('Mobile menu button or menu not found');
    }

    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', toggleMobileMenu);
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', toggleMobileMenu);
    }

    // Close mobile menu when clicking outside
    if (mobileMenu) {
        document.addEventListener('click', (event) => {
            if (mobileMenu.classList.contains('open') && 
                !mobileMenu.contains(event.target) && 
                event.target !== mobileMenuBtn) {
                toggleMobileMenu();
            }
        });
    }
}

function openMemoryModal() {
    const memoryModal = document.getElementById('memoryModal');
    if (memoryModal) {
        memoryModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    } else {
        console.error('Memory modal not found');
    }
}

function closeMemoryModal() {
    const memoryModal = document.getElementById('memoryModal');
    memoryModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
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
        modalImg.src = currentAlbumContent[index].file_path;
        captionText.innerHTML = `Image ${index + 1} of ${currentAlbumContent.length}`;
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
        captionText.innerHTML = `Image ${currentImageIndex + 1} of ${currentAlbumContent.length}`;
    }
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('mobileMenuOverlay');
    const body = document.body;

    mobileMenu.classList.toggle('open');
    overlay.classList.toggle('active');
    body.classList.toggle('menu-open');
}
