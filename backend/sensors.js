const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");

function startSensorProcess({ name, scriptPath, parser, pythonCmd, onValue }) {
  const child = spawn(pythonCmd, ["-u", path.resolve(scriptPath)], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.on("error", (err) => console.error(`[${name}] ${err.message}`));
  child.on("exit", (code, signal) => {
    console.log(`[${name}] Processus terminé (${signal || code})`);
  });

  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const value = parser(line);
    if (value !== null && Number.isFinite(value)) onValue(value);
  });
  readline.createInterface({ input: child.stderr }).on("line", (line) => {
    console.error(`[${name}] ${line}`);
  });
  return child;
}

function parseSound(line) {
  const match = line.match(/Value:\s*([+-]?\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : null;
}

function parseUltrasonic(line) {
  const match = line.match(/([+-]?\d+(?:\.\d+)?)\s*cm/i);
  return match ? Number(match[1]) : null;
}

module.exports = { startSensorProcess, parseSound, parseUltrasonic };
