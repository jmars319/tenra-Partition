import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const configPath = path.join(root, "scripts", "maintainability.config.json");
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
const ignoredSegments = new Set([
  "node_modules", ".git", "dist", "build", "out", "coverage", ".vite", "target", "gen",
  "release", "runs", "logs", "test-images", ...(config.ignoredSegments ?? []),
]);
const sourceExtensions = new Set(config.sourceExtensions ?? [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".css", ".scss", ".py", ".sh", ".ps1",
]);
const styleExtensions = new Set([".css", ".scss", ".sass", ".less"]);
const generatedPatterns = (config.generatedPatterns ?? [
  "dist/", "/dist/", "/build/", "/out/", "/target/", "/gen/", "*.tsbuildinfo", "vite-env.d.ts",
]).map((pattern) => pattern.replaceAll("\\", "/"));
const allowedGenerated = new Set((config.allowedGenerated ?? []).map((item) => item.replaceAll("\\", "/")));
const specificFileBudgets = config.specificFileBudgets ?? {};
const maxImpl = Number(config.maxImplementationFileLines ?? 525);
const maxStyle = Number(config.maxStyleFileLines ?? 400);
const maxAppShell = Number(config.maxAppShellLines ?? 350);
const maxDesktopMain = Number(config.maxDesktopMainLines ?? 450);
const maxDomainBarrel = Number(config.maxDomainBarrelLines ?? 250);
const nearLineMargin = Number(config.nearBudgetMarginLines ?? 25);
const nearAssetMarginBytes = Number(config.nearBudgetMarginKb ?? 4) * 1024;

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredSegments.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function lineCount(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/u).length;
}

function matchesPattern(file, pattern) {
  if (pattern.startsWith("*.")) return file.endsWith(pattern.slice(1));
  return file === pattern || file.includes(pattern);
}

function budgetFor(record) {
  if (specificFileBudgets[record.file]) return Number(specificFileBudgets[record.file]);
  const isAppShell = /(^|\/)App\.(tsx|jsx|ts|js)$/.test(record.file);
  const isDesktopMain = /(^|\/)(main|lib)\.(cjs|mjs|js|ts|rs)$/.test(record.file) && /desktop|tauri|src-tauri/.test(record.file);
  const isDomainBarrel = /(^|\/)packages\/[^/]+\/src\/index\.ts$/.test(record.file) || /(^|\/)(index|partitionLab)\.ts$/.test(record.file) && record.file.includes("/io/");
  if (isAppShell) return maxAppShell;
  if (isDesktopMain) return maxDesktopMain;
  if (isDomainBarrel) return maxDomainBarrel;
  return styleExtensions.has(record.ext) ? maxStyle : maxImpl;
}

function extractExports(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  const exports = [];
  for (const match of text.matchAll(/export\s+(?:type\s+|interface\s+|function\s+|const\s+)([A-Za-z_$][\w$]*)/gu)) {
    exports.push(match[1]);
  }
  for (const match of text.matchAll(/export\s+type\s*\{([^}]+)\}/gu)) {
    exports.push(...splitExportBlock(match[1]));
  }
  for (const match of text.matchAll(/export\s*\{([^}]+)\}/gu)) {
    exports.push(...splitExportBlock(match[1]));
  }
  return [...new Set(exports)].sort();
}

function splitExportBlock(block) {
  return block
    .split(",")
    .map((part) => part.trim().split(/\s+as\s+/u)[0]?.trim())
    .filter(Boolean);
}

function extractSchemaIds(files) {
  const ids = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/["']((?:tenra|partition-lab|tenra-guardrail)[A-Za-z0-9_.-]+\.v1)["']/gu)) {
      ids.add(match[1]);
    }
  }
  return [...ids].sort();
}

function contractSchemaFiles() {
  const schemaRoots = config.contractSchemaRoots ?? ["src", "fixtures", "fixtures/handoffs", "lab/fixtures"];
  const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".rs", ".json"]);
  const output = [];
  for (const directory of schemaRoots) {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) continue;
    for (const file of walkAll(absolute)) {
      if (extensions.has(path.extname(file))) output.push(file);
    }
  }
  return output;
}

