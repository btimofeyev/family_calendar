document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const messageDiv = document.getElementById('invite-message');
    const form = document.getElementById('invite-registration-form');

    if (!token) {
        messageDiv.textContent = 'Invalid invitation link.';
        return;
    }

    // Check invitation validity
    fetch(`/api/invitations/check/${token}`)
    .then(response => response.json())
    .then(data => {
        if (data.valid) {
            messageDiv.textContent = `You've been invited to join ${data.familyName}!`;
            document.getElementById('email').value = data.email;
            form.style.display = 'block';
        } else {
            messageDiv.textContent = 'This invitation is no longer valid.';
        }
    })
    .catch(error => {
        console.error('Error:', error);
        messageDiv.textContent = 'An error occurred. Please try again later.';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`/api/invitations/accept/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userId', data.userId);
                window.location.href = 'dashboard.html';
            } else {
                messageDiv.textContent = data.error || 'Registration failed. Please try again.';
            }
        } catch (error) {
            console.error('Error:', error);
            messageDiv.textContent = 'An error occurred. Please try again later.';
        }
    });
});