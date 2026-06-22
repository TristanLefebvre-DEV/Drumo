const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const project = path.resolve(__dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(project, "package.json"), "utf8"));
const fileName = `Drumo Setup ${version}.exe`;
const installerPath = path.join(project, "release", fileName);
const baseUrl = String(process.argv[2] || process.env.DRUMO_RELEASE_BASE_URL || "").replace(/\/$/, "");

if (!baseUrl || !/^https:\/\//i.test(baseUrl)) throw new Error("Indiquez l'URL HTTPS publique des fichiers : npm run release:manifest -- https://serveur/drumo");
if (!fs.existsSync(installerPath)) throw new Error(`Installateur introuvable : ${installerPath}`);

const releaseHost = new URL(baseUrl).hostname.toLowerCase();
// Use stable, URL-safe names for GitHub release assets.
const publicFileName = process.env.DRUMO_RELEASE_FILE_NAME
  || (releaseHost === "github.com" ? fileName.replace(/ /g, "-") : fileName);

const bytes = fs.readFileSync(installerPath);
const manifest = {
  version,
  publishedAt: new Date().toISOString(),
  notes: process.env.DRUMO_RELEASE_NOTES || `Mise à jour Drumo ${version}`,
  windows: {
    url: `${baseUrl}/${encodeURIComponent(publicFileName)}`,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
  },
};

const output = path.join(project, "release", "latest.json");
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(output);
