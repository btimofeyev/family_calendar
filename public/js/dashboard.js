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

    // Fetch and update calendar events
    const events = await fetchCalendarEvents(familyId);
    currentEvents = handleRecurringEvents(events);
    updateCalendar(currentEvents);
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
        window.location.href = `/profile.html?userId=${member.id}`;
      });
      memberList.appendChild(listItem);
    });
  }

  const inviteMemberBtn = document.getElementById("inviteMemberBtn");
  if (inviteMemberBtn) {
    inviteMemberBtn.addEventListener("click", showInviteMemberModal);
  }
}

function showInviteMemberModal(familyId) {
  const modal = document.getElementById("inviteMemberModal");
  modal.style.display = "block";

  const inviteForm = document.getElementById("inviteMemberForm");
  inviteForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("inviteEmail").value;
    await inviteFamilyMember(familyId, email);
    modal.style.display = "none";
  };
}

async function inviteFamilyMember(familyId, email) {
  try {
    const response = await makeAuthenticatedRequest(`/api/dashboard/families/${familyId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error("Failed to invite family member");
    }

    alert("Invitation sent successfully!");
  } catch (error) {
    console.error("Error inviting family member:", error);
    alert("Failed to invite family member. Please try again.");
  }
}

let currentDate = new Date();
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function updateCalendar(events) {
  const calendarGrid = document.getElementById("calendarGrid");
  const monthYear = document.getElementById("monthYear");
  const eventList = document.getElementById("eventList");

  // Sort events by date to find the next three
  const upcomingEvents = events
  .filter((event) => new Date(event.event_date + 'T00:00:00Z') >= new Date())
  .sort((a, b) => new Date(a.event_date + 'T00:00:00Z') - new Date(b.event_date + 'T00:00:00Z'))
  .slice(0, 3);

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

    const eventDate = new Date(
      Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), i)
    );
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
  const selectedFamilyId = document.getElementById("familySelector").value;
  if (selectedFamilyId) {
    fetchCalendarEvents(selectedFamilyId).then(events => {
      currentEvents = handleRecurringEvents(events);
      updateCalendar(currentEvents);
    });
  }
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  const selectedFamilyId = document.getElementById("familySelector").value;
  if (selectedFamilyId) {
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

  const eventData = {
    id: document.getElementById("eventId").value,
    type: document.getElementById("eventType").value,
    title: document.getElementById("eventTitle").value,
    event_date: formattedDate,
    description: document.getElementById("eventDescription").value,
    is_recurring: document.getElementById("isRecurring").checked,
  };
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    const response = await makeAuthenticatedRequest("/api/dashboard/calendar", {
      method: eventData.id ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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
    // Update currentEvents array
    if (eventData.id) {
      const index = currentEvents.findIndex((e) => e.id === savedEvent.id);
      if (index !== -1) {
        currentEvents[index] = savedEvent;
      }
    } else {
      currentEvents.push(savedEvent);
    }
    let updatedEvents = handleRecurringEvents(currentEvents);
    updateCalendar(updatedEvents);
    closeModal();
    alert("Event saved successfully!");
  } catch (error) {
    console.error("Error saving event:", error);
    alert(`Failed to save event: ${error.message}`);
  }
}
function handleRecurringEvents(events) {
  const today = new Date();
  const endOfYear = new Date(today.getFullYear() + 1, 11, 31); // Show events up to end of next year

  return events.flatMap((event) => {
    if (event.is_recurring) {
      const eventDates = [];
      let nextOccurrence = new Date(event.event_date);

      while (nextOccurrence <= endOfYear) {
        eventDates.push({
          ...event,
          event_date: nextOccurrence.toISOString().split('T')[0],
          isRecurrence: nextOccurrence.getTime() !== new Date(event.event_date).getTime()
        });
        nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
      }

      return eventDates;
    } else {
      return [event];
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
async function inviteFamilyMember(email) {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest("/api/invitations/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! status: ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending invitation:", error);
    throw error;
  }
}

async function initDashboard() {
  try {
    const user = await fetchUserProfile();
    updateUserProfile(user);
    
    const families = await fetchUserFamilies();
    updateFamilySelector(families);

    if (families.length > 0) {
      const selectedFamilyId = families[0].family_id;
      await viewFamily(selectedFamilyId);
    } else {
      updateFamilyView(null, []);
      updateCalendar([]); // Update calendar with empty events when no family is selected
    }

    setupEventListeners();
  } catch (error) {
    console.error("Error initializing dashboard:", error);
  }
}

function updateFamilySelector(families) {
  const familySelector = document.getElementById("familySelector");
  if (familySelector) {
    familySelector.innerHTML = "<option value=''>Select a family</option>";
    families.forEach(family => {
      const option = document.createElement("option");
      option.value = family.family_id;
      option.textContent = family.family_name;
      familySelector.appendChild(option);
    });

    familySelector.addEventListener("change", async (e) => {
      const selectedFamilyId = e.target.value;
      if (selectedFamilyId) {
        await viewFamily(selectedFamilyId);
      } else {
        updateFamilyView(null, []);
        updateCalendar([]); // Update calendar with empty events when no family is selected
      }
    });
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

function showCreateFamilyModal() {
  // Implement the modal for creating a new family
}

function showInviteMemberModal() {
  // Implement the modal for inviting a new member
}

// Add this function near the top of the file, after other function definitions
async function fetchCalendarEvents(familyId) {
  try {
    const response = await makeAuthenticatedRequest(`/api/dashboard/calendar/${familyId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return [];
  }
}

document.addEventListener("DOMContentLoaded", initDashboard);
