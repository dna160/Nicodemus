/**
 * Content script for Student Rep Agent
 * Injected into every webpage to capture user interactions
 * Note: This script respects user privacy and only captures interaction timing, not content
 */

// Track keystroke activity on the page
let keystrokesSinceLastReport = 0;
let lastKeystrokeTime = Date.now();

// Listen for keypresses (timing only, no content)
document.addEventListener(
  "keydown",
  (event) => {
    keystrokesSinceLastReport++;
    lastKeystrokeTime = Date.now();
  },
  true // Use capture phase to catch early
);

// Listen for mouse clicks
document.addEventListener(
  "click",
  () => {
    lastKeystrokeTime = Date.now();
  },
  true
);

// Listen for mouse movements (optional - helps detect idle time)
let lastMouseMoveTime = Date.now();
document.addEventListener(
  "mousemove",
  () => {
    lastMouseMoveTime = Date.now();
  },
  false
);

// Periodically report activity to background script
setInterval(() => {
  if (keystrokesSinceLastReport > 0) {
    chrome.runtime.sendMessage({
      type: "content_activity",
      keystrokes: keystrokesSinceLastReport,
      timestamp: Date.now()
    });

    keystrokesSinceLastReport = 0;
  }
}, 5000); // Report every 5 seconds

// Listen for visibility changes (page focus)
document.addEventListener("visibilitychange", () => {
  chrome.runtime.sendMessage({
    type: "visibility_change",
    hidden: document.hidden,
    timestamp: Date.now()
  });
});

console.log("[Student Rep Content] Initialized");
