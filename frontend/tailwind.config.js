import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.html",
    "./node_modules/tailwind-datepicker-react/dist/**/*.js",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: colors.blue,
      },
      backgroundColor: {
        dark: {
          DEFAULT: "var(--dark-bg)",
          surface: "var(--dark-surface)",
        },
      },
    },
  },
  plugins: [],
};
