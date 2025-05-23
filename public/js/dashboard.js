document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('famlynook_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Initialize dashboard
    initializeDashboard();
    loadUserInfo();
    loadCalendar();
    setupEventListeners();
});

let currentDate = new Date();
let events = [];

function initializeDashboard() {
    // Set default active tab
    showTab('calendar');
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = e.target.closest('.nav-link').dataset.tab;
            showTab(tab);
        });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Modals
    document.getElementById('add-event-btn').addEventListener('click', () => showModal('event-modal'));
    document.getElementById('new-post-btn').addEventListener('click', () => showModal('post-modal'));
    document.getElementById('invite-member-btn').addEventListener('click', () => showTab('invite'));

    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            hideModal(modal.id);
        });
    });

    // Forms
    document.getElementById('event-form').addEventListener('submit', createEvent);
    document.getElementById('post-form').addEventListener('submit', createPost);
    document.getElementById('invite-form').addEventListener('submit', sendInvite);
}

function showTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Load tab-specific content
    switch(tabName) {
        case 'calendar':
            loadCalendar();
            break;
        case 'family':
            loadFamilyMembers();
            break;
        case 'feed':
            window.location.href = 'feed.html';
            break;
        case 'invite':
            loadPendingInvites();
            break;
    }
}

async function loadUserInfo() {
    try {
        // Try to get user data from localStorage first
        const userData = localStorage.getItem('famlynook_user');
        if (userData) {
            const user = JSON.parse(userData);
            document.getElementById('user-name').textContent = `Welcome, ${user.name}`;
            return;
        }

        // Fallback to API call if no user data in localStorage
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });

        if (response.ok) {
            const user = await response.json();
            document.getElementById('user-name').textContent = `Welcome, ${user.name}`;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

function loadCalendar() {
    renderCalendar();
    loadEvents();
}

function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    
    document.getElementById('current-month').textContent = 
        `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const calendarDates = document.getElementById('calendar-dates');
    calendarDates.innerHTML = '';

    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();
        
        if (date.getMonth() !== currentDate.getMonth()) {
            dayElement.classList.add('other-month');
        }
        
        if (date.toDateString() === new Date().toDateString()) {
            dayElement.classList.add('today');
        }

        // Add events for this day
        const dayEvents = events.filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate.toDateString() === date.toDateString();
        });

        if (dayEvents.length > 0) {
            dayElement.classList.add('has-events');
            dayElement.title = dayEvents.map(e => e.title).join(', ');
        }

        calendarDates.appendChild(dayElement);
    }
}

async function loadEvents() {
    try {
        const response = await fetch('/api/calendar/events', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            }
        });

        if (response.ok) {
            events = await response.json();
            renderCalendar();
            renderUpcomingEvents();
        }
    } catch (error) {
        console.error('Error loading events:', error);
        showNotification('Error loading events', 'error');
    }
}

function renderUpcomingEvents() {
    const eventsList = document.getElementById('events-list');
    const now = new Date();
    const upcomingEvents = events
        .filter(event => new Date(event.startDate) >= now)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
        .slice(0, 5);

    if (upcomingEvents.length === 0) {
        eventsList.innerHTML = '<p class="no-events">No upcoming events</p>';
        return;
    }

    eventsList.innerHTML = upcomingEvents.map(event => `
        <div class="event-item">
            <div class="event-date">
                ${new Date(event.startDate).toLocaleDateString()}
            </div>
            <div class="event-details">
                <h4>${event.title}</h4>
                <p>${event.description || 'No description'}</p>
            </div>
        </div>
    `).join('');
}

async function createEvent(e) {
    e.preventDefault();
    
    const eventData = {
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-description').value,
        startDate: document.getElementById('event-start').value,
        endDate: document.getElementById('event-end').value
    };

    try {
        const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('famlynook_token')}`
            },
            body: JSON.stringify(eventData)
        });

        if (response.ok) {
            hideModal('event-modal');
            document.getElementById('event-form').reset();
            loadEvents();
            showNotification('Event created successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to create event', 'error');
        }
    } catch (error) {
        console.error('Error creating event:', error);
        showNotification('Error creating event', 'error');
    }
}

