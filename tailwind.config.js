/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./uploads/painel_e_vitrine_afiliado_mestre.html",
    "./uploads/storefront.js",
  ],
  theme: {
    extend: {
      colors: {
        shopee: {
          orange: "#ee4d2d",
          orangeHover: "#d33b1c",
          orangeLight: "#ffebd7",
          yellow: "#f8d135",
          darkYellow: "#f5a623",
          grayBg: "#f5f5f5",
          textDark: "#222222",
          textMuted: "#757575",
          greenFree: "#26aa99",
          greenLight: "#e8f7f5",
        },
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
        shopee: ["Nunito", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
  safelist: [
    "line-clamp-2",
    "line-clamp-3",
    "hidden",
    "flex",
    "block",
    "inline-flex",
    "items-center",
    "justify-center",
  ],
};
