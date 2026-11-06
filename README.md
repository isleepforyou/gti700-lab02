# GTI700 — Équipe 02 — Laboratoire 2

Le backend Node.js lit les capteurs Python et publie sur Mosquitto aux **3 secondes**.
Il reçoit les alertes de HiveMQ et commande la DEL RGB. La page HTML se connecte
directement aux deux courtiers par WebSocket, sans serveur web.

Les capteurs température/humidité étant brisés, le son et l'ultrason les remplacent
avec l'autorisation de l'enseignant. On conserve les noms exacts des topics de l'énoncé :

| Courtier | Topic | Contenu |
| --- | --- | --- |
| Mosquitto local | `GTI700/Data/E2025/02/temperature` | Son, valeur brute (ex. `125.00`) |
| Mosquitto local | `GTI700/Data/E2025/02/humidite` | Distance en cm (ex. `23.45`) |
| HiveMQ public | `GTI700/Alerts/E2025/02` | Alerte de notre DEL (`R;G;B`) |
| HiveMQ public | `GTI700/Alerts/E2025/+` | Souscription du navigateur aux alertes de toutes les équipes |

`E2025` est conservé tel que demandé dans l'énoncé.

## 1. Mosquitto sur le Raspberry Pi

```bash
sudo apt-get install mosquitto mosquitto-clients
sudo cp mosquitto.conf /etc/mosquitto/conf.d/lab2.conf
sudo service mosquitto restart
```

Exécuter depuis la racine du dépôt. Le fichier fourni ouvre les ports **1883** (MQTT)
et **9001** (WebSocket), avec accès anonyme pour le réseau du laboratoire.
Si ces ports ont déjà été ajoutés dans `/etc/mosquitto/mosquitto.conf`, retirer les
anciennes définitions pour éviter les doublons.

## 2. Capteurs et DEL sur le Pi

Prérequis : Node.js 18+ et Python 3. Conserver les branchements du labo 1 et les
dépendances Python (`RPi.GPIO`, `smbus2`).
L'ultrason utilise les broches **physiques 11 et 12**. Brancher les canaux **R, G, B**
de la DEL sur les broches **physiques 15, 16 et 18** respectivement, avec les
résistances du montage du cours. Le script réutilise `rgb_led.py` pour une DEL à
anode commune (commun au 3,3 V).

```bash
cd backend
npm install
npm start
```

Valeurs par défaut : équipe `02`, Mosquitto `mqtt://localhost:1883`, HiveMQ
`mqtt://broker.hivemq.com:1883`, Python `python3`.
Au besoin, définir `TEAM`, `LOCAL_BROKER_URL`, `PUBLIC_BROKER_URL` ou `PYTHON_CMD`
dans le terminal avant `npm start`. Les chemins `SOUND_SCRIPT`, `ULTRASONIC_SCRIPT`
et `LED_SCRIPT` peuvent aussi être remplacés.

## 3. Page web sur l'ordinateur

Dans `frontend/public/config.js`, remplacer `raspberrypi.local` par l'adresse IP
du Pi au besoin, puis ajuster `TEAM_COUNT` au nombre d'équipes de la classe.
Ouvrir **`frontend/public/affichage.html`** directement dans le navigateur.
Internet est nécessaire pour charger MQTT.js et joindre HiveMQ.

Sur macOS, le raccourci suivant ouvre cette même page (aucune installation npm requise) :

```bash
cd frontend
npm start
```

La configuration du navigateur se fait dans `config.js`, pas dans `.env`.

La page affiche les 15 dernières paires de mesures et une case colorée par équipe.
Les mesures expirent après 45 secondes. Les deux connexions se rétablissent
automatiquement après une coupure. Les mesures manquées pendant la coupure ne
sont pas rejouées; une alerte RGB invalide est ignorée.

Pour voir les publications locales sur le Pi :

```bash
mosquitto_sub -h localhost -t 'GTI700/Data/E2025/02/+'
```

Pour vérifier manuellement la DEL et la case de l'équipe 02 :

```bash
mosquitto_pub -h broker.hivemq.com -t 'GTI700/Alerts/E2025/02' -m '255;0;0'
```
