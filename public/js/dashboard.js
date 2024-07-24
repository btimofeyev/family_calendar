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
async function createFamily(familyName) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/dashboard/families', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ familyName })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP error! status: ${response.status}: ${errorBody}`);
        }

        const result = await response.json();
        console.log('Family created successfully:', result);
        
        // Update user profile to reflect new family creation
        const updatedUser = await fetchUserProfile();
        updateUserProfile(updatedUser);

        // Fetch and display the calendar for the new family
        const events = await fetchCalendarEvents();
        updateCalendar(events);
        
        return result;
    } catch (error) {
        console.error('Error creating family:', error);
        alert(`Failed to create family: ${error.message}`);
        throw error;
    }
}

async function addFamilyMember(email) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/dashboard/family/member', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error adding family member:', error);
        throw error;
    }
}
// Function to update UI with user data
function updateUserProfile(user) {
    console.log('Updating user profile:', user);
    
    if (user) {
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userFamilyName = document.getElementById('userFamilyName');
        const createFamilySection = document.getElementById('createFamilySection');
        const addMemberSection = document.getElementById('addMemberSection');
        const familyCalendar = document.getElementById('familyCalendar');

        if (userAvatar) userAvatar.textContent = user.name.charAt(0);
        if (userName) userName.textContent = user.name;
        if (userEmail) userEmail.textContent = user.email;

        if (user.family_id) {
            if (userFamilyName) userFamilyName.textContent = `Family: ${user.family_name}`;
            if (createFamilySection) createFamilySection.style.display = 'none';
            if (addMemberSection) addMemberSection.style.display = 'block';
            if (familyCalendar) familyCalendar.style.display = 'block';
        } else {
            if (userFamilyName) userFamilyName.textContent = 'No family assigned';
            if (createFamilySection) createFamilySection.style.display = 'block';
            if (addMemberSection) addMemberSection.style.display = 'none';
            if (familyCalendar) familyCalendar.style.display = 'none';
        }
    } else {
        console.error('No user data provided to updateUserProfile');
        const userProfile = document.getElementById('userProfile');
        if (userProfile) userProfile.innerHTML = '<p>Failed to load user profile</p>';
        const familyCalendar = document.getElementById('familyCalendar');
        if (familyCalendar) familyCalendar.style.display = 'none';
    }
}
async function fetchFamilyMembers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/dashboard/family/members', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch family members');
        }

        const members = await response.json();
        updateFamilyMembersList(members);
    } catch (error) {
        console.error('Error fetching family members:', error);
    }
}

