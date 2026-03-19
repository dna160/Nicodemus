import defineConfig from "@plasmohq/config";

export default defineConfig({
  srcDir: "src",
  srcMaps: true,
  manifest: {
    name: "Nicodemus Student Rep",
    description: "Privacy-first study behavior tracker for personalized learning",
    version: "0.1.0",
    permissions: ["tabs", "storage", "activeTab", "scripting"],
    host_permissions: ["https://*/", "http://*/"],
    action: {
      default_title: "Student Rep - Click to view stats"
    },
    icons: {
      16: "public/icons/icon16.png",
      48: "public/icons/icon48.png",
      128: "public/icons/icon128.png"
    }
  }
});
