// Function to fetch user profile
async function fetchUserProfile() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found');
        }

        const response = await fetch('/api/dashboard/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Response status:', response.status);
            console.error('Response body:', errorBody);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const user = await response.json();
        return user;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

// Function to update UI with user data
function updateUserProfile(user) {
    if (user) {
        document.getElementById('userAvatar').textContent = user.name.charAt(0);
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userEmail').textContent = user.email;
    } else {
        document.getElementById('userProfile').innerHTML = '<p>Failed to load user profile</p>';
    }
}

// Main function to initialize the dashboard
async function initDashboard() {
    const user = await fetchUserProfile();
    updateUserProfile(user);

    // Existing code for other sections (calendar, social feed, member list)
    // Family Calendar
    const calendarGrid = document.getElementById('calendarGrid');
    for (let i = 1; i <= 31; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = i;
        calendarGrid.appendChild(day);
    }

    // Family Social Feed
    const socialFeedContent = document.getElementById('socialFeedContent');
    posts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'social-post';
        postElement.innerHTML = `<strong>${post.author}</strong><br>${post.content}`;
        socialFeedContent.appendChild(postElement);
    });

    // Member List
    const memberListContent = document.getElementById('memberListContent');
    members.forEach(member => {
        const memberItem = document.createElement('li');
        memberItem.className = 'member-item';
        memberItem.innerHTML = `
            <div class="member-avatar">${member.name.charAt(0)}</div>
            <span>${member.name}</span>
        `;
        memberListContent.appendChild(memberItem);
    });
}

// Call the init function when the page loads
document.addEventListener('DOMContentLoaded', initDashboard);