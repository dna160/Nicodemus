/**
 * Side Panel Component
 * Chrome side panel for stuck students on productive sites
 * Shows helpful study tips and encouragement
 */

import { useState, useEffect } from "react";
import { Lightbulb, BookOpen, Coffee, Focus } from "lucide-react";

import { HelperCard } from "~/components/HelperCard";

const STUDY_TIPS = [
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: "Break It Down",
    description:
      "Feeling stuck? Try breaking your task into smaller, more manageable pieces. Even 5 minutes of progress counts!",
  },
  {
    icon: <Focus className="w-5 h-5" />,
    title: "Use the Pomodoro Technique",
    description:
      "Work intensely for 25 minutes, then take a 5-minute break. This rhythm helps many students focus better.",
  },
  {
    icon: <Coffee className="w-5 h-5" />,
    title: "Take a Quick Break",
    description:
      "Sometimes your brain just needs a reset. Step away for 2-3 minutes and come back refreshed.",
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    title: "Ask for Help",
    description:
      "Don't stay stuck for long. Reach out to your teacher, classmates, or use office hours to get unstuck.",
  },
  {
    icon: <Focus className="w-5 h-5" />,
    title: "Change Your Environment",
    description:
      "If you're struggling at your desk, try the library or a different room. A fresh space can spark focus.",
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: "Review & Summarize",
    description:
      "Write down what you've already learned. Teaching yourself reinforces understanding and builds momentum.",
  },
];

export default function SidePanel() {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [domain, setDomain] = useState("");

  useEffect(() => {
    // Get current domain from message or tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          setDomain(url.hostname.replace("www.", ""));
        } catch {
          setDomain("this site");
        }
      }
    });

    // Listen for side panel open message
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "OPEN_HELPER") {
        // Could use message.payload.domain here if needed
      }
    });
  }, []);

  function handleNextTip() {
    setCurrentTipIndex((prev) => (prev + 1) % STUDY_TIPS.length);
  }

  function handleDismiss() {
    // Send message to background to mark helper as dismissed
    chrome.runtime.sendMessage({ type: "DISMISS_HELPER" });
    // Close the side panel
    chrome.sidePanel.setOptions({ path: "" });
  }

  const currentTip = STUDY_TIPS[currentTipIndex];

  return (
    <div className="w-full h-full bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-muted p-4 space-y-1">
        <h1 className="text-base font-bold">Looks like you might be stuck</h1>
        <p className="text-xs text-muted-foreground">
          You've been on <span className="font-medium">{domain}</span> for a
          while. Here are some ideas to help.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <HelperCard
            icon={currentTip.icon}
            title={currentTip.title}
            description={currentTip.description}
            actionText="More Ideas"
            onAction={handleNextTip}
          />

          {/* Additional encouragement */}
          <div className="bg-success/5 border border-success/20 rounded-lg p-4 text-center space-y-2">
            <p className="text-xs font-medium text-success">You've got this!</p>
            <p className="text-xs text-muted-foreground">
              Getting stuck is part of learning. Every challenge you overcome
              makes you stronger.
            </p>
          </div>

          {/* Quick stats */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Tip:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Try explaining the problem in your own words</li>
              <li>Search for similar examples online</li>
              <li>Write pseudocode before coding</li>
              <li>Check if you're overthinking it</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-muted p-3 space-y-2">
        <p className="text-xs text-muted-foreground text-center">
          Tip {currentTipIndex + 1} of {STUDY_TIPS.length}
        </p>
        <button
          onClick={handleDismiss}
          className="w-full py-2 px-3 text-xs font-medium rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
        >
          I'm Good, Close This
        </button>
      </div>
    </div>
  );
}
