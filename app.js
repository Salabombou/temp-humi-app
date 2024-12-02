const express = require('express');
const expressWs = require('express-ws');
const sqlite3 = require('sqlite3');
const child_process = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
expressWs(app);

app.use(express.static('public'));

const db = new sqlite3.Database('db/data.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS temperature (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    value REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS humidity (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    value REAL
  )`);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS limit_temperature_rows
    AFTER INSERT ON temperature
    BEGIN
      DELETE FROM temperature 
      WHERE id NOT IN (SELECT id FROM temperature ORDER BY id DESC LIMIT 100);
    END;
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS limit_humidity_rows
    AFTER INSERT ON humidity
    BEGIN
      DELETE FROM humidity 
      WHERE id NOT IN (SELECT id FROM humidity ORDER BY id DESC LIMIT 100);
    END;
  `);
});


const dateRouter = express.Router();
const wsRouter = express.Router();

const temp = child_process.spawn('mosquitto_sub', ['-h', process.env.MQTT_HOST, '-t', 'esp32/temperature'], {stdio: 'pipe'});
const humi = child_process.spawn('mosquitto_sub', ['-h', process.env.MQTT_HOST, '-t', 'esp32/humidity'], {stdio: 'pipe'});

temp.stdout.on('data', (data) => {
  const message = data.toString().trim();
  console.log("Temperature", message);

  const value = parseFloat(message);
  if (isNaN(value)) {
    console.error('Invalid temperature value:', message);
    return;
  }

  db.run('INSERT INTO temperature (value) VALUES (?)', [value], function(err) {
    if (err) {
      console.error('Error inserting temperature:', err.message);
      return;
    }

    tempConnections.forEach((ws) => {
      ws.send(message);
    });
  });
});

humi.stdout.on('data', (data) => {
  const message = data.toString().trim();
  console.log("Humidity", message);

  const value = parseFloat(message);
  if (isNaN(value)) {
    console.error('Invalid humidity value:', message);
    return;
  }

  db.run('INSERT INTO humidity (value) VALUES (?)', [value], function(err) {
    if (err) {
      console.error('Error inserting humidity:', err.message);
      return;
    }

    humiConnections.forEach((ws) => {
      ws.send(message);
    });
  });
});

const tempConnections = new Set();
const humiConnections = new Set();

wsRouter.ws('/temperature', (ws, req) => {
  tempConnections.add(ws);
  ws.on('close', () => {
    tempConnections.delete(ws);
  });
});
wsRouter.ws('/humidity', (ws, req) => {
  humiConnections.add(ws);
  ws.on('close', () => {
    humiConnections.delete(ws);
  });
});

dateRouter.get('/temperature', (req, res) => {
  db.all('SELECT * FROM temperature', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    console.log(rows);
    res.json(rows.map((row) => row.value));
  });
});
dateRouter.get('/humidity', (req, res) => {
  db.all('SELECT * FROM humidity', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    console.log(rows);
    res.json(rows.map((row) => row.value));
  });
});

app.use('/api/data', dateRouter);
app.use('/api/ws', wsRouter);

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});