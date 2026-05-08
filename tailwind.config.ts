import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          50: "#f7f7f6",
          100: "#e7e7e3",
          200: "#cfcfc8",
          300: "#a8a89c",
          400: "#7a7a6e",
          500: "#52524a",
          600: "#3a3a34",
          700: "#28281f",
          800: "#1a1a14",
          900: "#0e0e08",
        },
        accent: {
          DEFAULT: "#c1602b",
          dark: "#8f4520",
        },
      },
    },
  },
  plugins: [],
};
export default config;
