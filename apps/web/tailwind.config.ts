import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          sand: "#F8F9FA",
          clay: "#1A6FE8",
          pine: "#003E9A",
          moss: "#0052CC",
          slate: "#1F2A44",
          mist: "#DDE4F2"
        }
      },
      boxShadow: {
        soft: "0 12px 32px rgba(0, 82, 204, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