function walkAll(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredSegments.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkAll(absolute, files);
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function actualContracts(files) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const tauriLib = fs.existsSync(path.join(root, "src-tauri/src/lib.rs"))
    ? fs.readFileSync(path.join(root, "src-tauri/src/lib.rs"), "utf8")
    : "";
  const labUiHtml = fs.existsSync(path.join(root, "lab/ui/index.html"))
    ? fs.readFileSync(path.join(root, "lab/ui/index.html"), "utf8")
    : "";
  return {
    packageName: pkg.name,
    packageScripts: Object.keys(pkg.scripts ?? {}).sort(),
    domainExports: {
      bytes: extractExports(path.join(root, "src/domain/bytes.ts")),
      layout: extractExports(path.join(root, "src/domain/layout.ts")),
      partitionLab: extractExports(path.join(root, "src/io/partitionLab.ts")),
      scenarioCatalog: extractExports(path.join(root, "src/io/scenarioCatalog.ts")),
      types: extractExports(path.join(root, "src/domain/types.ts")),
    },
    schemaIds: extractSchemaIds(contractSchemaFiles()),
    tauriCommands: [...tauriLib.matchAll(/#\[tauri::command\]\s*\nfn\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]).sort(),
    tauriMenuIds: [...tauriLib.matchAll(/const\s+MENU_[A-Z_]+:\s*&str\s*=\s*"([^"]+)"/gu)].map((match) => match[1]).sort(),
    labUiAnchors: [...labUiHtml.matchAll(/id="([^"]+)"/gu)].map((match) => match[1]).sort(),
  };
}

function compareContracts(actual) {
  const snapshotPath = config.contractSnapshotPath ? path.join(root, config.contractSnapshotPath) : "";
  if (!snapshotPath || !fs.existsSync(snapshotPath)) return ["contract snapshot is missing."];
  const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  return JSON.stringify(actual, null, 2) === JSON.stringify(expected, null, 2)
    ? []
    : ["contract snapshot drifted. Update scripts/contracts/maintainability-contracts.json only with matching tests."];
}

const sourceRoots = (config.sourceRoots ?? ["src", "src-tauri/src", "scripts", "lab"]).filter((dir) => fs.existsSync(path.join(root, dir)));
const files = sourceRoots.flatMap((directory) => walk(path.join(root, directory))).filter((file, index, all) => all.indexOf(file) === index);
const records = files.map((file) => ({ file: relative(file), ext: path.extname(file), lines: lineCount(file) }));
const implementationRecords = records.filter((record) => !styleExtensions.has(record.ext));
const styleRecords = records.filter((record) => styleExtensions.has(record.ext));
const generatedRecords = records.filter((record) => generatedPatterns.some((pattern) => matchesPattern(record.file, pattern)) && !allowedGenerated.has(record.file));
const violations = [];

for (const record of records) {
  const budget = budgetFor(record);
  if (record.lines > budget) violations.push(`${record.file} has ${record.lines} lines; budget is ${budget}.`);
  if (strict && record.lines > budget - nearLineMargin) violations.push(`${record.file} is within ${nearLineMargin} lines of its ${budget}-line budget.`);
}

for (const record of implementationRecords) {
  const text = fs.readFileSync(path.join(root, record.file), "utf8");
  if (/from\s+["'][^"']*(?:dist|build|target|node_modules)\//u.test(text)) {
    violations.push(`${record.file} imports from generated, build, or dependency output.`);
  }
}

if (generatedRecords.length > 0 && config.allowGeneratedArtifacts !== true) {
  violations.push("generated/runtime artifacts in source scan: " + generatedRecords.slice(0, 12).map((record) => record.file).join(", "));
}

for (const asset of config.assetBudgets ?? []) {
  const absolute = path.join(root, asset.path);
  if (!fs.existsSync(absolute)) {
    violations.push(`${asset.path} is missing.`);
    continue;
  }
  const size = fs.statSync(absolute).size;
  if (size > asset.maxBytes) violations.push(`${asset.path} is ${size} bytes; budget is ${asset.maxBytes}.`);
  if (strict && size > asset.maxBytes - nearAssetMarginBytes) violations.push(`${asset.path} is within ${nearAssetMarginBytes} bytes of its asset budget.`);
}

const contracts = actualContracts(files);
violations.push(...compareContracts(contracts));

console.log((config.label ?? path.basename(root)) + " maintainability audit");
console.log("");
console.log("Largest implementation files:");
for (const record of implementationRecords.sort((a, b) => b.lines - a.lines).slice(0, 14)) {
  console.log("- " + record.file + ": " + record.lines + " lines");
}
console.log("");
console.log("Largest style files:");
for (const record of styleRecords.sort((a, b) => b.lines - a.lines).slice(0, 10)) {
  console.log("- " + record.file + ": " + record.lines + " lines");
}
console.log("");
console.log("Generated/runtime findings: " + generatedRecords.length);
console.log("Contract snapshot: checked");

if (violations.length > 0) {
  console.log("");
  console.log("Maintainability findings:");
  for (const violation of violations) console.log("- " + violation);
  if (strict) process.exit(1);
}
