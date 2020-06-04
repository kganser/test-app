const database = require('./database');
const express = require('express');
const fs = require('fs');

const {
  PORT = 3000,
  DB_FILE = 'food.db',
  CSV_URL = 'https://raw.githubusercontent.com/timfpark/take-home-engineering-challenge/master/Mobile_Food_Facility_Permit.csv'
} = process.env;

const app = express();
const db = database(DB_FILE);

let loadOperation;

app.get('/', (req, res) => {
  fs.createReadStream('index.html').pipe(res.type('html'));
});

app.get('/restaurants', async (req, res) => {
  const count = parseInt(req.query.count, 10) || 5;
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon))
    return res.status(400).json({error: 'Invalid coordinates'});

  try {
    const results = await db.query(lat, lon, count);
    res.json({results});
  } catch (error) {
    res.status(500).json({error: String(error)});
  }
});

app.post('/load', async (req, res) => {
  if (!loadOperation)
    loadOperation = db.load(CSV_URL);

  try {
    const {records, time} = await loadOperation;
    res.json({status: `Loaded ${records} records in ${time} ms`});
  } catch (error) {
    res.status(500).json({error: String(error)})
  }
  loadOperation = null;
});

app.listen(PORT, error => {
  if (error) {
    console.error(error);
  } else {
    console.log(`Server listening on port ${PORT}`);
  }
});
