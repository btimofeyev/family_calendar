document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const messageDiv = document.getElementById('invite-message');
    const form = document.getElementById('invite-registration-form');

    if (token) {
        // Email invitation flow
        checkEmailInvitation(token);
    } else {
        // Passkey or direct registration flow
        if (messageDiv) {
            messageDiv.textContent = 'Enter your details to join a family or create a new one.';
        }
        if (form) {
            form.style.display = 'block';
        }
    }

    if (form) {
        form.addEventListener('submit', handleFormSubmission);
    }
});

function checkEmailInvitation(token) {
    fetch(`/api/invitations/check/${token}`)
    .then(response => response.json())
    .then(data => {
        const messageDiv = document.getElementById('invite-message');
        const form = document.getElementById('invite-registration-form');
        const emailInput = document.getElementById('email');
        const passkeyInput = document.getElementById('passkey');

        if (data.valid) {
            if (messageDiv) {
                messageDiv.textContent = `You've been invited to join ${data.familyName}!`;
            }
            if (emailInput) {
                emailInput.value = data.email;
                emailInput.readOnly = true;
            }
            if (passkeyInput) {
                passkeyInput.style.display = 'none';
            }
            if (form) {
                form.style.display = 'block';
            }
        } else {
            if (messageDiv) {
                messageDiv.textContent = 'This invitation is no longer valid.';
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        const messageDiv = document.getElementById('invite-message');
        if (messageDiv) {
            messageDiv.textContent = 'An error occurred. Please try again later.';
        }
    });
}

async function handleFormSubmission(e) {
    e.preventDefault();
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passkeyInput = document.getElementById('passkey');
    const messageDiv = document.getElementById('invite-message');

    const name = nameInput ? nameInput.value : '';
    const email = emailInput ? emailInput.value : '';
    const password = passwordInput ? passwordInput.value : '';
    const passkey = passkeyInput ? passkeyInput.value : '';
    const token = new URLSearchParams(window.location.search).get('token');

    if (!name || !password) {
        if (messageDiv) {
            messageDiv.textContent = 'Please fill in all required fields.';
        }
        return;
    }

    try {
        let response;
        if (token) {
            // Email invitation registration
            response = await fetch(`/api/invitations/accept/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
        } else if (passkey) {
            // Passkey registration
            if (!email) {
                if (messageDiv) {
                    messageDiv.textContent = 'Email is required for passkey registration.';
                }
                return;
            }
            response = await fetch('/api/passkey/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, passkey })
            });
        } else {
            // Regular registration
            if (!email) {
                if (messageDiv) {
                    messageDiv.textContent = 'Email is required for registration.';
                }
                return;
            }
            response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
        }

        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.userId);
            window.location.href = 'dashboard.html';
        } else {
            if (messageDiv) {
                messageDiv.textContent = data.error || 'Registration failed. Please try again.';
            }
        }
    } catch (error) {
        console.error('Error:', error);
        if (messageDiv) {
            messageDiv.textContent = 'An error occurred. Please try again later.';
        }
    }
}