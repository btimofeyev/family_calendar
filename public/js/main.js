document.addEventListener('DOMContentLoaded', () => {
    const landingPage = document.getElementById('landing-page');
    const authModal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showLoginBtn = document.getElementById('show-login');
    const showSignupBtn = document.getElementById('show-signup');
    const closeBtn = document.querySelector('.close');
    const app = document.getElementById('app');

    function showModal() {
        authModal.classList.remove('hidden');
    }

    function hideModal() {
        authModal.classList.add('hidden');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    }

    function showApp() {
        landingPage.classList.add('hidden');
        app.classList.remove('hidden');
        // TODO: Implement app initialization (calendar, member list, social feed)
    }

    showLoginBtn.addEventListener('click', () => {
        showModal();
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    });

    showSignupBtn.addEventListener('click', () => {
        showModal();
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    closeBtn.addEventListener('click', hideModal);

    window.addEventListener('click', (event) => {
        if (event.target === authModal) {
            hideModal();
        }
    });

    async function login(event) {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userId', data.user.id);
                if (data.user.family_id) {
                    localStorage.setItem('familyId', data.user.family_id);
                }
                window.location.href = 'dashboard.html';
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Login error:', error);
        }
    }
    async function handleInvitation() {
        const urlParams = new URLSearchParams(window.location.search);
        const invitationToken = urlParams.get('invitationToken');
        const error = urlParams.get('error');

        if (error) {
            switch (error) {
                case 'invalid_invitation':
                    alert('The invitation is invalid or has expired.');
                    break;
                case 'invitation_already_used':
                    alert('This invitation has already been used.');
                    break;
                case 'invitation_error':
                    alert('There was an error processing the invitation. Please try again.');
                    break;
            }
        }

        if (invitationToken) {
            try {
                const response = await fetch(`/api/auth/check-invitation/${invitationToken}`);
                const data = await response.json();
                if (data.valid) {
                    showModal();
                    signupForm.classList.remove('hidden');
                    loginForm.classList.add('hidden');
                    document.getElementById('signup-email').value = data.email;
                    document.getElementById('signup-email').readOnly = true;
                    localStorage.setItem('invitationToken', invitationToken);
                } else {
                    alert('Invalid or expired invitation.');
                }
            } catch (error) {
                console.error('Error checking invitation:', error);
                alert('There was an error processing the invitation. Please try again.');
            }
        }
    }
    async function signup(event) {
        event.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const invitationToken = localStorage.getItem('invitationToken');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, invitationToken })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userId', data.user.id);
                if (data.user.family_id) {
                    localStorage.setItem('familyId', data.user.family_id);
                }
                localStorage.removeItem('invitationToken');
                window.location.href = 'dashboard.html';
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Signup error:', error);
        }
    }
    document.getElementById('login').addEventListener('submit', login);
    document.getElementById('signup').addEventListener('submit', signup);

    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
        showApp();
    }
    handleInvitation();

});