import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        line: "#d9e0e8",
        field: "#f5f7fa",
        ocean: "#1b6ca8",
        mint: "#1f9d7a",
        amber: "#c47f1f"
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 32, 42, 0.08), 0 8px 24px rgba(23, 32, 42, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
