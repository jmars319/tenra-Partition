import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const configPath = path.join(root, "scripts", "maintainability.config.json");
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
const budgetBytes = Number(process.env.BUNDLE_BUDGET_KB ?? config.initialBundleBudgetKb ?? 450) * 1024;
const nearBytes = Number(config.nearBudgetMarginKb ?? 4) * 1024;
const candidateAssetDirs = config.assetDirs ?? ["dist/assets"];

function sizeRecord(base, file) {
  const absolute = path.join(base, file);
  const raw = fs.readFileSync(absolute);
  return {
    file: path.relative(root, absolute).replaceAll("\\", "/"),
    rawBytes: raw.byteLength,
    gzipBytes: zlib.gzipSync(raw).byteLength,
  };
}

const assets = [];
for (const dir of candidateAssetDirs) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) continue;
  for (const file of fs.readdirSync(absolute)) {
    if (file.endsWith(".js")) assets.push(sizeRecord(absolute, file));
  }
}

if (assets.length === 0) {
  console.log((config.label ?? path.basename(root)) + " build size report");
  console.log("No built JavaScript assets found. Run the app build first for bundle sizes.");
  if (strict && config.requireBuiltAssets === true) process.exit(1);
  process.exit(0);
}

const sorted = assets.sort((a, b) => b.rawBytes - a.rawBytes);
const initialPattern = config.initialChunkPattern ? new RegExp(config.initialChunkPattern) : /(^|\/)index-[\w-]+\.js$/u;
const initial = sorted.find((asset) => initialPattern.test(asset.file)) ?? sorted[0];

console.log((config.label ?? path.basename(root)) + " bundle report");
console.log("Initial/largest route chunk: " + initial.file + " " + (initial.rawBytes / 1024).toFixed(2) + " kB raw / " + (initial.gzipBytes / 1024).toFixed(2) + " kB gzip");
console.log("Target: " + (budgetBytes / 1024).toFixed(0) + " kB raw");
console.log("");
console.log("Largest JavaScript chunks:");
for (const asset of sorted.slice(0, 12)) {
  console.log("- " + asset.file + ": " + (asset.rawBytes / 1024).toFixed(2) + " kB raw / " + (asset.gzipBytes / 1024).toFixed(2) + " kB gzip");
}

const findings = [];
if (initial.rawBytes > budgetBytes) {
  findings.push("Initial/largest route chunk exceeds target by " + ((initial.rawBytes - budgetBytes) / 1024).toFixed(2) + " kB.");
}
if (strict && initial.rawBytes > budgetBytes - nearBytes) {
  findings.push("Initial/largest route chunk is within " + (nearBytes / 1024).toFixed(0) + " kB of the budget.");
}

for (const [pattern, budgetKb] of Object.entries(config.routeChunkBudgetsKb ?? {})) {
  const matcher = new RegExp(pattern);
  const matches = sorted.filter((asset) => matcher.test(asset.file));
  if (!matches.length) {
    findings.push(`Route chunk budget pattern ${pattern} matched no chunks.`);
    continue;
  }
  for (const asset of matches) {
    const routeBudgetBytes = Number(budgetKb) * 1024;
    if (asset.rawBytes > routeBudgetBytes) findings.push(`${asset.file} exceeds ${budgetKb} kB.`);
    if (strict && asset.rawBytes > routeBudgetBytes - nearBytes) findings.push(`${asset.file} is near its ${budgetKb} kB route budget.`);
  }
}

if (findings.length > 0) {
  for (const finding of findings) console.error(finding);
  if (strict) process.exit(1);
}
