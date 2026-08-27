/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 운중고 스마트 캠퍼스 남색·파랑 테마
        navy: {
          50: "#F2F6FC",
          100: "#E3EDFA",
          200: "#C4D9F4",
          300: "#95BCE9",
          400: "#5E97DA",
          500: "#3576C4",
          600: "#245BA3",
          700: "#1B4682",
          800: "#153663",
          900: "#0E2748",
          950: "#081930",
        },
      },
      fontFamily: {
        sans: ["var(--font-app)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 39, 72, 0.06), 0 8px 24px -12px rgba(14, 39, 72, 0.25)",
        nav: "0 -1px 0 rgba(14, 39, 72, 0.08), 0 -8px 24px -16px rgba(14, 39, 72, 0.3)",
      },
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};
