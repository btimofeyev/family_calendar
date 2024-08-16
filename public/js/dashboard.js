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
async function createFamily(familyName) {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest("/api/dashboard/families", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ familyName }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error! status: ${response.status}: ${errorBody}`);
    }

    const result = await response.json();

    const updatedUser = await fetchUserProfile();
    updateUserProfile(updatedUser);

    const events = await fetchCalendarEvents();
    updateCalendar(events);

    return result;
  } catch (error) {
    console.error("Error creating family:", error);
    alert(`Failed to create family: ${error.message}`);
    throw error;
  }
}

async function addFamilyMember(email) {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest(
      "/api/dashboard/family/member",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error adding family member:", error);
    throw error;
  }
}
// Function to update UI with user data
function updateUserProfile(user) {
  if (user) {
    const userAvatar = document.getElementById("userAvatar");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const userFamilyName = document.getElementById("userFamilyName");
    const createFamilySection = document.getElementById("createFamilySection");
    const addMemberSection = document.getElementById("addMemberSection");
    const familyCalendar = document.getElementById("familyCalendar");

    if (userAvatar) userAvatar.textContent = user.name.charAt(0);
    if (userName) userName.textContent = user.name;
    if (userEmail) userEmail.textContent = user.email;

    if (user.family_id) {
      if (userFamilyName)
        userFamilyName.textContent = `Family: ${user.family_name}`;
      if (createFamilySection) createFamilySection.style.display = "none";
      if (addMemberSection) addMemberSection.style.display = "block";
      if (familyCalendar) familyCalendar.style.display = "block";
    } else {
      if (userFamilyName) userFamilyName.textContent = "No family assigned";
      if (createFamilySection) createFamilySection.style.display = "block";
      if (addMemberSection) addMemberSection.style.display = "none";
      if (familyCalendar) familyCalendar.style.display = "none";
    }
  } else {
    console.error("No user data provided to updateUserProfile");
    const userProfile = document.getElementById("userProfile");
    if (userProfile)
      userProfile.innerHTML = "<p>Failed to load user profile</p>";
    const familyCalendar = document.getElementById("familyCalendar");
    if (familyCalendar) familyCalendar.style.display = "none";
  }
}
async function fetchFamilyMembers() {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest(
      "/api/dashboard/family/members",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch family members");
    }

    const members = await response.json();
    updateFamilyMembersList(members);
  } catch (error) {
    console.error("Error fetching family members:", error);
  }
}

function updateFamilyMembersList(members) {
  const memberListContent = document.getElementById("memberListContent");
  memberListContent.innerHTML = "";

  members.forEach((member) => {
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
      window.location.href = `profile.html?id=${member.id}`;
    });
    memberListContent.appendChild(listItem);
  });
}
async function fetchCalendarEvents() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No token found");
    }

    const response = await fetch("/api/dashboard/calendar", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch calendar events");
    }

    currentEvents = await response.json();
    return currentEvents;
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return [];
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
    .filter((event) => new Date(event.event_date) >= new Date())
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .slice(0, 3);

  // Clear the event list and populate it with upcoming events
  eventList.innerHTML = "";
  upcomingEvents.forEach((event) => {
    const eventDate = new Date(event.event_date);
    const listItem = document.createElement("li");
    listItem.className = `event-list-item event-${event.type || "default"}`;
    listItem.innerHTML = `
      <div class="event-title">${event.title}</div>
      <div class="event-date">${eventDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
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
      currentDate.getFullYear(),
      currentDate.getMonth(),
      i
    );
    const dayEvents = events.filter((event) => {
      const eventDay = new Date(event.event_date);

      return (
        eventDay.getDate() === eventDate.getDate() &&
        eventDay.getMonth() === eventDate.getMonth() &&
        eventDay.getFullYear() === eventDate.getFullYear()
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
  fetchCalendarEvents().then(updateCalendar);
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  fetchCalendarEvents().then(updateCalendar);
});

function showEventDetails(events, date) {
  const modal = document.getElementById("eventModal");
  const eventForm = document.getElementById("eventForm");
  const deleteBtn = document.getElementById("deleteEvent");

  modal.style.display = "block";

  if (events.length === 1) {
    const event = events[0];
    eventForm.eventId.value = event.id;
    eventForm.eventType.value = event.type;
    eventForm.eventTitle.value = event.title;
    eventForm.eventDate.value = event.event_date;
    eventForm.eventDescription.value = event.description;
    eventForm.isRecurring.checked = event.is_recurring;

    if (event.owner_id === loggedInUserId) {
      console.log(loggedInUserId);
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

  const eventData = {
    id: document.getElementById("eventId").value,
    type: document.getElementById("eventType").value,
    title: document.getElementById("eventTitle").value,
    event_date: document.getElementById("eventDate").value,
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
  const endOfYear = new Date(today.getFullYear() + 10, 11, 31); // Extend as necessary

  return events.flatMap((event) => {
    if (event.is_recurring) {
      const eventDates = [];
      let nextOccurrence = new Date(event.event_date);

      // Generate yearly occurrences up to the end of the extended year
      while (nextOccurrence <= endOfYear) {
        eventDates.push({ ...event, event_date: nextOccurrence.toISOString() });
        nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1); // Move to the next year
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

// Main function to initialize the dashboard
async function initDashboard() {
  try {
    const user = await fetchUserProfile();
    updateUserProfile(user);
    if (user && user.family_id) {
      let events = await fetchCalendarEvents();
      events = handleRecurringEvents(events);
      updateCalendar(events);

      await fetchFamilyMembers();
    } else {
      const familyCalendar = document.getElementById("familyCalendar");
      if (familyCalendar) {
        familyCalendar.innerHTML = "<p>No family calendar available</p>";
      }
    }

    // Event listeners
    const eventForm = document.getElementById("eventForm");
    if (eventForm) {
      eventForm.addEventListener("submit", saveEvent);
    }

    const deleteEventBtn = document.getElementById("deleteEvent");
    if (deleteEventBtn) {
      deleteEventBtn.addEventListener("click", deleteEvent);
    }

    const addEventBtn = document.getElementById("addEventBtn");
    if (addEventBtn) {
      addEventBtn.addEventListener("click", () => showEventDetails([]));
    }

    const closeModalBtn = document.getElementById("closeModalButton");
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", closeModal);
    } else {
      console.error("Close modal button not found");
    }

    // Close modal when clicking outside
    window.addEventListener("click", (event) => {
      const modal = document.getElementById("eventModal");
      if (event.target === modal) {
        closeModal();
      }
    });

    // Handle create family form
    const createFamilyForm = document.getElementById("createFamilyForm");
    if (createFamilyForm) {
      createFamilyForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const familyNameInput = document.getElementById("createFamilyName");
        if (!familyNameInput) {
          console.error("Family name input not found");
          alert("There was an error with the form. Please try again later.");
          return;
        }

        const familyName = familyNameInput.value.trim();

        try {
          const token = localStorage.getItem("token");
          if (!token) {
            throw new Error("No token found in local storage");
          }

          const response = await makeAuthenticatedRequest(
            "/api/dashboard/families",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ familyName }),
            }
          );

          const responseText = await response.text();

          if (!response.ok) {
            throw new Error(responseText || "Failed to create family");
          }

          const result = JSON.parse(responseText);

          const updatedUser = await fetchUserProfile();
          updateUserProfile(updatedUser);
          alert("Family created successfully!");
          familyNameInput.value = "";
        } catch (error) {
          console.error("Error creating family:", error);
          alert(`Failed to create family: ${error.message}`);
        }
      });
    } else {
      console.error("Create family form not found");
    }
    const inviteMemberForm = document.getElementById("inviteMemberForm");
    if (inviteMemberForm) {
      inviteMemberForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const inviteEmailInput = document.getElementById("inviteEmail");
        if (!inviteEmailInput) {
          console.error("Invite email input not found");
          alert("There was an error with the form. Please try again later.");
          return;
        }

        const email = inviteEmailInput.value.trim();

        try {
          await inviteFamilyMember(email);
          alert("Invitation sent successfully!");
          inviteEmailInput.value = "";
        } catch (error) {
          console.error("Error sending invitation:", error);
          alert(`Failed to send invitation: ${error.message}`);
        }
      });
    } else {
      console.error("Invite member form not found");
    }
  } catch (error) {
    console.error("Error initializing dashboard:", error);
  }
}

// Call the init function when the page loads
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  const leftColumn = document.querySelector(".left-column");
  const rightColumn = document.querySelector(".right-column");
  const postForm = document.querySelector("#postForm");
  const toggleLeftColumn = document.getElementById("toggleLeftColumn");
  const toggleRightColumn = document.getElementById("toggleRightColumn");
  const togglePostForm = document.getElementById("togglePostForm");
  const overlay = document.getElementById("overlay");

  toggleLeftColumn.addEventListener("click", () => {
    leftColumn.classList.toggle("open");
    rightColumn.classList.remove("open");
    postForm.classList.remove("open");
    overlay.classList.toggle("active", leftColumn.classList.contains("open"));
  });

  toggleRightColumn.addEventListener("click", () => {
    rightColumn.classList.toggle("open");
    leftColumn.classList.remove("open");
    postForm.classList.remove("open");
    overlay.classList.toggle("active", rightColumn.classList.contains("open"));
  });

  togglePostForm.addEventListener("click", () => {
    postForm.classList.toggle("open");
    leftColumn.classList.remove("open");
    rightColumn.classList.remove("open");
    overlay.classList.toggle("active", postForm.classList.contains("open"));
    window.scrollTo(0, postForm.offsetTop);
  });

  // Hide columns and form when clicking outside
  overlay.addEventListener("click", () => {
    leftColumn.classList.remove("open");
    rightColumn.classList.remove("open");
    postForm.classList.remove("open");
    overlay.classList.remove("active");
  });
});
