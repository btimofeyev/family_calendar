// Login and Authentication Functionality

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    checkLoggedIn();
    
    // Initialize form switching
    initFormSwitching();
    
    // Initialize form submissions
    initFormSubmissions();
});

// Handle password reset form submission
async function handlePasswordReset(e) {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value;
    const errorElement = document.getElementById('reset-error');
    const resetBtn = document.getElementById('reset-btn');
    
    // Clear previous error
    errorElement.textContent = '';
    
    // Disable reset button and show loading state
    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending...';
    
    try {
        // Send password reset request
        const url = formatApiUrl(CONFIG.ROUTES.AUTH.FORGOT_PASSWORD);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to send password reset. Please try again.');
        }
        
        // Show success message
        showToast('Password reset link sent to your email.', 'success');
        
        // Clear email field
        document.getElementById('reset-email').value = '';
        
        // Switch back to login form after a delay
        setTimeout(() => {
            document.getElementById('reset-password-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        }, 2000);
        
    } catch (error) {
        console.error('Password reset error:', error);
        errorElement.textContent = error.message;
    } finally {
        // Re-enable reset button and restore text
        resetBtn.disabled = false;
        resetBtn.textContent = 'Send Reset Link';
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon;
    switch (type) {
        case 'success':
            icon = 'fa-check-circle';
            break;
        case 'error':
            icon = 'fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fa-exclamation-triangle';
            break;
        default:
            icon = 'fa-info-circle';
    }
    
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            toast.remove();
            if (toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 300);
    }, 3000);
}

// Check if user is already logged in
function checkLoggedIn() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const userData = localStorage.getItem(CONFIG.USER_KEY);
    
    if (token && userData) {
        window.location.href = 'dashboard.html';
    }
}

// Initialize form switching functionality
function initFormSwitching() {
    const switchToRegisterBtn = document.getElementById('switch-to-register');
    if (switchToRegisterBtn) {
        switchToRegisterBtn.addEventListener('click', () => {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        });
    }
    
    const switchToLoginBtn = document.getElementById('switch-to-login');
    if (switchToLoginBtn) {
        switchToLoginBtn.addEventListener('click', () => {
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        });
    }
    
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('reset-password-form').classList.remove('hidden');
        });
    }
    
    const backToLoginBtn = document.getElementById('back-to-login');
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            document.getElementById('reset-password-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        });
    }
}

// Initialize form submissions
function initFormSubmissions() {
    const loginForm = document.getElementById('login-form-element');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const registerForm = document.getElementById('register-form-element');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    
    const resetForm = document.getElementById('reset-password-form-element');
    if (resetForm) resetForm.addEventListener('submit', handlePasswordReset);
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    const errorElement = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    
    errorElement.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    
    try {
        const url = formatApiUrl(CONFIG.ROUTES.AUTH.LOGIN);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login failed. Please check your credentials and try again.');
        
        localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
        if (rememberMe && data.refreshToken) localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, data.refreshToken);
        if (data.user) {
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.user));
            if (data.user.family_id) localStorage.setItem(CONFIG.FAMILY_KEY, data.user.family_id);
        }
        
        showToast('Login successful. Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = data.isNewUser ? 'create-family.html' : 'dashboard.html';
        }, 1000);
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message;
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';
    }
}

// Handle register form submission
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const passkey = document.getElementById('register-passkey').value;
    const errorElement = document.getElementById('register-error');
    const registerBtn = document.getElementById('register-btn');
    
    errorElement.textContent = '';
    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating Account...';
    
    try {
        const url = formatApiUrl(CONFIG.ROUTES.AUTH.REGISTER);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, passkey })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Registration failed. Please try again.');
        
        localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
        if (data.user) {
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.user));
            if (data.user.family_id) localStorage.setItem(CONFIG.FAMILY_KEY, data.user.family_id);
        }
        
        showToast('Account created successfully. Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = data.isNewUser ? 'create-family.html' : 'dashboard.html';
        }, 1000);
    } catch (error) {
        console.error('Registration error:', error);
        errorElement.textContent = error.message;
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Create Account';
    }
}
