window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "PantryPulse") return;

  if (event.data.action === "PING") {
    window.postMessage({ source: "PantryPulseExt", action: "PONG" }, "*");
  }

  if (event.data.action === "PLACE_ORDER") {
    chrome.runtime.sendMessage(event.data);
  }
});