function loadFamilyMembers() {
    // Mock family members data - replace with actual API call
    const familyMembers = [
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', avatar: '/api/placeholder/50/50' },
        { id: 2, name: 'Jane Doe', email: 'jane@example.com', role: 'Member', avatar: '/api/placeholder/50/50' },
        { id: 3, name: 'Kid Doe', email: 'kid@example.com', role: 'Member', avatar: '/api/placeholder/50/50' }
    ];

    const membersContainer = document.getElementById('family-members');
    membersContainer.innerHTML = familyMembers.map(member => `
        <div class="family-member">
            <img src="${member.avatar}" alt="${member.name}" class="member-avatar">
            <div class="member-info">
                <h4>${member.name}</h4>
                <p>${member.email}</p>
                <span class="member-role">${member.role}</span>
            </div>
        </div>
    `).join('');
}

function loadFeed() {
    // Mock feed data - replace with actual API call
    const feedPosts = [
        {
            id: 1,
            author: 'Jane Doe',
            content: 'Just finished soccer practice with the kids! Great game today.',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
            avatar: '/api/placeholder/40/40'
        },
        {
            id: 2,
            author: 'John Doe',
            content: 'Planning our weekend family trip to the mountains. Can\'t wait!',
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
            avatar: '/api/placeholder/40/40'
        }
    ];

    const feedContainer = document.getElementById('feed-posts');
    feedContainer.innerHTML = feedPosts.map(post => `
        <div class="feed-post">
            <div class="post-header">
                <img src="${post.avatar}" alt="${post.author}" class="post-avatar">
                <div class="post-meta">
                    <h4>${post.author}</h4>
                    <span class="post-time">${formatTimeAgo(post.timestamp)}</span>
                </div>
            </div>
            <div class="post-content">
                <p>${post.content}</p>
            </div>
        </div>
    `).join('');
}

function loadPendingInvites() {
    // Mock pending invites - replace with actual API call
    const pendingInvites = [
        { id: 1, email: 'grandma@example.com', name: 'Grandma', role: 'Member', sentDate: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        { id: 2, email: 'uncle@example.com', name: 'Uncle Bob', role: 'Member', sentDate: new Date(Date.now() - 48 * 60 * 60 * 1000) }
    ];

    const invitesList = document.getElementById('pending-invites-list');
    if (pendingInvites.length === 0) {
        invitesList.innerHTML = '<p class="no-invites">No pending invitations</p>';
        return;
    }

    invitesList.innerHTML = pendingInvites.map(invite => `
        <div class="pending-invite">
            <div class="invite-info">
                <h4>${invite.name}</h4>
                <p>${invite.email}</p>
                <span class="invite-role">${invite.role}</span>
                <span class="invite-date">Sent ${formatTimeAgo(invite.sentDate)}</span>
            </div>
            <button class="btn btn-secondary" onclick="resendInvite(${invite.id})">Resend</button>
        </div>
    `).join('');
}

async function sendInvite(e) {
    e.preventDefault();
    
    const inviteData = {
        email: document.getElementById('invite-email').value,
        name: document.getElementById('invite-name').value,
        role: document.getElementById('invite-role').value
    };

    // Mock API call - replace with actual implementation
    try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        document.getElementById('invite-form').reset();
        loadPendingInvites();
        showNotification('Invitation sent successfully!', 'success');
    } catch (error) {
        console.error('Error sending invite:', error);
        showNotification('Error sending invitation', 'error');
    }
}

async function createPost(e) {
    e.preventDefault();
    
    const content = document.getElementById('post-content').value;
    
    // Mock API call - replace with actual implementation
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        hideModal('post-modal');
        document.getElementById('post-form').reset();
        loadFeed();
        showNotification('Post created successfully!', 'success');
    } catch (error) {
        console.error('Error creating post:', error);
        showNotification('Error creating post', 'error');
    }
}

function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function logout() {
    localStorage.removeItem('famlynook_token');
    localStorage.removeItem('famlynook_user');
    localStorage.removeItem('famlynook_family');
    window.location.href = '/';
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function resendInvite(inviteId) {
    // Mock resend functionality
    showNotification('Invitation resent successfully!', 'success');
}