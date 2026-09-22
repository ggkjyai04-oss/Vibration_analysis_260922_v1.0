import fs from "fs";
import path from "path";

const distDir = path.resolve("dist");
const indexHtmlPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexHtmlPath)) {
  console.error("dist/index.html does not exist. Run vite build first.");
  process.exit(1);
}

let html = fs.readFileSync(indexHtmlPath, "utf-8");

// Find CSS and JS assets in dist/assets
const assetsDir = path.join(distDir, "assets");
const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
const cssFile = files.find((f) => f.endsWith(".css"));
const jsFile = files.find((f) => f.endsWith(".js"));

if (cssFile) {
  const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), "utf-8");
  // Replace <link rel="stylesheet" ...> with inline <style> using a function replacer
  html = html.replace(
    new RegExp(`<link[^>]*href=["'][^"']*${cssFile}["'][^>]*>`, "i"),
    () => `<style>\n${cssContent}\n</style>`
  );
}

if (jsFile) {
  let jsContent = fs.readFileSync(path.join(assetsDir, jsFile), "utf-8");
  // Escape </script> so that HTML parser doesn't break prematurely
  jsContent = jsContent.replace(/<\/script>/gi, "<\\/script>");

  // Replace <script type="module" ... src="..."></script> with inline <script type="module"> using a function replacer
  html = html.replace(
    new RegExp(`<script[^>]*src=["'][^"']*${jsFile}["'][^>]*>\\s*<\\/script>`, "i"),
    () => `<script type="module">\n${jsContent}\n</script>`
  );
}

// Add standalone marker comment
html = html.replace(
  "<head>",
  `<head>\n    <!-- 100% Self-Contained Standalone Single HTML Build (Zero Server/Zero CDN Dependencies) -->`
);

// Save to root galaxy_s24_vibration_monitor.html and public/
const targetRoot = path.resolve("galaxy_s24_vibration_monitor.html");
const targetPublic = path.resolve("public", "galaxy_s24_vibration_monitor.html");
const targetDist = path.resolve("dist", "galaxy_s24_ultra_vibration_monitor.html");

fs.writeFileSync(targetRoot, html, "utf-8");
fs.writeFileSync(targetPublic, html, "utf-8");
fs.writeFileSync(targetDist, html, "utf-8");

console.log("Successfully bundled standalone single HTML file! Size:", (html.length / 1024).toFixed(1), "KB");
