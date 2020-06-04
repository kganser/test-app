const csvParser = require('csv-parse');
const https = require('https');
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

// Haversine formula
// https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
const distance = (lat1, lon1, lat2, lon2) => {
  const diameter = 12742; // earth's diameter (km)
  const rads = Math.PI / 180;
  const a = .5 - Math.cos((lat2 - lat1) * rads) / 2 +
            Math.cos(lat1 * rads) * Math.cos(lat2 * rads) *
            (1 - Math.cos((lon2 - lon1) * rads)) / 2;

  return Math.round(diameter * Math.asin(Math.sqrt(a)) * 1000) / 1000;
};

module.exports = filename => {

  const open = sqlite
    .open({filename, driver: sqlite3.Database})
    .then(db => {
      db.exec('CREATE TABLE IF NOT EXISTS restaurants (id TEXT, name TEXT, description TEXT, address TEXT, lat NUMBER, lon NUMBER)');
      return db;
    });

  return {
    load: async url => {
      const db = await open;
      await db.exec('BEGIN');
      try {
        await db.exec('DELETE FROM restaurants');
        const stmt = await db.prepare('INSERT INTO restaurants (id, name, description, address, lat, lon) VALUES (?, ?, ?, ?, ?, ?)');
  
        let columns;
        const start = Date.now();
        const inserts = [];
  
        await new Promise((resolve, reject) => {
          https.get(url, response => {
            response
              .pipe(csvParser())
              .on('data', row => {
                if (columns) {
                  inserts.push(stmt.run(columns.map(index => row[index])));
                } else {
                  // Map CSV columns from first line to DB table columns
                  columns = ['locationid', 'Applicant', 'FoodItems', 'Address', 'Latitude', 'Longitude'].map(
                    column => row.indexOf(column)
                  );
                }
              })
              .on('end', resolve)
              .on('error', reject);
          }).on('error', reject);
        });
  
        await Promise.all(inserts);
        await db.exec('COMMIT');
        return {time: Date.now() - start, records: inserts.length};
  
      } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
      }
    },
    query: async (lat, lon, count) => {
      let lastError;
      const results = [];
      const db = await open;
      await db.each('SELECT * FROM restaurants', (error, row) => {
        if (error) {
          lastError = error;
        } else {
          const dist = distance(row.lat, row.lon, lat, lon);
          const i = results.findIndex(item => item.distance > dist);
          row.distance = dist;
          if (i >= 0) {
            results.splice(i, 0, row);
            if (results.length > count)
              results.pop();
          } else if (results.length < count) {
            results.push(row);
          }
        }
      });
      if (lastError) throw lastError;
      return results;
    }
  }
};