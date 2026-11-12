import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import './setup.js';
import { createApp } from '../src/app.js';
import { clearDatabase } from './setup.js';

describe('Reporting Engine API (/api/reports)', () => {
  const app = createApp();
  let userToken: string;

  beforeEach(async () => {
    clearDatabase();
    const id = Math.random().toString(36).substring(2, 9);
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Report Test User',
        email: `report_${id}@example.com`,
        password: 'Password@123'
      });
    expect(res.status).toBe(201);
    userToken = res.body.token;
  });

  it('computes daily, month-to-date, and previous-month metrics correctly', async () => {
    const selectedDate = '2026-10-15';

    // 1. Readings for selected date (Daily)
    // Values: 90, 140, 115 => Highest: 140, Lowest: 90, Avg: 115.0, Count: 3
    const r1 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: selectedDate, time_slot: 'Morning (fasting)', value_mg_dl: 90 });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: selectedDate, time_slot: 'After lunch', value_mg_dl: 140 });
    expect(r2.status).toBe(201);

    const r3 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: selectedDate, time_slot: 'After dinner', value_mg_dl: 115 });
    expect(r3.status).toBe(201);

    // 2. Extra readings within Month-to-Date (1 Oct - 14 Oct)
    // Value: 105 on 2026-10-05
    const r4 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: '2026-10-05', time_slot: 'Morning (fasting)', value_mg_dl: 105 });
    expect(r4.status).toBe(201);

    // 3. Reading in future of selected date within same month (should NOT be in MTD)
    const r5 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: '2026-10-20', time_slot: 'Morning (fasting)', value_mg_dl: 180 });
    expect(r5.status).toBe(201);

    // 4. Readings in Previous Month (1 Sep - 30 Sep 2026)
    // Values: 88, 132 => Highest: 132, Lowest: 88, Avg: (88+132)/2 = 110.0, Count: 2
    const r6 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: '2026-09-10', time_slot: 'Morning (fasting)', value_mg_dl: 88 });
    expect(r6.status).toBe(201);

    const r7 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: '2026-09-25', time_slot: 'After lunch', value_mg_dl: 132 });
    expect(r7.status).toBe(201);

    // 5. Reading from 2 months ago (August) - should NOT be included in previous month
    const r8 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reading_date: '2026-08-20', time_slot: 'Morning (fasting)', value_mg_dl: 250 });
    expect(r8.status).toBe(201);

    // Request report
    const res = await request(app)
      .get(`/api/reports?date=${selectedDate}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    // Verify Daily report
    expect(res.body.daily).toMatchObject({
      highest: 140,
      lowest: 90,
      average: 115,
      count: 3
    });
    expect(res.body.daily.readings.length).toBe(3);

    // Verify Month-to-Date (1 Oct – 15 Oct)
    // Readings: 90, 140, 115, 105. Sum = 450. Count = 4. Avg = 112.5. Max = 140. Min = 90.
    expect(res.body.month_to_date).toMatchObject({
      start_date: '2026-10-01',
      end_date: '2026-10-15',
      highest: 140,
      lowest: 90,
      average: 112.5,
      count: 4
    });

    // Verify Previous Month (1 Sep – 30 Sep)
    // Readings: 88, 132. Sum = 220. Count = 2. Avg = 110. Max = 132. Min = 88.
    expect(res.body.previous_month).toMatchObject({
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      highest: 132,
      lowest: 88,
      average: 110,
      count: 2
    });
  });

  it('handles 0 readings gracefully with null stats for empty state', async () => {
    const res = await request(app)
      .get('/api/reports?date=2026-11-12')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    expect(res.body.daily).toMatchObject({
      highest: null,
      lowest: null,
      average: null,
      count: 0,
      readings: []
    });

    expect(res.body.month_to_date).toMatchObject({
      highest: null,
      lowest: null,
      average: null,
      count: 0
    });

    expect(res.body.previous_month).toMatchObject({
      highest: null,
      lowest: null,
      average: null,
      count: 0
    });
  });
});
