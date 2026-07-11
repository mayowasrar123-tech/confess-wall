/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Public wall — cork pinboard + paper notes
        cork: "#4A3728",
        "cork-dark": "#362819",
        "cork-fiber": "#55402E",
        paper: "#F5EFE3",
        "paper-shadow": "#E8DCC8",
        pin: "#C1443D",
        "pin-dark": "#8A2E28",
        ink: "#2B2118",
        muted: "#8A7B68",
        "muted-light": "#C9BBA5",
        like: "#5B8770",
        // Admin — moderation desk
        desk: "#1C1A17",
        "desk-surface": "#26231F",
        "desk-surface-hover": "#2E2A24",
        "desk-border": "#3A352E",
        "desk-text": "#EEE7DB",
        "desk-muted": "#A89D8C",
        danger: "#C1443D",
        "danger-dark": "#8A2E28",
      },
      fontFamily: {
        hand: ["Caveat", "cursive"],
        body: ["Inter", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      boxShadow: {
        note: "0 6px 14px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.2)",
        "note-hover": "0 10px 22px rgba(0,0,0,0.4), 0 3px 6px rgba(0,0,0,0.25)",
        toast: "0 8px 24px rgba(0,0,0,0.35)",
      },
      keyframes: {
        pinDrop: {
          "0%": { opacity: "0", transform: "translateY(-10px) rotate(0deg) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) rotate(var(--rot,0deg)) scale(1)" },
        },
        toastIn: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        toastOut: {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(8px) scale(0.95)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        pinDrop: "pinDrop 0.4s cubic-bezier(0.22,1,0.36,1) forwards",
        toastIn: "toastIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards",
        toastOut: "toastOut 0.2s ease forwards",
        fadeIn: "fadeIn 0.2s ease forwards",
        popIn: "popIn 0.18s cubic-bezier(0.22,1,0.36,1) forwards",
        shake: "shake 0.3s ease",
      },
    },
  },
  plugins: [],
};
