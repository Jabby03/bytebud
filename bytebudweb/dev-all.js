import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const server = resolve(root, "server");
const processes = [];
let stopping = false;

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of processes) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
}

function start(label, args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: ["inherit", "pipe", "pipe"] });
  processes.push(child);

  for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    let pending = "";
    stream.on("data", (chunk) => {
      pending += chunk.toString();
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || "";
      for (const line of lines) {
        output.write(`[${label}] ${line}\n`);
        if (label === "api" && line.includes("EADDRINUSE")) {
          process.stderr.write("[dev] Port 5000 is already in use. Stop the other API process, then run npm run dev again.\n");
          stopAll(1);
        }
      }
    });
    stream.on("end", () => {
      if (pending) output.write(`[${label}] ${pending}\n`);
    });
  }

  child.on("error", (error) => {
    process.stderr.write(`[${label}] Could not start: ${error.message}\n`);
    stopAll(1);
  });
  child.on("close", (code) => {
    if (!stopping) {
      process.stderr.write(`[${label}] stopped${code == null ? "" : ` with exit code ${code}`}\n`);
      stopAll(code || 0);
    }
  });
  return child;
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

async function startDevelopment() {
  let existingApi;
  try {
    const response = await fetch("http://127.0.0.1:5000/api/health", { signal: AbortSignal.timeout(1500) });
    existingApi = response.ok && (await response.json()).ok === true;
    if (!existingApi) {
      process.stderr.write("[dev] Port 5000 is responding, but it is not a healthy ByteBud API. Stop the process using that port before starting the API.\n");
      process.exitCode = 1;
      return;
    }
  } catch {
    // No API is listening yet, so start one below.
  }

  start("web", [resolve(root, "node_modules/vite/bin/vite.js")], root);
  if (existingApi) {
    process.stdout.write("[api] Reusing the ByteBud API already running on port 5000.\n");
  } else {
    start("api", ["--watch", "server.js"], server);
  }
}

startDevelopment().catch((error) => {
  process.stderr.write(`[dev] Could not start development servers: ${error.message}\n`);
  stopAll(1);
});
