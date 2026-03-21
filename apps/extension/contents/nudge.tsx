/**
 * Content Script - Nudge Overlay
 * Injected onto distraction sites after 15 minutes of continuous use
 * Plain DOM implementation (not React) to avoid conflicts with host page
 */

// Scoped CSS for nudge overlay
const NUDGE_STYLES = `
  .nicodemus-nudge-container {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color-scheme: light dark;
  }

  .nicodemus-nudge-content {
    background: var(--background, #ffffff);
    border: 1px solid var(--muted, #f3f4f6);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 300px;
    min-width: 280px;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  @keyframes nicodemus-slide-up {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes nicodemus-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .nicodemus-nudge-container.animate-in {
    animation: nicodemus-slide-up 300ms ease-out, nicodemus-fade-in 300ms ease-out;
  }

  @media (max-width: 480px) {
    .nicodemus-nudge-container {
      bottom: 0;
      right: 0;
      left: 0;
      border-radius: 0.5rem 0.5rem 0 0;
    }
    .nicodemus-nudge-content {
      max-width: 100%;
      border-right: none;
      border-bottom: none;
    }
  }

  .nicodemus-nudge-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: linear-gradient(to bottom, rgba(239, 68, 68, 0.1), var(--background, #ffffff));
    border-radius: 0.5rem;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .nicodemus-nudge-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 9999px;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    margin: 0 auto;
  }

  .nicodemus-nudge-text {
    text-align: center;
  }

  .nicodemus-nudge-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--foreground, #000);
    margin: 0;
  }

  .nicodemus-nudge-message {
    font-size: 0.75rem;
    color: var(--muted-foreground, #6b7280);
    margin-top: 0.5rem;
  }

  .nicodemus-nudge-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .nicodemus-nudge-button {
    flex: 1;
    padding: 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid rgba(107, 114, 128, 0.3);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .nicodemus-nudge-button.dismiss {
    background: transparent;
    color: var(--muted-foreground, #6b7280);
  }

  .nicodemus-nudge-button.dismiss:hover {
    background: var(--muted, #f3f4f6);
  }

  .nicodemus-nudge-button.snooze {
    background: var(--primary, #3b82f6);
    color: var(--primary-foreground, #ffffff);
    border-color: var(--primary, #3b82f6);
  }

  .nicodemus-nudge-button.snooze:hover {
    opacity: 0.9;
  }

  .nicodemus-nudge-footer {
    font-size: 0.75rem;
    color: var(--muted-foreground, #6b7280);
    text-align: center;
  }
`;

let nudgeContainer: HTMLDivElement | null = null;
let dismissTimeout: NodeJS.Timeout | null = null;

/**
 * Create and show nudge overlay
 */
function showNudge(domain: string, duration: number) {
  // Remove existing nudge
  hideNudge();

  // Create style element if not exists
  if (!document.getElementById("nicodemus-nudge-styles")) {
    const style = document.createElement("style");
    style.id = "nicodemus-nudge-styles";
    style.textContent = NUDGE_STYLES;
    document.head.appendChild(style);
  }

  // Create container
  nudgeContainer = document.createElement("div");
  nudgeContainer.className = "nicodemus-nudge-container animate-in";
  nudgeContainer.id = "nicodemus-nudge-overlay";

  // Create card content
  const cleanDomain = domain.replace("www.", "");
  nudgeContainer.innerHTML = `
    <div class="nicodemus-nudge-content">
      <div class="nicodemus-nudge-card">
        <div class="nicodemus-nudge-icon">⚠️</div>
        <div class="nicodemus-nudge-text">
          <h3 class="nicodemus-nudge-title">Stay Focused!</h3>
          <p class="nicodemus-nudge-message">
            You've been on <strong>${cleanDomain}</strong> for <strong>${duration} minutes</strong>.
            Consider switching to a study site.
          </p>
        </div>
        <div class="nicodemus-nudge-buttons">
          <button class="nicodemus-nudge-button dismiss" id="nicodemus-dismiss-btn">
            Dismiss
          </button>
          <button class="nicodemus-nudge-button snooze" id="nicodemus-snooze-btn">
            Snooze 10 min
          </button>
        </div>
        <p class="nicodemus-nudge-footer">
          You can always come back to this later.
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(nudgeContainer);

  // Attach event listeners
  const dismissBtn = document.getElementById("nicodemus-dismiss-btn");
  const snoozeBtn = document.getElementById("nicodemus-snooze-btn");

  if (dismissBtn) {
    dismissBtn.addEventListener("click", handleDismiss);
  }

  if (snoozeBtn) {
    snoozeBtn.addEventListener("click", handleSnooze);
  }

  // Auto-dismiss after 60 seconds
  dismissTimeout = setTimeout(handleDismiss, 60 * 1000);
}

/**
 * Hide nudge overlay
 */
function hideNudge() {
  if (nudgeContainer) {
    nudgeContainer.style.opacity = "0";
    nudgeContainer.style.transition = "opacity 300ms ease-out";

    setTimeout(() => {
      if (nudgeContainer?.parentNode) {
        nudgeContainer.parentNode.removeChild(nudgeContainer);
      }
      nudgeContainer = null;
    }, 300);
  }

  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
    dismissTimeout = null;
  }
}

/**
 * Handle snooze button click
 */
function handleSnooze() {
  try {
    chrome.runtime.sendMessage({
      type: "SNOOZE_NUDGE",
    });
  } catch (e) {
    console.error("Error sending snooze message:", e);
  }
  hideNudge();
}

/**
 * Handle dismiss button click
 */
function handleDismiss() {
  hideNudge();
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: any) => {
  if (message.type === "SHOW_NUDGE") {
    showNudge(message.payload?.domain || "this site", message.payload?.duration || 15);
  } else if (message.type === "HIDE_NUDGE") {
    hideNudge();
  }
});

// Track user activity (keystrokes, scrolls)
document.addEventListener(
  "keydown",
  () => {
    try {
      chrome.runtime.sendMessage({
        type: "KEYPRESS",
      });
    } catch {
      // Silently ignore if messaging fails
    }
  },
  { passive: true, capture: false }
);

document.addEventListener(
  "scroll",
  () => {
    try {
      chrome.runtime.sendMessage({
        type: "SCROLL",
      });
    } catch {
      // Silently ignore if messaging fails
    }
  },
  { passive: true, capture: false }
);

console.log("Nicodemus Student Edge content script loaded");
