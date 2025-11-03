import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  base: "/pubky-explorer/",
  plugins: [solid()],
});
