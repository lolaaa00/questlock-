import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* v2 raw tokens */
        wine:    "#1A0A08",
        "wine-2":"#2A100C",
        "wine-3":"#3D1A16",
        "wine-4":"#521F1A",
        ember:   "#8B0A14",
        "ember-2":"#B01020",
        "ember-3":"#D4152A",
        gold:    "#C89B3C",
        "gold-2":"#EEC044",
        "gold-3":"#F5D878",
        mauve:   "#A8917F",
        mist:    "#DDD0CC",
        "mist-2":"#CBC2C0",
        "mist-3":"#F0E6E2",
        /* semantic aliases kept for backwards compat */
        ql: {
          bighorn:   "#1A0A08",
          night:     "#2A100C",
          derby:     "#3D1A16",
          bear:      "#A8917F",
          cafe:      "#A8917F",
          chocolate: "#B01020",
          ashen:     "#DDD0CC",
        },
        background:          "#1A0A08",
        foreground:          "#DDD0CC",
        card:                "#2A100C",
        muted:               "#3D1A16",
        "muted-foreground":  "#A8917F",
        border:              "rgba(180,20,40,0.18)",
        primary:             "#B01020",
        "primary-foreground":"#F0E6E2",
        accent:              "#C89B3C",
        "accent-foreground": "#1A0A08",
      },
      fontFamily: {
        serif: ["Space Grotesk", "system-ui", "sans-serif"],
        sans:  ["Space Grotesk", "system-ui", "sans-serif"],
        body:  ["Nunito Sans",   "system-ui", "sans-serif"],
        mono:  ["Azeret Mono",   "monospace"],
      },
      borderRadius: {
        card: "18px",
        button: "9999px",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(10, 3, 2, 0.45)",
        card: "0 4px 24px rgba(10, 3, 2, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
