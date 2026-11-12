import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

let pool: pg.Pool;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: env.NODE_ENV === 'production' && !env.DATABASE_URL.includes('localhost')
        ? { rejectUnauthorized: false }
        : false
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

export function setPool(customPool: pg.Pool): void {
  pool = customPool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

