// Main Dashboard Functionality
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI components
  initializeSidebar();
  initializeNotifications();
  
  // Set up responsive behavior
  setupResponsiveLayout();
  
  // Handle family change events
  document.addEventListener('familyChanged', (event) => {
      const familyId = event.detail.familyId;
      // Reload data based on selected family
      loadFamilyData(familyId);
  });

  // Initial load with current family
  const currentFamilyId = localStorage.getItem(CONFIG.FAMILY_KEY);
  if (currentFamilyId) {
      loadFamilyData(currentFamilyId);
  }
});

// Initialize sidebar functionality
function initializeSidebar() {
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (mobileMenuToggle && sidebar) {
      mobileMenuToggle.addEventListener('click', () => {
          sidebar.classList.toggle('active');
      });
      
      // Close sidebar when clicking outside on mobile
      document.addEventListener('click', (event) => {
          if (window.innerWidth <= 768 && 
              sidebar.classList.contains('active') && 
              !sidebar.contains(event.target) && 
              !mobileMenuToggle.contains(event.target)) {
              sidebar.classList.remove('active');
          }
      });
  }
  
  // Handle active navigation items
  const navLinks = document.querySelectorAll('.nav-links li a');
  navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
          // If this is a single-page app with sections, you'd prevent default
          // e.preventDefault();
          
          // Remove active class from all links
          navLinks.forEach(l => l.parentElement.classList.remove('active'));
          
          // Add active class to clicked link
          this.parentElement.classList.add('active');
      });
  });
}

// Initialize notifications panel
function initializeNotifications() {
  const notificationsBtn = document.querySelector('.notifications-btn');
  const notificationsPanel = document.querySelector('.notifications-panel');
  const markAllReadBtn = document.getElementById('mark-all-read');
  
  if (notificationsBtn && notificationsPanel) {
      // Toggle notifications panel
      notificationsBtn.addEventListener('click', () => {
          notificationsPanel.style.display = notificationsPanel.style.display === 'block' ? 'none' : 'block';
          
          // Load notifications when panel is opened
          if (notificationsPanel.style.display === 'block') {
              loadNotifications();
          }
      });
      
      // Close notifications panel when clicking outside
      document.addEventListener('click', (event) => {
          if (!notificationsBtn.contains(event.target) && 
              !notificationsPanel.contains(event.target) && 
              notificationsPanel.style.display === 'block') {
              notificationsPanel.style.display = 'none';
          }
      });
      
      // Mark all notifications as read
      if (markAllReadBtn) {
          markAllReadBtn.addEventListener('click', () => {
              markAllNotificationsAsRead();
          });
      }
  }
}

// Load notifications from server
async function loadNotifications() {
  const url = formatApiUrl(CONFIG.ROUTES.NOTIFICATIONS.GET);
  const notificationsList = document.querySelector('.notifications-list');
  const notificationBadge = document.querySelector('.notification-badge');
  
  if (!notificationsList) return;
  
  try {
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      
      // Clear existing notifications
      notificationsList.innerHTML = '';
      
      if (data.unread && data.unread.length > 0) {
          // Update notification badge
          if (notificationBadge) {
              notificationBadge.textContent = data.unread.length;
              notificationBadge.style.display = 'flex';
          }
          
          // Render notifications
          data.recent.forEach(notification => {
              const notificationItem = document.createElement('div');
              notificationItem.className = `notification-item ${notification.read ? '' : 'unread'}`;
              notificationItem.dataset.id = notification.id;
              
              notificationItem.innerHTML = `
                  <div class="notification-content">${notification.formatted_content || notification.content}</div>
                  <div class="notification-time">${timeAgo(notification.created_at)}</div>
              `;
              
              // Mark notification as read when clicked
              notificationItem.addEventListener('click', () => {
                  if (!notification.read) {
                      markNotificationAsRead(notification.id);
                      notificationItem.classList.remove('unread');
                  }
                  
                  // Handle notification action (e.g. navigate to relevant page)
                  handleNotificationAction(notification);
              });
              
              notificationsList.appendChild(notificationItem);
          });
      } else {
          // Hide badge if no unread notifications
          if (notificationBadge) {
              notificationBadge.style.display = 'none';
          }
          
          // Show empty state
          notificationsList.innerHTML = `
              <div class="empty-notifications">
                  <i class="fas fa-check-circle"></i>
                  <p>You're all caught up!</p>
              </div>
          `;
      }
  } catch (error) {
      console.error('Error loading notifications:', error);
      notificationsList.innerHTML = `
          <div class="empty-notifications">
              <i class="fas fa-exclamation-circle"></i>
              <p>Could not load notifications</p>
          </div>
      `;
  }
}

