import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--bg)",
          2: "var(--bg-2)",
          3: "var(--bg-3)",
          card: "var(--bg-card)",
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
          3: "var(--line-3)",
        },
        fg: {
          DEFAULT: "var(--fg)",
          2: "var(--fg-2)",
          3: "var(--fg-3)",
          4: "var(--fg-4)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent-2)",
          ink: "var(--accent-ink)",
          soft: "var(--accent-soft)",
        },
        violet: "var(--violet)",
        blue: "var(--blue)",
        pink: "var(--pink)",
        amber: "var(--amber)",
        warn: "var(--warn)",
        red: "var(--red)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "serif"],
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
