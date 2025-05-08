// Application Configuration
const CONFIG = {
    // API URL - Change this to match your backend server URL
    API_URL: 'http://localhost:3001/api',
    
    // Token storage key in localStorage
    TOKEN_KEY: 'famlynook_token',
    
    // User data storage key in localStorage
    USER_KEY: 'famlynook_user',
    
    // Selected family storage key in localStorage
    FAMILY_KEY: 'famlynook_family',
    
    // Routes
    ROUTES: {
        AUTH: {
            LOGIN: '/auth/login',
            REGISTER: '/auth/register',
            REFRESH_TOKEN: '/auth/refresh-token',
            FORGOT_PASSWORD: '/auth/forgot-password',
            RESET_PASSWORD: '/auth/reset-password'
        },
        DASHBOARD: {
            PROFILE: '/dashboard/profile',
            USER_FAMILIES: '/dashboard/user/families',
            FAMILIES: '/dashboard/families',
            FAMILY_MEMBERS: '/dashboard/families/{familyId}/members',
            CALENDAR: '/dashboard/calendar/{familyId}'
        },
        INVITATIONS: {
            INVITE: '/invitations/invite',
            CHECK: '/invitations/check/{token}',
            ACCEPT: '/invitations/accept/{token}',
            DECLINE: '/invitations/decline/{token}'
        },
        FEED: {
            POSTS: '/family/{familyId}/posts',
            CREATE_POST: '/family/{familyId}/posts',
            POST_DETAILS: '/posts/{postId}',
            LIKE_POST: '/posts/{postId}/like',
            COMMENT_POST: '/posts/{postId}/comment',
            GET_COMMENTS: '/posts/{postId}/comments'
        },
        NOTIFICATIONS: {
            GET: '/notifications',
            READ: '/notifications/{id}/read',
            READ_ALL: '/notifications/read-all'
        },
        MEMORIES: {
            LIST: '/memories/{familyId}',
            CREATE: '/memories/create',
            CONTENT: '/memories/{memoryId}/content'
        }
    },
    
    // Date formats
    DATE_FORMATS: {
        STANDARD: 'YYYY-MM-DD',
        DISPLAY: 'MMM D, YYYY',
        SHORT: 'MM/DD/YYYY',
        TIME: 'h:mm A'
    },
    
    // Pagination
    PAGINATION: {
        POSTS_PER_PAGE: 10
    },
    
    // Media
    MEDIA: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'],
        MAX_UPLOAD_COUNT: 4
    },
    
    // Default images
    DEFAULT_IMAGES: {
        AVATAR: 'img/default-avatar.png',
        FAMILY: 'img/default-family.png',
        POST_PLACEHOLDER: 'img/post-placeholder.png'
    }
};

// Helper function to format API URLs with parameters
function formatApiUrl(route, params = {}) {
    let url = CONFIG.API_URL + route;
    
    // Replace URL parameters with values
    Object.keys(params).forEach(key => {
        url = url.replace(`{${key}}`, params[key]);
    });
    
    return url;
}

// Format dates uniformly across the application
function formatDate(dateString, format = CONFIG.DATE_FORMATS.DISPLAY) {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
        return 'Invalid date';
    }
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // Format the time as AM/PM
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    
    switch (format) {
        case CONFIG.DATE_FORMATS.STANDARD:
            return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        case CONFIG.DATE_FORMATS.DISPLAY:
            return `${months[month]} ${day}, ${year}`;
        case CONFIG.DATE_FORMATS.SHORT:
            return `${(month + 1).toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
        case CONFIG.DATE_FORMATS.TIME:
            return `${formattedHours}:${formattedMinutes} ${ampm}`;
        default:
            return `${months[month]} ${day}, ${year}`;
    }
}

// Format time intervals (e.g. "2 hours ago")
function timeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const seconds = Math.floor((now - past) / 1000);
    
    if (isNaN(past.getTime())) {
        return 'Invalid date';
    }
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
        return interval === 1 ? '1 year ago' : `${interval} years ago`;
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
        return interval === 1 ? '1 month ago' : `${interval} months ago`;
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        return interval === 1 ? '1 day ago' : `${interval} days ago`;
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
        return interval === 1 ? '1 hour ago' : `${interval} hours ago`;
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
        return interval === 1 ? '1 minute ago' : `${interval} minutes ago`;
    }
    
    return seconds < 10 ? 'just now' : `${Math.floor(seconds)} seconds ago`;
}

// Generate random ID for temporary elements
function generateTempId() {
    return 'temp_' + Math.random().toString(36).substr(2, 9);
}

// Ensure file type is allowed
function isFileTypeAllowed(fileType) {
    return CONFIG.MEDIA.ALLOWED_TYPES.includes(fileType);
}

// Truncate text with ellipsis if it exceeds maxLength
function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}