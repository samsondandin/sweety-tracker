import { newDb, DataType } from 'pg-mem';
import { setPool } from '../src/config/db.js';
import type pg from 'pg';

let dbInstance: any = null;
let mockPool: pg.Pool | null = null;

export function initTestDatabase(): pg.Pool {
  if (mockPool && dbInstance) {
    return mockPool;
  }

  const db = newDb({
    autoCreateForeignKeyIndices: true
  });

  const uuidGenerator = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.text,
    impure: true,
    implementation: uuidGenerator
  });

  db.registerExtension('pgcrypto', (schema) => {
    schema.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.text,
      impure: true,
      implementation: uuidGenerator
    });
  });

  // Timezone-safe to_char implementation
  db.public.registerFunction({
    name: 'to_char',
    args: [DataType.date, DataType.text],
    returns: DataType.text,
    implementation: (d: any) => {
      if (!d) return '';
      if (typeof d === 'string') return d.slice(0, 10);
      if (d instanceof Date) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return String(d).slice(0, 10);
    }
  });

  db.public.none(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL DEFAULT '',
      display_name VARCHAR(255),
      timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE glucose_readings (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      reading_date DATE NOT NULL,
      time_slot VARCHAR(50) NOT NULL,
      value_mg_dl INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT glucose_readings_user_date_slot_unique UNIQUE(user_id, reading_date, time_slot)
    );
  `);

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();
  setPool(pool as any);

  dbInstance = db;
  mockPool = pool as any;
  return mockPool!;
}

// Auto-initialize test database on module load
initTestDatabase();

export function clearDatabase() {
  if (dbInstance) {
    dbInstance.public.none(`
      DELETE FROM glucose_readings;
      DELETE FROM profiles;
      DELETE FROM users;
    `);
  }
}
