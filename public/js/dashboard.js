if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/js/serviceworker.js").then(
      function (registration) {},
      function (err) {}
    );
  });
}

let loggedInUserId;
async function fetchUserProfile() {
  try {
    console.log("Fetching user profile...");
    const response = await makeAuthenticatedRequest("/api/dashboard/profile");
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Response status:", response.status);
      console.error("Response body:", errorBody);
      if (response.status === 404) {
        console.log("User not found. Redirecting to login...");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("familyId");
        window.location.href = "index.html";
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const user = await response.json();
    console.log("User profile fetched:", user);
    return user;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

async function fetchUserFamilies() {
  try {
    const response = await makeAuthenticatedRequest("/api/dashboard/user/families");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching user families:", error);
    return [];
  }
}

function updateUserProfile(user) {
  if (user) {
    const userAvatar = document.getElementById("userAvatar");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const createFamilySection = document.getElementById("createFamilySection");
    const familySection = document.getElementById("familySection");

    if (userAvatar) userAvatar.textContent = user.name.charAt(0);
    if (userName) userName.textContent = user.name;
    if (userEmail) userEmail.textContent = user.email;

    if (createFamilySection) createFamilySection.style.display = "block";
    if (familySection) familySection.style.display = "block";
  } else {
    console.error("No user data provided to updateUserProfile");
    const userProfile = document.getElementById("userProfile");
    if (userProfile) userProfile.innerHTML = "<p>Failed to load user profile</p>";
  }
}

async function updateFamilyList() {
  const families = await fetchUserFamilies();
  const familyList = document.getElementById("familyList");
  familyList.innerHTML = "";

  families.forEach(family => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <span>${family.family_name}</span>
      <button class="view-family" data-family-id="${family.family_id}">View</button>
    `;
    familyList.appendChild(listItem);
  });

  // Add event listeners to view buttons
  document.querySelectorAll('.view-family').forEach(button => {
    button.addEventListener('click', (e) => {
      const familyId = e.target.getAttribute('data-family-id');
      viewFamily(familyId);
    });
  });
}

async function viewFamily(familyId) {
  try {
    const familyDetails = await fetchFamilyDetails(familyId);
    if (!familyDetails) {
      console.warn(`Unable to view family with id ${familyId}`);
      return;
    }
    const familyMembers = await fetchFamilyMembers(familyId);
    updateFamilyView(familyDetails, familyMembers);

    // Highlight the selected family button
    const familySelector = document.getElementById("familySelector");
    if (familySelector) {
      familySelector.querySelectorAll('.family-button').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.familyId === familyId) {
          btn.classList.add('selected');
        }
      });
    }

    // Fetch and update calendar events
    const events = await fetchCalendarEvents(familyId);
    currentEvents = handleRecurringEvents(events);
    updateCalendar(currentEvents);

    // Update social feed
    if (typeof updateSocialFeed === "function") {
      await updateSocialFeed(familyId);
    } else {
      console.error("updateSocialFeed function not found");
    }

  } catch (error) {
    console.error("Error viewing family:", error);
  }
}

async function fetchFamilyDetails(familyId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/dashboard/families/${familyId}`);
    if (response.status === 404) {
      console.warn(`Family with id ${familyId} not found`);
      return null;
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching family details:", error);
    return null;
  }
}

async function fetchFamilyMembers(familyId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/dashboard/families/${familyId}/members`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching family members:", error);
    return [];
  }
}

function updateFamilyView(familyDetails, familyMembers) {
  const familyView = document.getElementById("familyView");
  if (!familyView) {
    console.warn("Family view element not found");
    return;
  }

  const familyId = familyDetails ? familyDetails.family_id : null;

  familyView.innerHTML = `
    <h2>${familyDetails ? familyDetails.family_name : 'Family'}</h2>
    <h3>Members:</h3>
    <ul id="memberList"></ul>
    <div class="invite-button-container">
      <button id="inviteMemberBtn" class="invite-member-btn">
        <i class="fas fa-user-plus"></i>
        <span>Invite Member</span>
      </button>
    </div>
  `;

  const memberList = document.getElementById("memberList");
  if (memberList) {
    familyMembers.forEach(member => {
      const listItem = document.createElement("li");
      listItem.className = "member-item";
      listItem.innerHTML = `
        <div class="member-avatar">${member.name.charAt(0)}</div>
        <div class="member-info">
          <p class="user-name">${member.name}</p>
          <p class="user-email">${member.email}</p>
        </div>
      `;
      listItem.addEventListener("click", () => {
        window.location.href = `/profile.html?userId=${member.id}&familyId=${familyId}`;
      });
      memberList.appendChild(listItem);
    });
  }

  const inviteMemberBtn = document.getElementById("inviteMemberBtn");
  if (inviteMemberBtn) {
    inviteMemberBtn.addEventListener("click", showInviteMemberModal);
  }
}

function showInviteMemberModal() {
  // Close the left column on mobile devices
  if (window.innerWidth <= 768) {
    closeAllElements();
  }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content invite-modal">
      <h2>Invite Family Member</h2>
      <div class="invite-options">
        <button id="emailInviteBtn" class="invite-option-btn active">Email Invitation</button>
        <button id="passkeyInviteBtn" class="invite-option-btn">Generate Passkey</button>
      </div>
      <form id="emailInviteForm">
        <input type="email" id="inviteEmail" placeholder="Enter email address" required>
        <button type="submit" class="btn-primary">Send Invitation</button>
      </form>
      <div id="passkeySection" style="display: none;">
        <button id="generatePasskeyBtn" class="btn-primary">Generate Passkey</button>
        <div id="passkeyResult" style="display: none;">
          <p>Passkey: <span id="generatedPasskey"></span></p>
          <p>Expires: <span id="passkeyExpiry"></span></p>
        </div>
      </div>
      <button id="closeModal" class="btn-secondary">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    document.body.removeChild(modal);
  };

  document.getElementById('closeModal').addEventListener('click', closeModal);
  
  const emailInviteBtn = document.getElementById('emailInviteBtn');
  const passkeyInviteBtn = document.getElementById('passkeyInviteBtn');
  const emailInviteForm = document.getElementById('emailInviteForm');
  const passkeySection = document.getElementById('passkeySection');

  emailInviteBtn.addEventListener('click', () => {
    emailInviteBtn.classList.add('active');
    passkeyInviteBtn.classList.remove('active');
    emailInviteForm.style.display = 'block';
    passkeySection.style.display = 'none';
  });

  passkeyInviteBtn.addEventListener('click', () => {
    passkeyInviteBtn.classList.add('active');
    emailInviteBtn.classList.remove('active');
    emailInviteForm.style.display = 'none';
    passkeySection.style.display = 'block';
  });

  emailInviteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('inviteEmail').value;
    await inviteFamilyMember(email);
    closeModal();
  });

  document.getElementById('generatePasskeyBtn').addEventListener('click', async () => {
    try {
      const selectedFamilyButton = document.querySelector('.family-button.selected');
      if (!selectedFamilyButton) {
        throw new Error("No family selected");
      }
      const selectedFamilyId = selectedFamilyButton.dataset.familyId;

      console.log(`Attempting to generate passkey for family ${selectedFamilyId}`);

      const response = await makeAuthenticatedRequest(`/api/dashboard/families/${selectedFamilyId}/passkey`, {
        method: 'POST',
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = JSON.parse(responseText);
      document.getElementById('generatedPasskey').textContent = result.passkey;
      document.getElementById('passkeyExpiry').textContent = new Date(result.expiresAt).toLocaleString();
      document.getElementById('passkeyResult').style.display = 'block';
    } catch (error) {
      console.error('Error generating passkey:', error);
      alert('Failed to generate passkey. Please try again.');
    }
  });
}

async function inviteFamilyMember(email) {
  try {
    const selectedFamilyButton = document.querySelector('.family-button.selected');
    if (!selectedFamilyButton) {
      throw new Error("No family selected");
    }
    const selectedFamilyId = selectedFamilyButton.dataset.familyId;

    console.log('Inviting member:', email, 'to family:', selectedFamilyId);

    const response = await makeAuthenticatedRequest(`/api/invitations/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, familyId: selectedFamilyId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to invite family member');
    }

    const result = await response.json();
    console.log('Invitation result:', result);

    alert('Invitation sent successfully!');
    // Refresh the family members list
    const familyMembers = await fetchFamilyMembers(selectedFamilyId);
    updateFamilyView({ family_id: selectedFamilyId }, familyMembers);
  } catch (error) {
    console.error('Error inviting family member:', error);
    alert(`Failed to invite family member: ${error.message}`);
  }
}

let currentDate = new Date();
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function updateCalendar(events) {
  console.log("Updating calendar with events:", events);
  const calendarGrid = document.getElementById("calendarGrid");
  const monthYear = document.getElementById("monthYear");
  const eventList = document.getElementById("eventList");

  // Sort events by date to find the next three
  const upcomingEvents = events
    .filter((event) => {
      const eventDate = new Date(event.event_date + 'T00:00:00Z');
      return eventDate >= new Date();
    })
    .sort((a, b) => new Date(a.event_date + 'T00:00:00Z') - new Date(b.event_date + 'T00:00:00Z'))
    .slice(0, 3);

  console.log("Upcoming events:", upcomingEvents);

  // Clear the event list and populate it with upcoming events
  eventList.innerHTML = "";
  upcomingEvents.forEach((event) => {
    const eventDate = new Date(event.event_date + 'T00:00:00Z');
    const listItem = document.createElement("li");
    listItem.className = `event-list-item event-${event.type || "other"}`;
    listItem.innerHTML = `
      <div class="event-type-indicator"></div>
      <div class="event-title">${event.title}</div>
      <div class="event-date">${eventDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: 'UTC'
      })}</div>
      <div class="event-description" style="display: none;">${
        event.description || "No description available."
      }</div>
    `;
    listItem.addEventListener("click", function () {
      const description = this.querySelector(".event-description");
      description.style.display =
        description.style.display === "none" ? "block" : "none";
    });
    eventList.appendChild(listItem);
  });

  // Update the calendar
  calendarGrid.innerHTML = "";
  monthYear.textContent = `${currentDate.toLocaleString("default", {
    month: "long",
  })} ${currentDate.getFullYear()}`;

  // Add weekday headers
  weekdays.forEach((day) => {
    const weekdayEl = document.createElement("div");
    weekdayEl.className = "calendar-weekday";
    weekdayEl.textContent = day;
    calendarGrid.appendChild(weekdayEl);
  });

  const firstDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const lastDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay.getDay(); i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day";
    calendarGrid.appendChild(emptyDay);
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const day = document.createElement("div");
    day.className = "calendar-day current-month";

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = i;
    day.appendChild(dayNumber);

    const eventDate = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), i));
    const dayEvents = events.filter((event) => {
      const eventDay = new Date(event.event_date + 'T00:00:00Z');
      return (
        eventDay.getUTCDate() === eventDate.getUTCDate() &&
        eventDay.getUTCMonth() === eventDate.getUTCMonth() &&
        eventDay.getUTCFullYear() === eventDate.getUTCFullYear()
      );
    });
    

    if (dayEvents.length > 0) {
      day.classList.add("has-event");
      const eventIndicator = document.createElement("div");
      eventIndicator.className = "event-indicator";
      dayEvents.forEach(event => {
        const dot = document.createElement("span");
        dot.className = `event-dot ${event.type || "other"}`;
        eventIndicator.appendChild(dot);
      });
      day.appendChild(eventIndicator);

      // Add tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "event-tooltip";
      dayEvents.forEach(event => {
        const eventInfo = document.createElement("p");
        eventInfo.textContent = `${event.title} (${event.type || "other"})`;
        tooltip.appendChild(eventInfo);
      });
      day.appendChild(tooltip);
    }

    if (
      i === new Date().getDate() &&
      currentDate.getMonth() === new Date().getMonth() &&
      currentDate.getFullYear() === new Date().getFullYear()
    ) {
      day.classList.add("today");
    }

    day.addEventListener("click", () => {
      const dateStr = `${currentDate.getFullYear()}-${(
        currentDate.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${i.toString().padStart(2, "0")}`;
      showEventDetails(dayEvents, dateStr);
    });

    calendarGrid.appendChild(day);
  }
}
document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  const selectedFamilyButton = document.querySelector('.family-button.selected');
  if (selectedFamilyButton) {
    const selectedFamilyId = selectedFamilyButton.dataset.familyId;
    fetchCalendarEvents(selectedFamilyId).then(events => {
      currentEvents = handleRecurringEvents(events);
      updateCalendar(currentEvents);
    });
  }
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  const selectedFamilyButton = document.querySelector('.family-button.selected');
  if (selectedFamilyButton) {
    const selectedFamilyId = selectedFamilyButton.dataset.familyId;
    fetchCalendarEvents(selectedFamilyId).then(events => {
      currentEvents = handleRecurringEvents(events);
      updateCalendar(currentEvents);
    });
  }
});

