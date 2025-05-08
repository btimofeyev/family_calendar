// Letter Avatar Generator
// This file generates colorful letter avatars based on user names

// Array of background colors for avatars
const avatarColors = [
    '#4361ee', // Primary blue
    '#3a0ca3', // Primary dark
    '#7209b7', // Purple
    '#f72585', // Pink
    '#4cc9f0', // Light blue
    '#4895ef', // Sky blue
    '#560bad', // Deep purple
    '#f3722c', // Orange
    '#f8961e', // Light orange
    '#43aa8b', // Teal
    '#277da1', // Deep blue
    '#577590', // Steel blue
];

/**
 * Generate a letter avatar SVG as a data URL
 * @param {string} name - User name to generate avatar from
 * @param {number} size - Size of the avatar (default: 200)
 * @returns {string} SVG data URL
 */
function generateLetterAvatar(name, size = 200) {
    // Default to a question mark if no name is provided
    if (!name || typeof name !== 'string') {
        name = '?';
    }
    
    // Extract initials (up to 2 characters)
    const initials = name
        .split(' ')
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
    
    // Generate a consistent color based on the name
    const colorIndex = Math.abs(hashCode(name)) % avatarColors.length;
    const backgroundColor = avatarColors[colorIndex];
    
    // Create SVG
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <rect width="100%" height="100%" fill="${backgroundColor}" />
            <text x="50%" y="50%" dy=".1em" 
                  fill="white" 
                  font-family="Arial, sans-serif" 
                  font-size="${size * 0.4}" 
                  font-weight="bold" 
                  text-anchor="middle" 
                  dominant-baseline="middle">${initials}</text>
        </svg>
    `;
    
    // Convert to data URL
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

/**
 * Generate letter avatar for family
 * @param {string} familyName - Family name 
 * @param {number} size - Size of the avatar
 * @returns {string} SVG data URL
 */
function generateFamilyAvatar(familyName, size = 200) {
    // Same as letter avatar but with a different style
    if (!familyName || typeof familyName !== 'string') {
        familyName = 'Family';
    }
    
    // Get first letter of family name
    const initial = familyName.charAt(0).toUpperCase();
    
    // Generate consistent color
    const colorIndex = Math.abs(hashCode(familyName)) % avatarColors.length;
    const backgroundColor = avatarColors[colorIndex];
    
    // Create SVG with a house-like icon in the background
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <rect width="100%" height="100%" fill="${backgroundColor}" />
            <text x="50%" y="57%" dy=".1em" 
                  fill="white" 
                  font-family="Arial, sans-serif" 
                  font-size="${size * 0.5}" 
                  font-weight="bold" 
                  text-anchor="middle" 
                  dominant-baseline="middle">${initial}</text>
            <path d="M${size * 0.2},${size * 0.65} L${size * 0.5},${size * 0.35} L${size * 0.8},${size * 0.65} L${size * 0.8},${size * 0.85} L${size * 0.2},${size * 0.85} Z" 
                  fill="none" 
                  stroke="white" 
                  stroke-width="${size * 0.04}" 
                  stroke-opacity="0.5" />
        </svg>
    `;
    
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

/**
 * Simple string hash function
 * @param {string} str - String to hash
 * @returns {number} Hash code
 */
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Set letter avatar for all user avatar images
 */
function setLetterAvatars() {
    // Find all images with data-name attribute or with default avatar src
    const avatarImages = document.querySelectorAll('img[data-name], img[src*="default-avatar"]');
    
    avatarImages.forEach(img => {
        const name = img.dataset.name || getUserNameFromContext(img);
        if (name) {
            img.src = generateLetterAvatar(name);
            // Remove the data-name attribute to prevent regeneration
            img.removeAttribute('data-name');
        }
    });
    
    // Find all family avatars
    const familyImages = document.querySelectorAll('img[data-family-name], img[src*="default-family"]');
    
    familyImages.forEach(img => {
        const familyName = img.dataset.familyName || 'Family';
        img.src = generateFamilyAvatar(familyName);
        // Remove the data-family-name attribute to prevent regeneration
        img.removeAttribute('data-family-name');
    });
}

/**
 * Try to get user name from context (parent elements)
 * @param {HTMLElement} imgElement - Image element
 * @returns {string} User name or empty string
 */
function getUserNameFromContext(imgElement) {
    // Try to find name in parent elements with class containing 'user-name', 'author-name', etc.
    const parent = imgElement.closest('.user-info, .post-author, .member-item, .comment-item');
    if (parent) {
        const nameElement = parent.querySelector('.user-name, h4, .author-name, .comment-author');
        if (nameElement) {
            return nameElement.textContent.trim();
        }
    }
    
    // If we can't find the name, try to get it from localStorage
    try {
        const userData = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || '{}');
        if (userData.name) {
            return userData.name;
        }
    } catch (e) {
        // Ignore localStorage errors
    }
    
    return '';
}

// Run when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set initial avatars
    setLetterAvatars();
    
    // Re-run when new content is added (use MutationObserver in a real implementation)
    // For simplicity, we'll just set a periodic check
    setInterval(setLetterAvatars, 2000);
});