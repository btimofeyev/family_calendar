console.log('Push Notifications script loaded');

function requestNotificationPermission() {
  if ("Notification" in window) {
    Notification.requestPermission().then((result) => {
      console.log("Notification permission result:", result);
      if (result === "granted") {
        console.log("Notification permission granted.");
        registerPushSubscription();
      } else {
        console.log("Notification permission denied.");
      }
    });
  } else {
    console.error("Notifications are not supported in this browser.");
  }
}

function registerPushSubscription() {
    console.log('Attempting to register push subscription');
    
    if (!('PushManager' in window)) {
      console.error('Push messaging is not supported');
      return;
    }
  
    navigator.serviceWorker.register('/js/serviceworker.js')
      .then(registration => {
        console.log('Service Worker registered', registration);
        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array('BDVLcDnmydpssIa0St3OM_tq3n4GVF1vcEO25VYWZRlAq0fMrbxv46cBJnA47hV7aFeO2HZ0pnuHnq-pdvq5UjE')
        });
      })
      .then(subscription => {
        console.log('User is subscribed:', subscription);
        return sendSubscriptionToServer(subscription);
      })
      .catch(err => {
        console.error('Failed to subscribe the user: ', err);
        if (err.name === 'NotAllowedError') {
          console.log('Permission for push notifications was denied');
        } else if (err.name === 'AbortError') {
          console.log('Push subscription aborted, possibly due to a timeout');
        }
      });
  }
async function sendSubscriptionToServer(subscription) {
  console.log("Sending subscription to server:", subscription);

  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log("Subscription sent to server successfully:", data);
  } catch (err) {
    console.error("Failed to send subscription to server:", err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Automatically request permission and subscribe when the script loads
requestNotificationPermission();