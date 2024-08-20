let socket;
let notifications = { unread: [], recent: [] };

function initializeNotifications() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.error("No user ID found");
    return;
  }

  socket = io();
  socket.emit("join", userId);

  // Listen for new notifications
  socket.on("new_notification", (notification) => {
    addNotification(notification);
    updateNotificationCount();
  });

  fetchNotifications();

  document
    .getElementById("notificationIcon")
    .addEventListener("click", toggleNotificationDropdown);
  document
    .getElementById("unreadTab")
    .addEventListener("click", () => showTab("unread"));
  document
    .getElementById("allTab")
    .addEventListener("click", () => showTab("all"));
  document
    .getElementById("markAllRead")
    .addEventListener("click", markAllNotificationsAsRead);
}

function getCurrentUserId() {
  return localStorage.getItem("userId");
}

async function fetchNotifications() {
  try {
    const token = localStorage.getItem("token");
    const response = await makeAuthenticatedRequest("/api/notifications", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch notifications");
    }

    notifications = await response.json();
    showTab("unread");
    updateNotificationCount();
  } catch (error) {
    console.error("Error fetching notifications:", error);
  }
}

function addNotification(notification) {
  notifications.unread.unshift(notification);
  notifications.recent.unshift(notification);
  if (notifications.recent.length > 10) {
    notifications.recent.pop();
  }
  if (document.querySelector(".active-tab").id === "unreadTab") {
    displayNotifications("unread");
  }
}

function displayNotifications(tab) {
  const notificationList = document.getElementById("notificationList");
  notificationList.innerHTML = "";

  const notificationsToShow =
    tab === "unread" ? notifications.unread : notifications.recent;
  notificationsToShow.forEach((notification) => {
    const element = createNotificationElement(notification);
    notificationList.appendChild(element);
  });
}

function createNotificationElement(notification) {
  const element = document.createElement("div");
  element.className = `notification-item ${notification.read ? "read" : "unread"}`;

  let content = notification.formatted_content || notification.content;
  if (notification.type === "reply") {
    content = content.replace("commented on your post", "replied to your comment");
  }

  if (notification.type === "event") {
    content = content.replace("added a new event", "added a new family event");
  }

  element.innerHTML = `
    <div class="notification-content">
      <p>${content}</p>
      <span class="notification-time">${formatTime(notification.created_at)}</span>
    </div>
  `;

  // Add click event to navigate to the post
  if (notification.post_id) {
    element.addEventListener("click", () => {
      navigateToPost(notification.post_id);
    });
  }

  return element;
}

function navigateToPost(postId) {
  const postElement = document.querySelector(
    `.social-post[data-post-id="${postId}"]`
  );
  if (postElement) {
    postElement.scrollIntoView({ behavior: "smooth" });
    // Optional: Highlight the post for a moment
    postElement.classList.add("highlighted");
    setTimeout(() => {
      postElement.classList.remove("highlighted");
    }, 2000);
  } else {
    console.error(`Post with ID ${postId} not found.`);
  }
}
function updateNotificationCount() {
  const unreadCount = notifications.unread.length;
  const countElement = document.getElementById("notificationCount");
  countElement.textContent = unreadCount;
  countElement.style.display = unreadCount > 0 ? "block" : "none";
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) {
    return "Just now";
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

function showTab(tab) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active-tab"));
  document.getElementById(`${tab}Tab`).classList.add("active-tab");
  displayNotifications(tab);
}

function toggleNotificationDropdown() {
  const dropdown = document.getElementById("notificationDropdown");
  dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
}

async function markAllNotificationsAsRead() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to mark notifications as read");
    }

    notifications.unread.forEach((n) => (n.read = true));
    notifications.unread = [];
    showTab("unread");
    updateNotificationCount();
  } catch (error) {
    console.error("Error marking notifications as read:", error);
  }
}

document.addEventListener("DOMContentLoaded", initializeNotifications);
