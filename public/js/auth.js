// Authentication & User Management
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication on page load
    checkAuthentication();
    
    // Setup logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

// Check if user is authenticated and redirect if necessary
function checkAuthentication() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    
    if (!token) {
        // Redirect to login page if not authenticated
        window.location.href = 'login.html';
        return;
    }
    
    // Load user data
    loadUserData();
    
    // Verify token is still valid by making a request to get user profile
    fetchUserProfile()
        .then(data => {
            // Update user data with latest from server
            updateUserData(data);
            
            // Load user's families
            loadUserFamilies();
        })
        .catch(error => {
            console.error('Authentication error:', error);
            
            // If token is invalid, try to refresh it
            refreshToken()
                .then(() => {
                    // Retry fetching profile if token refresh was successful
                    return fetchUserProfile();
                })
                .then(data => {
                    updateUserData(data);
                    loadUserFamilies();
                })
                .catch(refreshError => {
                    console.error('Failed to refresh token:', refreshError);
                    // Redirect to login if refresh failed
                    handleLogout();
                });
        });
}

// Fetch user profile from server
async function fetchUserProfile() {
    const url = formatApiUrl(CONFIG.ROUTES.DASHBOARD.PROFILE);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
}

// Load user's families
async function loadUserFamilies() {
    const url = formatApiUrl(CONFIG.ROUTES.DASHBOARD.USER_FAMILIES);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user families');
        }
        
        const data = await response.json();
        
        // Store families in localStorage
        const userData = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || '{}');
        userData.families = data;
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(userData));
        
        // Populate family selector dropdown
        populateFamilySelector(data);
        
        // Select default family
        if (data.length > 0) {
            const selectedFamilyId = localStorage.getItem(CONFIG.FAMILY_KEY) || data[0].family_id;
            
            // Check if the saved family is still valid
            const validFamily = data.find(f => f.family_id == selectedFamilyId);
            
            if (validFamily) {
                selectFamily(selectedFamilyId);
            } else if (data.length > 0) {
                // Select first family if saved family no longer exists
                selectFamily(data[0].family_id);
            }
        }
    } catch (error) {
        console.error('Error loading user families:', error);
        // Handle error - maybe show message to user
    }
}

// Populate family selector dropdown
function populateFamilySelector(families) {
    const selector = document.getElementById('family-select');
    
    if (!selector) return;
    
    // Clear existing options except the default one
    while (selector.options.length > 1) {
        selector.remove(1);
    }
    
    // Add family options
    families.forEach(family => {
        const option = document.createElement('option');
        option.value = family.family_id;
        option.textContent = family.family_name;
        selector.appendChild(option);
    });
    
    // Select the currently active family
    const currentFamily = localStorage.getItem(CONFIG.FAMILY_KEY);
    if (currentFamily) {
        selector.value = currentFamily;
    } else if (families.length > 0) {
        selector.value = families[0].family_id;
    }
    
    // Add event listener for family selection change
    selector.addEventListener('change', function() {
        selectFamily(this.value);
    });
}

// Select a family and update UI
function selectFamily(familyId) {
    localStorage.setItem(CONFIG.FAMILY_KEY, familyId);
    
    // Update family selector
    const selector = document.getElementById('family-select');
    if (selector) {
        selector.value = familyId;
    }
    
    // Dispatch event to notify other components
    const event = new CustomEvent('familyChanged', { detail: { familyId } });
    document.dispatchEvent(event);
}

// Load user data from localStorage
function loadUserData() {
    const userData = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || '{}');
    
    // Update UI with user data
    const userNameElement = document.getElementById('user-name');
    const userAvatarElement = document.getElementById('user-avatar');
    const postUserAvatarElement = document.getElementById('post-user-avatar');
    
    if (userNameElement && userData.name) {
        userNameElement.textContent = userData.name;
    }
    
    if (userAvatarElement) {
        userAvatarElement.src = userData.profile_image || CONFIG.DEFAULT_IMAGES.AVATAR;
    }
    
    if (postUserAvatarElement) {
        postUserAvatarElement.src = userData.profile_image || CONFIG.DEFAULT_IMAGES.AVATAR;
    }
}

// Update user data in localStorage
function updateUserData(data) {
    const userData = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || '{}');
    
    // Merge new data with existing
    const updatedData = { ...userData, ...data };
    
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(updatedData));
    
    // Update UI with new data
    loadUserData();
}

// Refresh authentication token
async function refreshToken() {
    const url = formatApiUrl(CONFIG.ROUTES.AUTH.REFRESH_TOKEN);
    const refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        });
        
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        
        const data = await response.json();
        
        // Save new tokens
        localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
        
        if (data.refreshToken) {
            localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, data.refreshToken);
        }
        
        return data;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

// Handle user logout
function handleLogout(event) {
    if (event) {
        event.preventDefault();
    }
    
    // Clear user data from localStorage
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.REFRESH_TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.FAMILY_KEY);
    
    // Redirect to login page
    window.location.href = 'login.html';
}