function requestNotificationPermission() {
  if ("Notification" in window) {
    Notification.requestPermission().then((result) => {
      if (result === "granted") {
        registerPushSubscription();
      } else {
      }
    });
  } else {
    console.error("Notifications are not supported in this browser.");
  }
}

function registerPushSubscription() {
  if (!("PushManager" in window)) {
    console.error("Push messaging is not supported");
    return;
  }

  navigator.serviceWorker
    .register("/js/serviceworker.js")
    .then((registration) => {
      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          "BDVLcDnmydpssIa0St3OM_tq3n4GVF1vcEO25VYWZRlAq0fMrbxv46cBJnA47hV7aFeO2HZ0pnuHnq-pdvq5UjE"
        ),
      });
    })
    .then((subscription) => {
      return sendSubscriptionToServer(subscription);
    })
    .catch((err) => {
      console.error("Failed to subscribe the user: ", err);
      if (err.name === "NotAllowedError") {
      } else if (err.name === "AbortError") {
      }
    });
}
async function sendSubscriptionToServer(subscription) {
  try {
    const response = await fetch("/api/notifications/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const data = await response.json();
    console.log('Push subscription sent to server successfully');
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

requestNotificationPermission();
