const path = require("path");
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [path.join(__dirname, "index.html"), path.join(__dirname, "src/**/*.{ts,tsx}")],
  theme: {
    extend: {
      colors: {
        // All brand colours come from CSS variables set in src/lib/theme.tsx.
        brand: {
          primary: "var(--primary)",
          "primary-hover": "var(--primary-hover)",
          "primary-soft": "var(--primary-soft)",
          "on-primary": "var(--on-primary)",
          accent: "var(--accent)",
          "accent-soft": "var(--accent-soft)",
          "on-accent": "var(--on-accent)",
          highlight: "var(--highlight)",
          "highlight-soft": "var(--highlight-soft)",
          "on-highlight": "var(--on-highlight)",
          navy: "var(--navy)",
          "navy-soft": "var(--navy-soft)",
          "navy-muted": "var(--navy-muted)",
          "on-navy": "var(--on-navy)",
          cream: "var(--cream)",
          "on-cream": "var(--on-cream)",
          neutral: "var(--neutral)",
          muted: "var(--muted)",
          surface: "var(--surface)",
          card: "var(--card)",
          ink: "var(--ink)",
          border: "var(--border)",
          ok: "var(--ok)",
          "ok-soft": "var(--ok-soft)",
          danger: "var(--danger)",
          "danger-soft": "var(--danger-soft)",
        },
      },
      fontFamily: {
        display: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Figtree", "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Consolas", "monospace"],
      },
      keyframes: {
        flashin: { "0%": { backgroundColor: "var(--highlight)" }, "100%": { backgroundColor: "transparent" } },
        cardout: { "0%": { opacity: "1", transform: "translateX(0)" }, "100%": { opacity: "0", transform: "translateX(40px)" } },
      },
      animation: { flashin: "flashin 1.6s ease-out 1", cardout: "cardout 0.35s ease-in forwards" },
    },
  },
  plugins: [],
};
