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
      for (const line of lines) output.write(`[${label}] ${line}\n`);
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

start("web", [resolve(root, "node_modules/vite/bin/vite.js")], root);
start("api", ["--watch", "server.js"], server);
