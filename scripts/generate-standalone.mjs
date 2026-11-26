import { readFile, writeFile } from "node:fs/promises";
let html = await readFile("dist/index.html", "utf8");
const script = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const css = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/);
if (!script || !css) throw new Error("Built assets missing");
const js = await readFile("dist/" + script[1].replace(/^\.\//, ""), "utf8");
const styles = await readFile("dist/" + css[1].replace(/^\.\//, ""), "utf8");
html = html.replace(
  script[0],
  () =>
    `<script type="module">${js.replaceAll("</script", "<\\/script")}</script>`,
);
html = html.replace(css[0], () => `<style>${styles}</style>`);
html = html.replace(/<link[^>]+rel="manifest"[^>]*>/, "");
const icon = await readFile("public/favicon.svg");
html = html.replace(
  /href="\.\/favicon.svg"/,
  `href="data:image/svg+xml;base64,${icon.toString("base64")}"`,
);
await writeFile("dist/BearingTrackerPro.html", html);
// A separate double-clickable copy; original project files are never touched.
await writeFile("BearingTrackerPro.html", html);
console.log("Standalone tracker: BearingTrackerPro.html");
