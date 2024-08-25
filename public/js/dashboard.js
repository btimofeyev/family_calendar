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
    const response = await makeAuthenticatedRequest("/api/dashboard/profile");
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Response status:", response.status);
      console.error("Response body:", errorBody);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const user = await response.json();
    loggedInUserId = user.id;
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
    console.log("Events before handling recurring:", events); // Add this line
    currentEvents = handleRecurringEvents(events);
    console.log("Events after handling recurring:", currentEvents); // Add this line
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
    <button id="inviteMemberBtn">Invite Member</button>
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
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Invite Family Member</h2>
      <form id="inviteMemberForm">
        <input type="email" id="inviteEmail" placeholder="Enter email address" required>
        <button type="submit">Send Invitation</button>
      </form>
      <button id="closeModal">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    document.body.removeChild(modal);
  };

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('inviteMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('inviteEmail').value;
    await inviteFamilyMember(email);
    closeModal();
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
    listItem.className = `event-list-item event-${event.type || "default"}`;
    listItem.innerHTML = `
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
    
    console.log(`Events for ${eventDate.toDateString()}:`, dayEvents);

    if (dayEvents.length > 0) {
      day.classList.add("has-event");
      day.style.backgroundColor = "lightblue"; 
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

  modal.style.display = "block";

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

      return eventDates;
    } else {
      return [{...event, event_date: eventDate.toISOString().split('T')[0]}];
    }
  });
}

async function deleteEvent() {
  const eventId = document.getElementById("eventId").value;
  if (!eventId) return;

  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest(
      `/api/dashboard/calendar/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete event");
    }

    currentEvents = currentEvents.filter((e) => e.id !== eventId);
    updateCalendar(currentEvents);
    closeModal();
  } catch (error) {
    console.error("Error deleting event:", error);
    alert("Failed to delete event. Please try again.");
  }
}

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
    const user = await fetchUserProfile();
    updateUserProfile(user);
    
    const families = await fetchUserFamilies();
    updateFamilySelector(families);

    if (families.length > 0) {
      await viewFamily(families[0].family_id);
    } else {
      updateFamilyView(null, []);
      updateCalendar([]);
    }

    setupEventListeners();
  } catch (error) {
    console.error("Error initializing dashboard:", error);
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
      <form id="createFamilyForm">
        <input type="text" id="familyName" placeholder="Enter family name" required>
        <button type="submit">Create Family</button>
      </form>
      <button id="closeModal">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    document.body.removeChild(modal);
  };

  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('createFamilyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const familyName = document.getElementById('familyName').value;
    await createFamily(familyName);
    closeModal();
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
    alert(`Family "${familyName}" created successfully!`);

    // Refresh the family list and view the new family
    const families = await fetchUserFamilies();
    updateFamilySelector(families);
    await viewFamily(result.familyId);

  } catch (error) {
    console.error('Error creating family:', error);
    alert('Failed to create family. Please try again.');
  }
}

async function updateSocialFeed(familyId) {
  // Clear existing posts
  const socialFeedContent = document.getElementById("socialFeedContent");
  if (socialFeedContent) {
    socialFeedContent.innerHTML = "";
  }

  // Update currentFamilyId in socialFeed.js
  if (typeof updateCurrentFamilyId === "function") {
    updateCurrentFamilyId(familyId);
  }

  // Fetch and display new posts
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

  // Add event listeners for the floating icons
  document.getElementById("toggleLeftColumn").addEventListener("click", function() {
      toggleElementVisibility("leftColumn");
  });

  document.getElementById("togglePostForm").addEventListener("click", function() {
      toggleElementVisibility("postForm");
  });

  document.getElementById("toggleRightColumn").addEventListener("click", function() {
      toggleElementVisibility("rightColumn");
  });

  // Add event listener for closing when clicking outside (on overlay)
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
          closeAllElements(); // Close any other open elements first
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