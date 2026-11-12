import { createApp } from './app.js';
import { env } from './config/env.js';
import { getPool } from './config/db.js';

const app = createApp();

// Verify database connection on startup
const pool = getPool();
pool.connect()
  .then((client) => {
    client.release();
    console.log('Successfully connected to PostgreSQL database.');
  })
  .catch((err) => {
    console.error('Failed to connect to PostgreSQL database on boot:', err.message);
  });

app.listen(env.PORT, () => {
  console.log(`Sweety API server listening on http://localhost:${env.PORT}`);
});

