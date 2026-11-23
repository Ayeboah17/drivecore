#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, "..");
const fixtureScript = path.join(webDir, "tests", "fixtures", "api-server.mjs");
const apiPort = process.env.DRIVECORE_DEMO_API_PORT || "4201";
const webPort = process.env.PORT || "3000";
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;

const accounts = [
  ["System Administrator (Full Access)", "sysadmin@drivecore.demo", "demo1234"],
  ["CEO (Executive & Approvals)", "ceo@drivecore.demo", "demo1234"],
  ["Finance Manager (AR/AP/GL/Assets/VAT)", "financemanager@drivecore.demo", "demo1234"],
  ["Credit Control Manager (Holds & Ageing)", "creditcontrol@drivecore.demo", "demo1234"],
  ["Operations Manager (Fleet/Rentals/Inspections)", "opsmanager@drivecore.demo", "demo1234"],
  ["Business Accounts Manager (CRM Leads & Quotes)", "businessaccounts@drivecore.demo", "demo1234"],
  ["Maintenance Manager (Work Orders & Incidents)", "maintmanager@drivecore.demo", "demo1234"],
  ["Mechanic / Technician (Workshop)", "mechanic@drivecore.demo", "demo1234"],
  ["HR / Admin Manager (Users & Compliance)", "hradmin@drivecore.demo", "demo1234"],
  ["Driver (Assigned Handovers/Returns)", "activedriver@drivecore.demo", "demo1234"],
];

console.log("\n==============================================================");
console.log("  DriveCore ERP — Full Live Demo Workspace (Seeded)");
console.log("  Company: DriveCore Solutions Ghana Ltd (GHS)");
console.log("  Branches: Accra Airport HQ · Kumasi Branch");
console.log("==============================================================");
console.log(`  App URL : http://127.0.0.1:${webPort}/login`);
console.log(`  Demo API: ${apiBaseUrl} (in-memory seeded loopback)`);
console.log("--------------------------------------------------------------");
console.log("  Demo Accounts (any password works, e.g. demo1234):");
for (const [label, email, pass] of accounts) {
  console.log(`    • ${email.padEnd(32)} (${pass}) — ${label}`);
}
console.log("==============================================================\n");

const apiProc = spawn(process.execPath, [fixtureScript, "--seed=demo"], {
  cwd: webDir,
  env: {
    ...process.env,
    DRIVECORE_FIXTURE_PORT: apiPort,
  },
  stdio: "inherit",
});

const nextBin = path.join(
  webDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);

const webProc = spawn(nextBin, ["dev", "-p", webPort, "-H", "127.0.0.1"], {
  cwd: webDir,
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DRIVECORE_API_BASE_URL: apiBaseUrl,
  },
  stdio: "inherit",
});

function shutdown(code = 0) {
  if (!apiProc.killed) apiProc.kill();
  if (!webProc.killed) webProc.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
apiProc.on("exit", (code) => {
  if (code && code !== 0) shutdown(code);
});
webProc.on("exit", (code) => shutdown(code ?? 0));
