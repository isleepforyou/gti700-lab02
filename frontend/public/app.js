const config = window.APP_CONFIG;
const team = String(config.TEAM).padStart(2, "0");
const dataTopic = `GTI700/Data/E2025/${team}`;
const alertPrefix = "GTI700/Alerts/E2025/";
const historyBody = document.getElementById("sensor-history");
const alertCells = new Map();
let history = [];

document.getElementById("team").textContent = team;
document.title = `Laboratoire 2 — Équipe ${team}`;

for (let number = 1; number <= config.TEAM_COUNT; number++) {
  const row = document.createElement("tr");
  const label = document.createElement("td");
  const cell = document.createElement("td");
  label.textContent = number;
  cell.className = "alert-cell";
  cell.setAttribute("aria-label", "Aucune alerte reçue");
  row.append(label, cell);
  document.getElementById("alerts").appendChild(row);
  alertCells.set(String(number).padStart(2, "0"), cell);
}

function renderHistory() {
  // Les anciennes mesures expirent aussi si les capteurs cessent d'émettre.
  history = history.filter((sample) => Date.now() - sample.time < 45000).slice(-15);
  historyBody.replaceChildren();
  for (const sample of history) {
    const row = document.createElement("tr");
    const values = [
      new Date(sample.time).toTimeString().slice(0, 8),
      sample.temperature?.toFixed(2) ?? "—",
      sample.humidite?.toFixed(2) ?? "—"
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    historyBody.appendChild(row);
  }
}

function connectBroker(url, statusId, name, topics) {
  const status = document.getElementById(statusId);
  const setStatus = (text, ok) => {
    status.textContent = `${name} : ${text}`;
    status.className = `status ${ok ? "ok" : "error"}`;
  };
  const client = mqtt.connect(url, { reconnectPeriod: 2000, connectTimeout: 10000 });
  client.on("connect", () => {
    client.subscribe(topics, (err, granted) => {
      if (err || granted.some((subscription) => subscription.qos === 128)) {
        setStatus("souscription impossible", false);
      } else {
        setStatus("connecté", true);
      }
    });
  });
  client.on("offline", () => setStatus("déconnecté, reconnexion automatique...", false));
  client.on("error", (err) => setStatus(err.message, false));
  return client;
}

if (typeof mqtt === "undefined") {
  for (const id of ["local-status", "public-status"]) {
    document.getElementById(id).textContent = "Librairie MQTT indisponible. Vérifiez l'accès Internet puis rechargez la page.";
    document.getElementById(id).className = "status error";
  }
} else {
  const local = connectBroker(config.LOCAL_BROKER_URL, "local-status", "Mosquitto", [
    `${dataTopic}/temperature`, `${dataTopic}/humidite`
  ]);
  local.on("message", (topic, message) => {
    const sensor = topic.slice(dataTopic.length + 1);
    if (topic !== `${dataTopic}/${sensor}` || !["temperature", "humidite"].includes(sensor)) return;
    const text = message.toString().trim();
    if (!text || !Number.isFinite(Number(text))) return;
    const now = Date.now();
    let sample = history[history.length - 1];
    // Les deux publications d'un même intervalle se suivent sur le courtier.
    if (!sample || sample[sensor] !== undefined || now - sample.time > 1500) {
      sample = { time: now };
      history.push(sample);
    }
    sample[sensor] = Number(text);
    renderHistory();
  });

  const alerts = connectBroker(config.PUBLIC_BROKER_URL, "public-status", "HiveMQ", `${alertPrefix}+`);
  alerts.on("message", (topic, message) => {
    if (!topic.startsWith(alertPrefix)) return;
    const cell = alertCells.get(topic.slice(alertPrefix.length));
    const text = message.toString().trim();
    if (!cell || !/^\d{1,3};\d{1,3};\d{1,3}$/.test(text)) return;
    const rgb = text.split(";").map(Number);
    if (rgb.some((value) => value > 255)) return;
    cell.style.backgroundColor = `rgb(${rgb.join(",")})`;
    cell.setAttribute("aria-label", `RGB ${rgb.join(", ")}`);
    cell.title = `RGB ${rgb.join(", ")}`;
  });
}

setInterval(renderHistory, 1000);
