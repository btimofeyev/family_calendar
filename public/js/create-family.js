// Create Family Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuthentication();
    
    // Initialize step navigation
    initStepNavigation();
    
    // Initialize family photo upload
    initPhotoUpload();
    
    // Initialize form submissions
    initFormSubmissions();
    
    // Generate and display passkey
    generatePasskey();
    
    // Initialize copy passkey button
    initCopyPasskey();
});

// Check if user is authenticated
function checkAuthentication() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const userData = localStorage.getItem(CONFIG.USER_KEY);
    
    if (!token || !userData) {
        // Redirect to login page if not authenticated
        window.location.href = 'index.html';
    }
}

// Initialize step navigation
function initStepNavigation() {
    // Step buttons
    const backButtons = document.querySelectorAll('.back-btn');
    const skipButtons = document.querySelectorAll('.skip-btn');
    
    // Back buttons
    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            const stepToShow = button.dataset.step;
            showStep(stepToShow);
        });
    });
    
    // Skip buttons
    skipButtons.forEach(button => {
        button.addEventListener('click', () => {
            const stepToShow = button.dataset.step;
            if (stepToShow) {
                showStep(stepToShow);
            } else {
                // If no step specified, go to dashboard
                window.location.href = 'dashboard.html';
            }
        });
    });
}

// Show a specific step
function showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show selected step
    document.getElementById(`step-${stepNumber}`).classList.add('active');
    
    // Update progress steps
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        
        if (stepNum < stepNumber) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (stepNum == stepNumber) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