function showEventDetails(events, date) {
  const modal = document.getElementById("eventModal");
  const eventForm = document.getElementById("eventForm");
  const deleteBtn = document.getElementById("deleteEvent");
  const closeBtn = document.getElementById("closeModalButton");

  modal.style.display = "flex";

  if (events.length === 1) {
    const event = events[0];
    eventForm.eventId.value = event.isRecurrence ? '' : event.id;
    eventForm.eventType.value = event.type;
    eventForm.eventTitle.value = event.title;
    eventForm.eventDate.value = event.event_date;
    eventForm.eventDescription.value = event.description;
    eventForm.isRecurring.checked = event.is_recurring;

    if (event.owner_id === loggedInUserId && !event.isRecurrence) {
      deleteBtn.style.display = "block";
    } else {
      deleteBtn.style.display = "none";
    }
  } else {
    eventForm.reset();
    eventForm.eventId.value = "";
    eventForm.eventDate.value = date;
    deleteBtn.style.display = "none";
  }

  // Add event listener for the close button
  closeBtn.onclick = closeModal;

  // Add event listener for clicking outside the modal
  window.onclick = function(event) {
    if (event.target == modal) {
      closeModal();
    }
  };
}

let currentEvents = [];
async function saveEvent(event) {
  event.preventDefault();

  const eventDate = new Date(document.getElementById("eventDate").value + 'T00:00:00Z');
  const formattedDate = eventDate.toISOString().split('T')[0];

  const selectedFamilyButton = document.querySelector('.family-button.selected');
  if (!selectedFamilyButton) {
    alert("Please select a family before saving an event.");
    return;
  }
  const familyId = selectedFamilyButton.dataset.familyId;

  const eventData = {
    id: document.getElementById("eventId").value,
    type: document.getElementById("eventType").value,
    title: document.getElementById("eventTitle").value,
    event_date: formattedDate,
    description: document.getElementById("eventDescription").value,
    is_recurring: document.getElementById("isRecurring").checked,
    family_id: familyId
  };

  try {
    const response = await makeAuthenticatedRequest("/api/dashboard/calendar", {
      method: eventData.id ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`Failed to save event: ${errorText}`);
    }

    const savedEvent = await response.json();
    console.log("Saved event:", savedEvent); // Add this line

    // Refresh the calendar events
    const updatedEvents = await fetchCalendarEvents(familyId);
    currentEvents = handleRecurringEvents(updatedEvents);
    updateCalendar(currentEvents);

    closeModal();
    alert("Event saved successfully!");
  } catch (error) {
    console.error("Error saving event:", error);
    alert(`Failed to save event: ${error.message}`);
  }
}

