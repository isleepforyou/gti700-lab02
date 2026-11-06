const path = require("path");
const { spawn } = require("child_process");
const mqtt = require("mqtt");
const { startSensorProcess, parseSound, parseUltrasonic } = require("./sensors");

const team = (process.env.TEAM || "02").padStart(2, "0");
const pythonCmd = process.env.PYTHON_CMD || "python3";
const scriptsDir = path.join(__dirname, "..", "python_examples");
const dataTopic = `GTI700/Data/E2025/${team}`;
const alertTopic = `GTI700/Alerts/E2025/${team}`;
const latest = {};

function connectBroker(name, url) {
  const client = mqtt.connect(url, {
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    queueQoSZero: false
  });
  client.on("connect", () => console.log(`[${name}] Connecté à ${url}`));
  client.on("offline", () => console.log(`[${name}] Déconnecté, reconnexion automatique...`));
  client.on("error", (err) => console.error(`[${name}] ${err.message}`));
  return client;
}

const local = connectBroker("Mosquitto", process.env.LOCAL_BROKER_URL || "mqtt://localhost:1883");
const alerts = connectBroker("HiveMQ", process.env.PUBLIC_BROKER_URL || "mqtt://broker.hivemq.com:1883");

// Les noms des topics restent ceux de l'énoncé malgré le remplacement des capteurs.
const processes = [
  startSensorProcess({
    name: "son",
    scriptPath: process.env.SOUND_SCRIPT || path.join(scriptsDir, "sound.py"),
    parser: parseSound,
    pythonCmd,
    onValue: (value) => { latest.temperature = { value, time: Date.now() }; }
  }),
  startSensorProcess({
    name: "ultrason",
    scriptPath: process.env.ULTRASONIC_SCRIPT || path.join(scriptsDir, "ultrasonic.py"),
    parser: parseUltrasonic,
    pythonCmd,
    onValue: (value) => { latest.humidite = { value, time: Date.now() }; }
  })
];

const publishTimer = setInterval(() => {
  if (!local.connected) return;
  for (const [sensor, sample] of Object.entries(latest)) {
    // Un capteur arrêté ne doit pas republier indéfiniment sa dernière mesure.
    if (Date.now() - sample.time > 3000) continue;
    local.publish(`${dataTopic}/${sensor}`, sample.value.toFixed(2), (err) => {
      if (err) console.error(`[${sensor}] Publication impossible : ${err.message}`);
    });
  }
}, 3000);

// Le processus reste ouvert pour que le PWM maintienne la couleur entre les alertes.
const led = spawn(pythonCmd, ["-u", process.env.LED_SCRIPT || path.join(scriptsDir, "led.py")], {
  stdio: ["pipe", "ignore", "inherit"]
});
processes.push(led);
led.on("error", (err) => console.error(`[DEL] ${err.message}`));
led.on("exit", (code, signal) => console.log(`[DEL] Processus terminé (${signal || code})`));
led.stdin.on("error", (err) => console.error(`[DEL] ${err.message}`));

alerts.on("connect", () => {
  alerts.subscribe(alertTopic, (err) => {
    if (err) console.error(`[HiveMQ] Souscription impossible : ${err.message}`);
  });
});

alerts.on("message", (topic, message) => {
  if (topic !== alertTopic) return;
  const text = message.toString().trim();
  const rgb = text.split(";").map(Number);
  if (!/^\d{1,3};\d{1,3};\d{1,3}$/.test(text) || rgb.some((value) => value > 255)) {
    console.error("[DEL] Alerte RGB invalide, ignorée.");
    return;
  }
  if (!led.stdin.destroyed) led.stdin.write(`${rgb.join(";")}\n`);
});

function shutdown() {
  clearInterval(publishTimer);
  local.end(true);
  alerts.end(true);
  for (const child of processes) child.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
