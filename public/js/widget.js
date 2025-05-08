// Widgets Functionality - Events, Members, and Memories
document.addEventListener('DOMContentLoaded', () => {
    // Initialize widget links
    initializeWidgetLinks();
    
    // Listen for family change events
    document.addEventListener('familyChanged', (event) => {
        const familyId = event.detail.familyId;
        refreshWidgets(familyId);
    });
});

// Initialize widget links
function initializeWidgetLinks() {
    // Calendar widget link
    const calendarViewAll = document.querySelector('.widget-header a[href="#"]');
    if (calendarViewAll) {
        calendarViewAll.addEventListener('click', (e) => {
            e.preventDefault();
            const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
            if (familyId) {
                window.location.href = `calendar.html?familyId=${familyId}`;
            }
        });
    }
    
    // Family members widget link
    const membersViewAll = document.querySelectorAll('.widget-header a[href="#"]')[1];
    if (membersViewAll) {
        membersViewAll.addEventListener('click', (e) => {
            e.preventDefault();
            const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
            if (familyId) {
                window.location.href = `family.html?familyId=${familyId}`;
            }
        });
    }
    
    // Memories widget link
    const memoriesViewAll = document.querySelectorAll('.widget-header a[href="#"]')[2];
    if (memoriesViewAll) {
        memoriesViewAll.addEventListener('click', (e) => {
            e.preventDefault();
            const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
            if (familyId) {
                window.location.href = `memories.html?familyId=${familyId}`;
            }
        });
    }
}

// Refresh all widgets
function refreshWidgets(familyId) {
    refreshUpcomingEvents(familyId);
    refreshFamilyMembers(familyId);
    refreshRecentMemories(familyId);
}

// Refresh upcoming events widget
async function refreshUpcomingEvents(familyId) {
    const eventsWidget = document.getElementById('events-widget');
    
    if (!eventsWidget) return;
    
    // Show loading state
    eventsWidget.innerHTML = '<div class="loading-widget"><div class="spinner"></div></div>';
    
    try {
        const url = formatApiUrl(CONFIG.ROUTES.DASHBOARD.CALENDAR, { familyId });
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }
        
        const events = await response.json();
        
        if (events.length === 0) {
            eventsWidget.innerHTML = '<p class="empty-widget">No upcoming events</p>';
            return;
        }
        
        // Render upcoming events
        eventsWidget.innerHTML = '';
        
        // Only show up to 3 events in the widget
        const upcomingEvents = events.slice(0, 3);
        
        upcomingEvents.forEach(event => {
            const eventDate = new Date(event.event_date);
            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';
            
            eventItem.innerHTML = `
                <div class="event-date">
                    <div class="day">${eventDate.getDate()}</div>
                    <div class="month">${eventDate.toLocaleString('default', { month: 'short' })}</div>
                </div>
                <div class="event-details">
                    <h4>${event.title}</h4>
                    <p>${truncateText(event.description || 'No description', 50)}</p>
                </div>
            `;
            
            eventsWidget.appendChild(eventItem);
        });
        
        // Show count if there are more events
        if (events.length > 3) {
            const moreEvents = document.createElement('p');
            moreEvents.className = 'more-items';
            moreEvents.textContent = `+ ${events.length - 3} more events`;
            eventsWidget.appendChild(moreEvents);
        }
    } catch (error) {
        console.error('Error loading upcoming events:', error);
        eventsWidget.innerHTML = '<p class="error-widget">Could not load events</p>';
    }
}

