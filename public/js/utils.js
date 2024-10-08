async function refreshAccessToken() {
  try {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return null;
  }
}

async function makeAuthenticatedRequest(url, options = {}) {
  let token = localStorage.getItem("token");

  const makeRequest = async (token) => {
    const requestOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    };
    return fetch(url, requestOptions);
  };

  let response = await makeRequest(token);

  if (response.status === 403) {
    token = await refreshAccessToken();
    if (token) {
      localStorage.setItem("token", token);
      response = await makeRequest(token);
    } else {
      // If token refresh fails, redirect to login page
      window.location.href = "index.html";
      return null;
    }
  }

  return response;
}

function logout() {
  fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  })
    .then((response) => {
      if (response.ok) {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("familyId");
        window.location.href = "index.html";
      } else {
        console.error("Failed to log out");
      }
    })
    .catch((error) => console.error("Error during logout:", error));
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutIcon = document.getElementById("logoutIcon");
  if (logoutIcon) {
    logoutIcon.addEventListener("click", logout);
  }
});
