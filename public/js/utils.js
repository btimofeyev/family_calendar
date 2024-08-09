async function refreshAccessToken() {
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        credentials: 'include', // Include cookies in the request
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        return data.token;
      } else {
        showLogoutModal(); // Show the modal instead of alert
      }
    } catch (error) {
      console.error('Error refreshing access token:', error);
      showLogoutModal(); // Show the modal instead of alert
    }
  }
  
  async function makeAuthenticatedRequest(url, options = {}) {
    let token = localStorage.getItem('token');
    if (!token) {
      token = await refreshAccessToken();
    }
  
    options.headers = options.headers || {};
    options.headers.Authorization = `Bearer ${token}`;
  
    let response = await fetch(url, options);
  
    if (response.status === 401) {
      token = await refreshAccessToken();
      if (token) {
        options.headers.Authorization = `Bearer ${token}`;
        response = await fetch(url, options);
      }
    }
  
    return response;
  }
  
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('familyId');
    window.location.href = 'index.html'; // Redirect to the login page
  }
  
  function showLogoutModal() {
    const logoutModal = document.getElementById('logoutModal');
    if (logoutModal) {
      logoutModal.style.display = 'flex'; // Show the modal
      const loginRedirectButton = document.getElementById('loginRedirect');
      loginRedirectButton.addEventListener('click', () => {
        window.location.href = 'index.html'; // Redirect to the login page
      });
    }
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    const logoutIcon = document.getElementById('logoutIcon');
    if (logoutIcon) {
      logoutIcon.addEventListener('click', logout);
    }
  });
  