// Mark a single notification as read
async function markNotificationAsRead(notificationId) {
  const url = formatApiUrl(CONFIG.ROUTES.NOTIFICATIONS.READ, { id: notificationId });
  
  try {
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to mark notification as read');
      }
      
      // Update unread count
      const notificationBadge = document.querySelector('.notification-badge');
      if (notificationBadge) {
          const currentCount = parseInt(notificationBadge.textContent, 10);
          if (currentCount > 1) {
              notificationBadge.textContent = currentCount - 1;
          } else {
              notificationBadge.style.display = 'none';
          }
      }
  } catch (error) {
      console.error('Error marking notification as read:', error);
  }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
  const url = formatApiUrl(CONFIG.ROUTES.NOTIFICATIONS.READ_ALL);
  
  try {
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
              'Content-Type': 'application/json'
          }
      });
      
      if (!response.ok) {
          throw new Error('Failed to mark all notifications as read');
      }
      
      // Update UI
      const notificationItems = document.querySelectorAll('.notification-item.unread');
      notificationItems.forEach(item => {
          item.classList.remove('unread');
      });
      
      // Hide badge
      const notificationBadge = document.querySelector('.notification-badge');
      if (notificationBadge) {
          notificationBadge.style.display = 'none';
      }
  } catch (error) {
      console.error('Error marking all notifications as read:', error);
  }
}

// Handle notification action
function handleNotificationAction(notification) {
  // Determine action based on notification type
  switch(notification.type) {
      case 'like':
      case 'comment':
          if (notification.post_id) {
              // Navigate to post or open post modal
              openPostDetails(notification.post_id);
          }
          break;
      case 'memory':
          if (notification.memory_id) {
              // Navigate to memory detail page
              window.location.href = `memory-detail.html?memoryId=${notification.memory_id}`;
          }
          break;
      case 'event':
          if (notification.family_id) {
              // Navigate to calendar page
              window.location.href = `calendar.html?familyId=${notification.family_id}`;
          }
          break;
      default:
          // Close notification panel by default
          document.querySelector('.notifications-panel').style.display = 'none';
  }
}

// Set up responsive layout
function setupResponsiveLayout() {
  // Handle window resize
  window.addEventListener('resize', () => {
      adjustLayoutForScreenSize();
  });
  
  // Initial layout adjustment
  adjustLayoutForScreenSize();
}

// Adjust layout based on screen size
function adjustLayoutForScreenSize() {
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (!sidebar || !mainContent) return;
  
  if (window.innerWidth <= 768) {
      // Mobile layout
      sidebar.classList.remove('active');
      document.documentElement.style.setProperty('--sidebar-width', '0px');
      mainContent.style.marginLeft = '0';
  } else {
      // Desktop layout
      document.documentElement.style.setProperty('--sidebar-width', '240px');
      mainContent.style.marginLeft = '240px';
  }
}

// Load family data based on selected family
function loadFamilyData(familyId) {
  // Load family members for the sidebar
  loadFamilyMembers(familyId);
  
  // Load upcoming events
  loadUpcomingEvents(familyId);
  
  // Load family feed
  // This is handled by the social-feed.js
  
  // Load recent memories
  loadRecentMemories(familyId);
}

// Load family members for widget
async function loadFamilyMembers(familyId) {
  const url = formatApiUrl(CONFIG.ROUTES.DASHBOARD.FAMILY_MEMBERS, { familyId });
  const membersWidget = document.getElementById('members-widget');
  
  if (!membersWidget) return;
  
  // Show loading state
  membersWidget.innerHTML = '<div class="loading-widget"><div class="spinner"></div></div>';
  
  try {
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

// Load upcoming events for widget
async function loadUpcomingEvents(familyId) {
  const url = formatApiUrl(CONFIG.ROUTES.DASHBOARD.CALENDAR, { familyId });
  const eventsWidget = document.getElementById('events-widget');
  
  if (!eventsWidget) return;
  
  // Show loading state
  eventsWidget.innerHTML = '<div class="loading-widget"><div class="spinner"></div></div>';
  
  try {
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

// Load recent memories for widget
async function loadRecentMemories(familyId) {
  const url = formatApiUrl(CONFIG.ROUTES.MEMORIES.LIST, { familyId });
  const memoriesWidget = document.getElementById('memories-widget');
  
  if (!memoriesWidget) return;
  
  // Show loading state
  memoriesWidget.innerHTML = '<div class="loading-widget"><div class="spinner"></div></div>';
  
  try {
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