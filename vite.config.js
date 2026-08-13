import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import glsl from "vite-plugin-glsl";

const host = process.env.HOST || "localhost";
const port = Number(process.env.PORT || 3001);

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    react({
      include: [/\.js$/, /\.jsx$/, /\.tsx$/],
    }),
    glsl({
      include: ["**/*.glsl", "**/*.vert", "**/*.frag"],
      compress: false,
    }),
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      mode === "production" ? "production" : "development",
    ),
  },
  resolve: {
    extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx"],
  },
  css: {
    postcss: "./postcss.config.js",
  },
  server: {
    host,
    port,
    strictPort: true,
  },
}));
