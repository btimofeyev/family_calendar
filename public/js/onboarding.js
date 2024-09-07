document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-onboarding');
    const nextToInviteButton = document.getElementById('next-to-invite');
    const addMemberButton = document.getElementById('add-member');
    const finishButton = document.getElementById('finish-onboarding');

    let familyId = null;
    const invitedMembers = [];

    // Check if we're coming from the dashboard to create a new family
    const urlParams = new URLSearchParams(window.location.search);
    const createFamily = urlParams.get('createFamily');

    if (createFamily === 'true') {
        // Skip the welcome step and go directly to family name step
        showStep('family-name-step');
    } else {
        startButton.addEventListener('click', () => showStep('family-name-step'));
    }

    nextToInviteButton.addEventListener('click', async () => {
        const familyName = document.getElementById('family-name').value;
        if (familyName) {
            try {
                const result = await createNewFamily(familyName);
                if (result.familyId) {
                    familyId = result.familyId;
                    showStep('invite-members-step');
                } else {
                    showError('Failed to create family. Please try again.');
                }
            } catch (error) {
                console.error('Error creating family:', error);
                showError('Failed to create family. Please try again.');
            }
        } else {
            showError('Please enter a family name');
        }
    });

    addMemberButton.addEventListener('click', () => {
        const emailInput = document.getElementById('member-email');
        const email = emailInput.value.trim();
        if (email && !invitedMembers.includes(email)) {
            invitedMembers.push(email);
            updateInvitedMembersList();
            emailInput.value = '';
            updateMembersCount();
        } else if (invitedMembers.includes(email)) {
            showError('This email has already been invited.');
        } else {
            showError('Please enter a valid email address.');
        }
    });

    finishButton.addEventListener("click", async () => {
        if (invitedMembers.length > 0) {
            try {
                await inviteMembers(familyId, invitedMembers);
                showSuccess('Invitations sent successfully! Redirecting to your dashboard...');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 3000);
            } catch (error) {
                showError(`Failed to send invitations: ${error.message}`);
            }
        } else {
            showError('Please invite at least one family member before finishing.');
        }
    });

    function showStep(stepId) {
        document.querySelectorAll('.onboarding-step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(stepId).classList.add('active');
    }

    function updateInvitedMembersList() {
        const list = document.getElementById('invited-members');
        list.innerHTML = '';
        invitedMembers.forEach(email => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${email}</span>
                <button class="remove-member" data-email="${email}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            list.appendChild(li);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-member').forEach(button => {
            button.addEventListener('click', (e) => {
                const emailToRemove = e.currentTarget.getAttribute('data-email');
                const index = invitedMembers.indexOf(emailToRemove);
                if (index > -1) {
                    invitedMembers.splice(index, 1);
                    updateInvitedMembersList();
                    updateMembersCount();
                }
            });
        });
    }

    function updateMembersCount() {
        const countElement = document.getElementById('members-count');
        countElement.textContent = invitedMembers.length;
    }

    function showError(message) {
        // Implement a nice error message display
        alert(message); // For now, we'll use a simple alert
    }

    function showSuccess(message) {
        // Implement a nice success message display
        alert(message); // For now, we'll use a simple alert
    }

    async function createNewFamily(familyName) {
        try {
            const response = await makeAuthenticatedRequest('/api/dashboard/families', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ familyName })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating family:', error);
            throw error;
        }
    }

    async function inviteMembers(familyId, emails) {
        try {
            for (const email of emails) {
                console.log('Inviting member:', email, 'to family:', familyId);

                const response = await makeAuthenticatedRequest(`/api/invitations/invite`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, familyId }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to invite family member');
                }

                const result = await response.json();
                console.log('Invitation result:', result);
            }
        } catch (error) {
            console.error('Error inviting family members:', error);
            throw error;
        }
    }
});

async function makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error('No authentication token found');
    }

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    return fetch(url, mergedOptions);
}