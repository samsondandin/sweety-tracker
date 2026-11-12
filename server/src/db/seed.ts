import bcrypt from 'bcryptjs';
import { getPool, query } from '../config/db.js';
import { VALID_SLOTS } from '../services/readings.service.js';
import { runMigrations } from './migrate.js';

export async function seedDemoData() {
  console.log('Seeding demo data...');

  // Ensure tables exist
  await runMigrations();

  const demoEmail = 'demo@sweety.app';
  const demoPassword = 'Demo@1234';
  const demoName = 'Demo Patient';

  // 1. Upsert Demo User
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const userResult = await query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
     RETURNING id`,
    [demoName, demoEmail, passwordHash]
  );

  const demoUserId = userResult.rows[0].id;

  // 2. Upsert Demo Profile
  await query(
    `INSERT INTO profiles (id, full_name, display_name, timezone)
     VALUES ($1, $2, 'Demo', 'UTC')
     ON CONFLICT (id) DO UPDATE
     SET full_name = EXCLUDED.full_name, display_name = EXCLUDED.display_name`,
    [demoUserId, demoName]
  );

  // 3. Populate 45 days of realistic readings
  // Generating readings backward from today
  const today = new Date();

  // Pseudo-random generator for consistent and realistic numbers
  let seed = 42;
  const randomBetween = (min: number, max: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    return Math.floor(min + rnd * (max - min + 1));
  };

  let insertedCount = 0;

  for (let daysAgo = 45; daysAgo >= 0; daysAgo--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - daysAgo);
    const dateStr = d.toISOString().slice(0, 10);

    // Realistic baseline values per time slot
    const slotBaselines = [
      { slot: VALID_SLOTS[0], min: 82, max: 104 }, // Morning (fasting)
      { slot: VALID_SLOTS[1], min: 115, max: 142 }, // After breakfast
      { slot: VALID_SLOTS[2], min: 118, max: 146 }, // After lunch
      { slot: VALID_SLOTS[3], min: 122, max: 154 }  // After dinner
    ];

    for (const item of slotBaselines) {
      const glucoseValue = randomBetween(item.min, item.max);
      await query(
        `INSERT INTO glucose_readings (user_id, reading_date, time_slot, value_mg_dl)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, reading_date, time_slot)
         DO UPDATE SET value_mg_dl = EXCLUDED.value_mg_dl`,
        [demoUserId, dateStr, item.slot, glucoseValue]
      );
      insertedCount++;
    }
  }

  console.log(`Demo seed completed successfully: ${insertedCount} readings populated for ${demoEmail}.`);
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDemoData()
    .then(() => {
      const pool = getPool();
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