function updateFamilyMembersList(members) {
    const memberListContent = document.getElementById('memberListContent');
    memberListContent.innerHTML = '';

    members.forEach(member => {
        const listItem = document.createElement('li');
        listItem.className = 'member-item';
        listItem.innerHTML = `
            <div class="member-avatar">${member.name.charAt(0)}</div>
            <div class="member-info">
                <p class="user-name">${member.name}</p>
                <p class="user-email">${member.email}</p>
            </div>
        `;
        memberListContent.appendChild(listItem);
    });
}
async function fetchCalendarEvents() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No token found');
        }

        const response = await fetch('/api/dashboard/calendar', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch calendar events');
        }

        currentEvents = await response.json();
        return currentEvents;
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        return [];
    }
}
let currentDate = new Date();
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function updateCalendar(events) {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthYear = document.getElementById('monthYear');
    const eventList = document.getElementById('eventList');
    eventList.innerHTML = '';

    events.forEach(event => {
        const eventDate = new Date(event.event_date);
        const listItem = document.createElement('li');
        listItem.className = `event-list-item event-${event.type || 'default'}`;
        listItem.innerHTML = `
            <div class="event-title">${event.title}</div>
            <div class="event-date">${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
        `;
        eventList.appendChild(listItem);
    });

    calendarGrid.innerHTML = '';
    monthYear.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`;

    // Add weekday headers
    weekdays.forEach(day => {
        const weekdayEl = document.createElement('div');
        weekdayEl.className = 'calendar-weekday';
        weekdayEl.textContent = day;
        calendarGrid.appendChild(weekdayEl);
    });

    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day';
        calendarGrid.appendChild(emptyDay);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day current-month';
        
        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = i;
        day.appendChild(dayNumber);

        const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
        const dayEvents = events.filter(event => {
            const eventDay = new Date(event.event_date);
            return eventDay.getDate() === i && 
                   eventDay.getMonth() === currentDate.getMonth() && 
                   eventDay.getFullYear() === currentDate.getFullYear();
        });

        if (dayEvents.length > 0) {
            day.classList.add('has-event');
            const eventIndicatorContainer = document.createElement('div');
            eventIndicatorContainer.className = 'event-indicator-container';
            dayEvents.forEach(event => {
                const eventIndicator = document.createElement('div');
                eventIndicator.className = `event-indicator event-${event.type || 'default'}`;
                eventIndicatorContainer.appendChild(eventIndicator);
            });
            day.appendChild(eventIndicatorContainer);
        }

        if (i === new Date().getDate() && 
            currentDate.getMonth() === new Date().getMonth() && 
            currentDate.getFullYear() === new Date().getFullYear()) {
            day.classList.add('today');
        }

        day.addEventListener('click', () => {
            const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            showEventDetails(dayEvents, dateStr);
        });

        calendarGrid.appendChild(day);
    }
}
document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    fetchCalendarEvents().then(updateCalendar);
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    fetchCalendarEvents().then(updateCalendar);
});

function showEventDetails(events, date) {
    const modal = document.getElementById('eventModal');
    const eventForm = document.getElementById('eventForm');
    const deleteBtn = document.getElementById('deleteEvent');

    modal.style.display = 'block';

    if (events.length === 1) {
        // Existing event details
        const event = events[0];
        eventForm.eventId.value = event.id;
        eventForm.eventType.value = event.type;
        eventForm.eventTitle.value = event.title;
        eventForm.eventDate.value = event.event_date;
        eventForm.eventDescription.value = event.description;
        eventForm.isRecurring.checked = event.is_recurring;
        deleteBtn.style.display = 'block';
    } else {
        // New event form
        eventForm.reset();
        eventForm.eventId.value = '';
        eventForm.eventDate.value = date;
        deleteBtn.style.display = 'none';
    }
}
let currentEvents = [];
async function saveEvent(event) {
    event.preventDefault();
    console.log('Save event function called');

    const eventData = {
        id: document.getElementById('eventId').value,
        type: document.getElementById('eventType').value,
        title: document.getElementById('eventTitle').value,
        event_date: document.getElementById('eventDate').value,
        description: document.getElementById('eventDescription').value,
        is_recurring: document.getElementById('isRecurring').checked
    };

    console.log('Event data to be saved:', eventData);

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found');
        }

        console.log('Sending request to save event...');
        const response = await fetch('/api/dashboard/calendar', {
            method: eventData.id ? 'PUT' : 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to save event: ${errorText}`);
        }

        const savedEvent = await response.json();
        console.log('Saved event:', savedEvent);
        
        // Update currentEvents array
        if (eventData.id) {
            const index = currentEvents.findIndex(e => e.id === savedEvent.id);
            if (index !== -1) {
                currentEvents[index] = savedEvent;
            }
        } else {
            currentEvents.push(savedEvent);
        }

        // Update the calendar display
        updateCalendar(currentEvents);
        closeModal();
        alert('Event saved successfully!');
    } catch (error) {
        console.error('Error saving event:', error);
        alert(`Failed to save event: ${error.message}`);
    }
}
async function deleteEvent() {
    const eventId = document.getElementById('eventId').value;
    if (!eventId) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/dashboard/calendar/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete event');
        }

        currentEvents = currentEvents.filter(e => e.id !== eventId);
        updateCalendar(currentEvents);
        closeModal();
    } catch (error) {
        console.error('Error deleting event:', error);
        alert('Failed to delete event. Please try again.');
    }
}

