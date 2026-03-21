/**
 * Domain categorization utilities
 * Classifies websites as productive, distraction, or neutral
 */

import type { DomainCategory } from "~/types";

const PRODUCTIVE_DOMAINS = new Set([
  "docs.google.com",
  "khanacademy.org",
  "wikipedia.org",
  "classroom.google.com",
  "quizlet.com",
  "duolingo.com",
  "github.com",
  "stackoverflow.com",
  "coursera.org",
  "edx.org",
  "w3schools.com",
  "developer.mozilla.org",
  "python.org",
  "nodejs.org",
  "rust-lang.org",
  "golang.org",
  "latex.org",
  "overleaf.com",
  "notion.so",
  "obsidian.md",
  "google.com",
  "scholar.google.com",
  "pubmed.ncbi.nlm.nih.gov",
  "arxiv.org",
  "jstor.org",
  "gitbook.com",
]);

const DISTRACTION_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "twitch.tv",
  "discord.com",
  "facebook.com",
  "snapchat.com",
  "pinterest.com",
  "tumblr.com",
  " 9gag.com",
  "imgur.com",
  "fourplay.com",
  "netflix.com",
  "hulu.com",
  "primevideo.com",
  "disneyplus.com",
  "twitch.tv",
  "kick.com",
  "rumble.com",
  "dailymotion.com",
  "vimeo.com",
  "pornhub.com",
  "xvideos.com",
]);

/**
 * Extract hostname from a full URL string
 * Handles edge cases like localhost, file:// protocols, etc.
 *
 * @param url - Full URL string
 * @returns Hostname without protocol or path
 */
export function extractDomain(url: string): string {
  if (!url) return "";

  try {
    // Handle non-http protocols
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      if (url.startsWith("file://")) return "file";
      if (url.startsWith("about:")) return "about";
      if (url.startsWith("chrome-extension://")) return "chrome-extension";
      if (url.startsWith("chrome://")) return url.split("://")[1]?.split("/")[0] ?? "chrome";
      return "unknown";
    }

    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    // Strip www. prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    // Return exact matches immediately (docs.google.com is distinct from google.com)
    if (PRODUCTIVE_DOMAINS.has(hostname) || DISTRACTION_DOMAINS.has(hostname)) {
      return hostname;
    }

    // Normalize unknown subdomains of known domains
    // e.g. sub.khanacademy.org → khanacademy.org (but docs.google.com is already returned above)
    for (const domain of [...PRODUCTIVE_DOMAINS, ...DISTRACTION_DOMAINS]) {
      if (hostname.endsWith("." + domain)) {
        return domain;
      }
    }

    return hostname || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Categorize a domain as productive, distraction, or neutral
 *
 * @param url - Full URL string
 * @returns Domain category
 */
export function categorizeDomain(url: string): DomainCategory {
  const domain = extractDomain(url);

  // Check against productive domains (exact match or subdomain)
  for (const prodDomain of PRODUCTIVE_DOMAINS) {
    if (domain === prodDomain || domain.endsWith("." + prodDomain)) {
      return "productive";
    }
  }

  // Check against distraction domains (exact match or subdomain)
  for (const distrDomain of DISTRACTION_DOMAINS) {
    if (domain === distrDomain || domain.endsWith("." + distrDomain)) {
      return "distraction";
    }
  }

  // Default to neutral
  return "neutral";
}

/**
 * Check if a domain is during study hours
 * Helps determine if we should track this session
 *
 * @param studyHoursStart - Hour of day study starts (0-23)
 * @param studyHoursEnd - Hour of day study ends (0-23)
 * @param timestamp - Unix timestamp in milliseconds
 * @returns True if timestamp falls within study hours
 */
export function isWithinStudyHours(
  studyHoursStart: number,
  studyHoursEnd: number,
  timestamp: number = Date.now()
): boolean {
  const date = new Date(timestamp);
  const currentHour = date.getHours();

  // Handle case where study hours wrap around midnight
  if (studyHoursStart <= studyHoursEnd) {
    return currentHour >= studyHoursStart && currentHour < studyHoursEnd;
  } else {
    return currentHour >= studyHoursStart || currentHour < studyHoursEnd;
  }
}