// Add this event listener to the form
document.getElementById("eventForm").addEventListener("submit", saveEvent);

function handleRecurringEvents(events) {
  const today = new Date();
  const endOfYear = new Date(today.getFullYear() + 1, 11, 31); // Show events up to end of next year

  return events.flatMap((event) => {
    const eventDate = new Date(event.event_date);
    if (event.is_recurring) {
      const eventDates = [];
      let nextOccurrence = new Date(eventDate);

      while (nextOccurrence <= endOfYear) {
        eventDates.push({
          ...event,
          event_date: nextOccurrence.toISOString().split('T')[0],
          isRecurrence: nextOccurrence.getTime() !== eventDate.getTime()
        });
        nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
      }

      // Only return the next occurrence
      return eventDates.length > 0 ? [eventDates[0]] : [];
    } else {
      return [{...event, event_date: eventDate.toISOString().split('T')[0]}];
    }
  });
}

async function deleteEvent() {
  const eventId = document.getElementById("eventId").value;
  if (!eventId) return;

  try {
    const response = await makeAuthenticatedRequest(
      `/api/dashboard/calendar/${eventId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete event");
    }

    currentEvents = currentEvents.filter((e) => e.id !== eventId);
    updateCalendar(currentEvents);
    closeModal();
    alert("Event deleted successfully!");
  } catch (error) {
    console.error("Error deleting event:", error);
    alert("Failed to delete event. Please try again.");
  }
}

// Add this event listener to the delete button
document.getElementById("deleteEvent").addEventListener("click", deleteEvent);

function closeModal() {
  const modal = document.getElementById("eventModal");
  if (modal) {
    modal.style.display = "none";
  } else {
    console.error("Modal element not found");
  }
}

async function fetchCalendarEvents(familyId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/dashboard/calendar/${familyId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const events = await response.json();
    console.log("Fetched events:", events); // Add this line
    return events;
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return [];
  }
}

async function initDashboard() {
  try {
    console.log("Initializing dashboard...");
    const user = await fetchUserProfile();
    if (!user) {
      console.log("No user found. Redirecting to login...");
      window.location.href = "index.html";
      return;
    }
    console.log("Fetched user profile:", user);
    updateUserProfile(user);
    
    const families = await fetchUserFamilies();
    console.log("Fetched user families:", families);
    updateFamilySelector(families);

    if (families.length > 0) {
      let familyToView = families[0].family_id;
      
      const storedFamilyId = localStorage.getItem("familyId");
      if (storedFamilyId) {
        console.log("Using stored family ID:", storedFamilyId);
        familyToView = storedFamilyId;
      }

      console.log("Viewing family:", familyToView);
      await viewFamily(familyToView);
    } else {
      console.log("No families found. Redirecting to onboarding...");
      window.location.href = "onboarding.html";
    }

    setupEventListeners();
  } catch (error) {
    console.error("Error initializing dashboard:", error);
    alert("An error occurred while loading the dashboard. Please try refreshing the page.");
  }
}

function updateFamilySelector(families) {
  const familySelector = document.getElementById("familySelector");
  if (familySelector) {
    familySelector.innerHTML = ''; // Clear existing content
    families.forEach(family => {
      const button = document.createElement("button");
      button.className = "family-button";
      button.textContent = family.family_name;
      button.dataset.familyId = family.family_id;
      familySelector.appendChild(button);
    });

    familySelector.addEventListener("click", async (e) => {
      if (e.target.classList.contains("family-button")) {
        const selectedFamilyId = e.target.dataset.familyId;
        if (selectedFamilyId) {
          // Remove 'selected' class from all buttons
          familySelector.querySelectorAll('.family-button').forEach(btn => {
            btn.classList.remove('selected');
          });
          // Add 'selected' class to clicked button
          e.target.classList.add('selected');
          await viewFamily(selectedFamilyId);
        }
      }
    });

    // Select the first family by default
    if (families.length > 0) {
      const firstFamilyButton = familySelector.querySelector('.family-button');
      if (firstFamilyButton) {
        firstFamilyButton.classList.add('selected');
        viewFamily(families[0].family_id);
      }
    }
  } else {
    console.error("Family selector element not found");
  }
}

function showCreateFamilyModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Create New Family</h2>
      <p>Would you like to create a new family?</p>
      <button id="confirmCreateFamily" class="cta-button">Yes, Create New Family</button>
      <button id="closeModal" class="secondary-button">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    document.body.removeChild(modal);
  };

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('confirmCreateFamily').addEventListener('click', () => {
    // Redirect to the onboarding page
    window.location.href = '/onboarding.html?createFamily=true';
  });
}

async function createFamily(familyName) {
  try {
    const response = await makeAuthenticatedRequest('/api/dashboard/families', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ familyName }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.familyId;
  } catch (error) {
    console.error('Error creating family:', error);
    alert('Failed to create family. Please try again.');
    return null;
  }
}

function showInviteMembersModal(familyId, familyName) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Invite Members to ${familyName}</h2>
      <form id="inviteMembersForm">
        <div class="input-container">
          <input type="email" id="memberEmail" placeholder="Enter email address">
          <i class="fas fa-envelope input-icon"></i>
        </div>
        <button type="button" id="addMemberBtn" class="secondary-button">Add</button>
        <ul id="invitedMembersList"></ul>
        <div class="progress-indicator">
          <span id="membersCount">0</span> family members invited
        </div>
        <button type="submit" class="cta-button">Send Invitations</button>
      </form>
      <button id="closeModal" class="secondary-button">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  const invitedMembers = [];

  const closeModal = () => {
    document.body.removeChild(modal);
  };

  const updateInvitedMembersList = () => {
    const list = document.getElementById('invitedMembersList');
    list.innerHTML = invitedMembers.map(email => `
      <li>${email} <button type="button" class="removeMember" data-email="${email}">Remove</button></li>
    `).join('');

    document.querySelectorAll('.removeMember').forEach(button => {
      button.addEventListener('click', (e) => {
        const emailToRemove = e.target.getAttribute('data-email');
        const index = invitedMembers.indexOf(emailToRemove);
        if (index > -1) {
          invitedMembers.splice(index, 1);
          updateInvitedMembersList();
          updateMembersCount();
        }
      });
    });
  };

  const updateMembersCount = () => {
    document.getElementById('membersCount').textContent = invitedMembers.length;
  };

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('addMemberBtn').addEventListener('click', () => {
    const email = document.getElementById('memberEmail').value.trim();
    if (email && !invitedMembers.includes(email)) {
      invitedMembers.push(email);
      updateInvitedMembersList();
      document.getElementById('memberEmail').value = '';
      updateMembersCount();
    }
  });

  document.getElementById('inviteMembersForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (invitedMembers.length > 0) {
      await inviteMembers(familyId, invitedMembers);
      closeModal();
      // Refresh the family list and view the new family
      const families = await fetchUserFamilies();
      updateFamilySelector(families);
      await viewFamily(familyId);
    } else {
      alert('Please invite at least one family member before finishing.');
    }
  });
}

async function inviteMembers(familyId, emails) {
  try {
    for (const email of emails) {
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
    }
    alert('Invitations sent successfully!');
  } catch (error) {
    console.error('Error inviting family members:', error);
    alert(`Failed to invite family members: ${error.message}`);
  }
}

async function inviteMembers(familyId, emails) {
  try {
    for (const email of emails) {
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
    }
    alert('Invitations sent successfully!');
  } catch (error) {
    console.error('Error inviting family members:', error);
    alert(`Failed to invite family members: ${error.message}`);
  }
}

async function updateSocialFeed(familyId) {
  // Clear existing posts
  const socialFeedContent = document.getElementById("socialFeedContent");
  if (socialFeedContent) {
    socialFeedContent.innerHTML = "";
  }

  if (typeof updateCurrentFamilyId === "function") {
    updateCurrentFamilyId(familyId);
  }

  if (typeof initializeSocialFeed === "function") {
    await initializeSocialFeed(familyId);
  }
}

function setupEventListeners() {
  const createFamilyBtn = document.getElementById("createFamilyBtn");
  if (createFamilyBtn) {
    createFamilyBtn.addEventListener("click", showCreateFamilyModal);
  }

  const inviteMemberBtn = document.getElementById("inviteMemberBtn");
  if (inviteMemberBtn) {
    inviteMemberBtn.addEventListener("click", showInviteMemberModal);
  }
}
document.addEventListener("DOMContentLoaded", function() {
  initDashboard();


  document.getElementById("toggleLeftColumn").addEventListener("click", function() {
      toggleElementVisibility("leftColumn");
  });

  document.getElementById("togglePostForm").addEventListener("click", function() {
      toggleElementVisibility("postForm");
  });

  document.getElementById("toggleRightColumn").addEventListener("click", function() {
      toggleElementVisibility("rightColumn");
  });

  document.getElementById("overlay").addEventListener("click", function() {
      closeAllElements();
  });
});

function toggleElementVisibility(elementId) {
  const element = document.getElementById(elementId);
  const overlay = document.getElementById("overlay");

  if (element) {
      if (element.classList.contains("open")) {
          element.classList.remove("open");
          overlay.classList.remove("active");
      } else {
          closeAllElements(); 
          element.classList.add("open");
          overlay.classList.add("active");
      }
  }
}

function closeAllElements() {
  document.getElementById("leftColumn")?.classList.remove("open");
  document.getElementById("rightColumn")?.classList.remove("open");
  document.getElementById("postForm")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("active");
}