// Refresh family members widget
async function refreshFamilyMembers(familyId) {
    const membersWidget = document.getElementById('members-widget');
    
    if (!membersWidget) return;
    
    // Show loading state
    membersWidget.innerHTML = '<div class="loading-widget"><div class="spinner"></div></div>';
    
    try {
        const url = formatApiUrl(CONFIG.ROUTES.DASHBOARD.FAMILY_MEMBERS, { familyId });
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch family members');
        }
        
        const members = await response.json();
        
        if (members.length === 0) {
            membersWidget.innerHTML = '<p class="empty-widget">No family members found</p>';
            return;
        }
        
        // Render family members
        membersWidget.innerHTML = '';
        
        // Only show up to 5 members in the widget
        const displayMembers = members.slice(0, 5);
        
        displayMembers.forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'member-item';
            
            memberItem.innerHTML = `
                <div class="member-avatar">
                    <img src="${member.profile_image || CONFIG.DEFAULT_IMAGES.AVATAR}" alt="${member.name}">
                </div>
                <div class="member-info">
                    <h4>${member.name}</h4>
                    <p>${member.email}</p>
                </div>
            `;
            
            membersWidget.appendChild(memberItem);
        });
        
        // Show count if there are more members
        if (members.length > 5) {
            const moreMembers = document.createElement('p');
            moreMembers.className = 'more-items';
            moreMembers.textContent = `+ ${members.length - 5} more members`;
            membersWidget.appendChild(moreMembers);
        }
    } catch (error) {
        console.error('Error loading family members:', error);
        membersWidget.innerHTML = '<p class="error-widget">Could not load family members</p>';
    }
}

// Refresh recent memories widget
async function refreshRecentMemories(familyId) {
    const memoriesWidget = document.getElementById('memories-widget');
    
    if (!memoriesWidget) return;
    
    // Show loading state
    memoriesWidget.innerHTML = '<div class="loading-widget"><div class="spinner"></div></div>';
    
    try {
        const url = formatApiUrl(CONFIG.ROUTES.MEMORIES.LIST, { familyId });
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch memories');
        }
        
        const memories = await response.json();
        
        if (memories.length === 0) {
            memoriesWidget.innerHTML = '<p class="empty-widget">No memories found</p>';
            return;
        }
        
        // Render memories grid
        memoriesWidget.innerHTML = '<div class="memory-grid"></div>';
        const memoryGrid = memoriesWidget.querySelector('.memory-grid');
        
        // Only show up to 6 memories in the widget
        const recentMemories = memories.slice(0, 6);
        
        recentMemories.forEach(memory => {
            const previewImage = memory.preview_images && memory.preview_images.length > 0
                ? memory.preview_images[0]
                : CONFIG.DEFAULT_IMAGES.POST_PLACEHOLDER;
                
            const memoryItem = document.createElement('div');
            memoryItem.className = 'memory-item';
            memoryItem.dataset.id = memory.memory_id;
            
            memoryItem.innerHTML = `<img src="${previewImage}" alt="${memory.title}">`;
            
            // Navigate to memory detail page when clicked
            memoryItem.addEventListener('click', () => {
                window.location.href = `memory-detail.html?memoryId=${memory.memory_id}`;
            });
            
            memoryGrid.appendChild(memoryItem);
        });
    } catch (error) {
        console.error('Error loading memories:', error);
        memoriesWidget.innerHTML = '<p class="error-widget">Could not load memories</p>';
    }
}

// Add toast notification functionality
function showWidgetNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `widget-notification ${type}`;
    notification.innerHTML = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// Handle memory creation
function createMemory(title, description, familyId) {
    return new Promise(async (resolve, reject) => {
        try {
            const url = formatApiUrl(CONFIG.ROUTES.MEMORIES.CREATE);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    description,
                    familyId
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create memory');
            }
            
            const result = await response.json();
            resolve(result);
        } catch (error) {
            console.error('Error creating memory:', error);
            reject(error);
        }
    });
}

// Handle event creation
function createEvent(eventData) {
    return new Promise(async (resolve, reject) => {
        try {
            const url = formatApiUrl('/dashboard/calendar');
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to create event');
            }
            
            const result = await response.json();
            resolve(result);
        } catch (error) {
            console.error('Error creating event:', error);
            reject(error);
        }
    });
}

// Format date for display
function formatEventDate(dateString) {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
        return 'Invalid date';
    }
    
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // Format time as AM/PM
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    
    return `${month} ${day}, ${year} at ${formattedHours}:${formattedMinutes} ${ampm}`;
}