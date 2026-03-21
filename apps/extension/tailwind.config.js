/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.{tsx,ts}",
    "!./node_modules/**",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background, #ffffff)",
        foreground: "var(--foreground, #000000)",
        primary: "var(--primary, #3b82f6)",
        "primary-foreground": "var(--primary-foreground, #ffffff)",
        secondary: "var(--secondary, #8b5cf6)",
        success: "var(--success, #10b981)",
        destructive: "var(--destructive, #ef4444)",
        muted: "var(--muted, #f3f4f6)",
        "muted-foreground": "var(--muted-foreground, #6b7280)",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
      },
      spacing: {
        "safe-top": "max(1rem, env(safe-area-inset-top))",
        "safe-bottom": "max(1rem, env(safe-area-inset-bottom))",
      },
      animation: {
        "slide-up": "slide-up 300ms ease-out",
        "fade-in": "fade-in 300ms ease-out",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