// Initialize family photo upload
function initPhotoUpload() {
    const photoInput = document.getElementById('family-photo');
    const photoPreview = document.getElementById('photo-preview');
    
    if (!photoInput || !photoPreview) return;
    
    photoInput.addEventListener('change', () => {
        const file = photoInput.files[0];
        
        if (file) {
            // Check file type
            if (!file.type.startsWith('image/')) {
                showToast('Please select an image file.', 'error');
                return;
            }
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image size should be less than 5MB.', 'error');
                return;
            }
            
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                photoPreview.innerHTML = `<img src="${e.target.result}" alt="Family Photo">`;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Click on preview to trigger file input
    photoPreview.addEventListener('click', () => {
        photoInput.click();
    });
}

// Initialize form submissions
function initFormSubmissions() {
    // Create family form
    const createFamilyForm = document.getElementById('create-family-form');
    if (createFamilyForm) {
        createFamilyForm.addEventListener('submit', handleCreateFamily);
    }
    
    // Invite form
    const inviteForm = document.getElementById('invite-form');
    if (inviteForm) {
        inviteForm.addEventListener('submit', handleInviteMembers);
    }
}

// Handle create family form submission
// Handle create family form submission
async function handleCreateFamily(e) {
    e.preventDefault();
    
    const familyName = document.getElementById('family-name').value;
    const familyPhoto = document.getElementById('family-photo').files[0];
    const errorElement = document.getElementById('family-error');
    const submitButton = document.querySelector('#create-family-form .next-btn');
    
    // Clear previous error
    errorElement.textContent = '';
    
    // Validate family name
    if (!familyName.trim()) {
        errorElement.textContent = 'Please enter a family name.';
        return;
    }
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    
    try {
        console.log('Family name input value:', familyName);
        
        // Let's try different property names to see what the backend expects
        const familyData = {
            familyName: familyName,
            family_name: familyName,
            name: familyName
        };
        
        // Log the request for debugging
        console.log('Sending request with data:', familyData);
        
        // Send request to create family
        const url = formatApiUrl(CONFIG.ROUTES.DASHBOARD.FAMILIES);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(familyData)
        });
        
        // Log the response status for debugging
        console.log('Response status:', response.status);
        
        // Get the response text first for debugging
        const responseText = await response.text();
        console.log('Raw response text:', responseText);
        
        // Try to parse the response as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Error parsing response as JSON:', parseError);
            data = { error: 'Could not parse server response' };
        }
        
        console.log('Parsed response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to create family. Please try again.');
        }
        
        // Save family ID in localStorage - try different possible property names
        const familyId = data.familyId || data.family_id || data.id;
        
        if (familyId) {
            localStorage.setItem(CONFIG.FAMILY_KEY, familyId);
            
            // Update user data with new family
            const userData = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || '{}');
            userData.family_id = familyId;
            localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(userData));
            
            // If a family photo was selected, upload it separately 
            if (familyPhoto) {
                try {
                    const photoFormData = new FormData();
                    photoFormData.append('photo', familyPhoto);
                    
                    const photoUrl = formatApiUrl(`/dashboard/families/${familyId}/photo`);
                    await fetch(photoUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`
                        },
                        body: photoFormData
                    });
                } catch (photoError) {
                    console.error('Error uploading family photo:', photoError);
                }
            }
        }
        
        // Show success message
        showToast('Family created successfully!', 'success');
        
        // Move to next step
        showStep(2);
        
    } catch (error) {
        console.error('Error creating family:', error);
        errorElement.textContent = error.message;
    } finally {
        // Re-enable button and restore text
        submitButton.disabled = false;
        submitButton.innerHTML = 'Continue <i class="fas fa-arrow-right"></i>';
    }
}
// Handle invite members form submission
async function handleInviteMembers(e) {
    e.preventDefault();
    
    const emailsInput = document.getElementById('invite-emails').value;
    const message = document.getElementById('invite-message').value;
    const errorElement = document.getElementById('invite-error');
    const submitButton = document.querySelector('#invite-form .next-btn');
    
    // Clear previous error
    errorElement.textContent = '';
    
    // Get emails array
    const emails = emailsInput.split(',')
        .map(email => email.trim())
        .filter(email => email !== '');
    
    // Check if at least one email is provided
    if (emails.length === 0) {
        errorElement.textContent = 'Please enter at least one email address.';
        return;
    }
    
    // Validate email format
    const invalidEmails = emails.filter(email => !isValidEmail(email));
    if (invalidEmails.length > 0) {
        errorElement.textContent = `Invalid email format: ${invalidEmails.join(', ')}`;
        return;
    }
    
    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    try {
        // Get family ID
        const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
        if (!familyId) {
            throw new Error('No family selected. Please create a family first.');
        }
        
        // Looking at the route structure from your backend
        // Using the invitations route instead of family members
        const url = formatApiUrl('/invitations/invite');
        
        const invitePromises = emails.map(async (email) => {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        email,
                        familyId,
                        // Include message if needed by your backend
                        personalMessage: message.trim() || undefined
                    })
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    return { email, success: false, error: data.error };
                }
                
                return { email, success: true };
            } catch (error) {
                return { email, success: false, error: error.message };
            }
        });
        
        const results = await Promise.all(invitePromises);
        
        // Count successful invites
        const successCount = results.filter(r => r.success).length;
        
        if (successCount > 0) {
            // Show success message
            showToast(`Successfully sent ${successCount} invitation${successCount > 1 ? 's' : ''}!`, 'success');
            
            // Move to next step
            showStep(3);
        } else {
            // Show error for failed invites
            errorElement.textContent = 'Failed to send invitations. Please try again.';
        }
        
    } catch (error) {
        console.error('Error sending invitations:', error);
        errorElement.textContent = error.message;
    } finally {
        // Re-enable button and restore text
        submitButton.disabled = false;
        submitButton.innerHTML = 'Send Invites <i class="fas fa-arrow-right"></i>';
    }
}

// Validate email format
function isValidEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Generate and display passkey
async function generatePasskey() {
    const passkeyValue = document.getElementById('passkey-value');
    
    if (!passkeyValue) return;
    
    try {
        // Get family ID
        const familyId = localStorage.getItem(CONFIG.FAMILY_KEY);
        if (!familyId) {
            passkeyValue.textContent = 'No family created';
            return;
        }
        
        // Generate family passkey - use the correct endpoint from your backend
        const url = formatApiUrl(`/dashboard/families/${familyId}/passkey`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.TOKEN_KEY)}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate passkey');
        }
        
        const data = await response.json();
        
        // Display passkey - check both passkey or code properties based on your backend
        if (data.passkey) {
            passkeyValue.textContent = data.passkey;
        } else if (data.code) {
            passkeyValue.textContent = data.code;
        } else {
            passkeyValue.textContent = 'Error: No passkey generated';
        }
        
    } catch (error) {
        console.error('Error generating passkey:', error);
        passkeyValue.textContent = 'Error generating passkey';
    }
}

// Initialize copy passkey button
function initCopyPasskey() {
    const copyButton = document.getElementById('copy-passkey');
    const passkeyValue = document.getElementById('passkey-value');
    
    if (!copyButton || !passkeyValue) return;
    
    copyButton.addEventListener('click', () => {
        const passkey = passkeyValue.textContent;
        
        if (passkey && passkey !== 'Generating...' && passkey !== 'Error generating passkey') {
            // Copy to clipboard
            navigator.clipboard.writeText(passkey)
                .then(() => {
                    // Show success message
                    showToast('Passkey copied to clipboard!', 'success');
                    
                    // Update button temporarily
                    copyButton.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy passkey:', err);
                    showToast('Failed to copy passkey', 'error');
                });
        }
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Add icon based on type
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
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            toast.remove();
            
            // Remove container if empty
            if (toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 300);
    }, 3000);
}