function closeModal() {
    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.style.display = 'none';
    } else {
        console.error('Modal element not found');
    }
}
async function inviteFamilyMember(email) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/dashboard/family/invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`HTTP error! status: ${response.status}: ${errorBody}`);
        }

        const result = await response.json();
        console.log('Invitation sent successfully:', result);
        return result;
    } catch (error) {
        console.error('Error sending invitation:', error);
        throw error;
    }
}
// Main function to initialize the dashboard
async function initDashboard() {
    console.log('Initializing dashboard...');

    try {
        const user = await fetchUserProfile();
        updateUserProfile(user);
        if (user && user.family_id) {
            const events = await fetchCalendarEvents();
            updateCalendar(events);
            await fetchFamilyMembers();

        } else {
            const familyCalendar = document.getElementById('familyCalendar');
            if (familyCalendar) {
                familyCalendar.innerHTML = '<p>No family calendar available</p>';
            }
        }

        // Event listeners
        const eventForm = document.getElementById('eventForm');
        if (eventForm) {
            eventForm.addEventListener('submit', saveEvent);
        }

        const deleteEventBtn = document.getElementById('deleteEvent');
        if (deleteEventBtn) {
            deleteEventBtn.addEventListener('click', deleteEvent);
        }

        const addEventBtn = document.getElementById('addEventBtn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => showEventDetails([]));
        }

        const closeModalBtn = document.getElementById('closeModalButton');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
        } else {
            console.error('Close modal button not found');
        }

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('eventModal');
            if (event.target === modal) {
                closeModal();
            }
        });

        // Handle create family form
        const createFamilyForm = document.getElementById('createFamilyForm');
        if (createFamilyForm) {
            createFamilyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Form submitted');

                const familyNameInput = document.getElementById('createFamilyName');
                if (!familyNameInput) {
                    console.error('Family name input not found');
                    alert('There was an error with the form. Please try again later.');
                    return;
                }

                const familyName = familyNameInput.value.trim();
                console.log('Family name submitted:', familyName);

                try {
                    const token = localStorage.getItem('token');
                    if (!token) {
                        throw new Error("No token found in local storage");
                    }
                    console.log('Sending request to create family...');
                    const response = await fetch('/api/dashboard/families', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ familyName }),
                    });
                    console.log('Response status:', response.status);

                    const responseText = await response.text();
                    console.log('Response text:', responseText);

                    if (!response.ok) {
                        throw new Error(responseText || 'Failed to create family');
                    }

                    const result = JSON.parse(responseText);
                    console.log('Family created successfully:', result);

                    const updatedUser = await fetchUserProfile();
                    updateUserProfile(updatedUser);
                    alert('Family created successfully!');
                    familyNameInput.value = '';
                } catch (error) {
                    console.error('Error creating family:', error);
                    alert(`Failed to create family: ${error.message}`);
                }
            });
        } else {
            console.error('Create family form not found');
        }
        const inviteMemberForm = document.getElementById('inviteMemberForm');
        if (inviteMemberForm) {
            inviteMemberForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Invite form submitted');

                const inviteEmailInput = document.getElementById('inviteEmail');
                if (!inviteEmailInput) {
                    console.error('Invite email input not found');
                    alert('There was an error with the form. Please try again later.');
                    return;
                }

                const email = inviteEmailInput.value.trim();
                console.log('Invitation email submitted:', email);

                try {
                    await inviteFamilyMember(email);
                    alert('Invitation sent successfully!');
                    inviteEmailInput.value = '';
                } catch (error) {
                    console.error('Error sending invitation:', error);
                    alert(`Failed to send invitation: ${error.message}`);
                }
            });
        } else {
            console.error('Invite member form not found');
        }

    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

// Call the init function when the page loads
document.addEventListener('DOMContentLoaded', initDashboard);