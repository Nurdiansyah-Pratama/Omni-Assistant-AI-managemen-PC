/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 24px 70px rgba(15, 23, 42, 0.28)",
        character: "0 12px 32px rgba(79, 70, 229, 0.38)",
      },
    },
  },
  plugins: [],
};
