import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import './setup.js';
import { createApp } from '../src/app.js';
import { clearDatabase } from './setup.js';

describe('Glucose Readings API (/api/readings)', () => {
  const app = createApp();
  let userToken: string;
  let otherUserToken: string;
  const today = '2026-11-12';

  beforeEach(async () => {
    clearDatabase();
    const id = Math.random().toString(36).substring(2, 9);

    // Register User 1
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User One',
        email: `user1_${id}@example.com`,
        password: 'Password@123'
      });
    expect(res1.status).toBe(201);
    userToken = res1.body.token;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Two',
        email: `user2_${id}@example.com`,
        password: 'Password@123'
      });
    expect(res2.status).toBe(201);
    otherUserToken = res2.body.token;
  });

  describe('Validation Requirements', () => {
    it('returns exact error "Please enter a glucose value." when value is missing', async () => {
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Please enter a glucose value.');
    });

    it('returns exact error "Value must be between 40 and 600 mg/dl." when value is below 40', async () => {
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 39
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Value must be between 40 and 600 mg/dl.');
    });

    it('returns exact error "Value must be between 40 and 600 mg/dl." when value is above 600', async () => {
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 601
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Value must be between 40 and 600 mg/dl.');
    });

    it('returns exact error "Value must be between 40 and 600 mg/dl." for floating point numbers', async () => {
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 105.5
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Value must be between 40 and 600 mg/dl.');
    });

    it('returns exact error "Date cannot be in the future." when date is in the future', async () => {
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: '2099-01-01',
          time_slot: 'Morning (fasting)',
          value_mg_dl: 100
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Date cannot be in the future.');
    });

    it('returns exact error "You already have an [Slot Name] reading for this date." with 409 status on duplicate slot', async () => {
      // First reading: Morning (fasting)
      const firstRes = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 95
        });
      expect(firstRes.status).toBe(201);

      // Duplicate reading in same slot
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 102
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('You already have an Morning (fasting) reading for this date.');
    });

    it('returns exact error "You can add only 4 readings per day." when adding a 5th reading on same date', async () => {
      const slots = [
        'Morning (fasting)',
        'After breakfast',
        'After lunch',
        'After dinner'
      ];

      for (const slot of slots) {
        const createRes = await request(app)
          .post('/api/readings')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            reading_date: today,
            time_slot: slot,
            value_mg_dl: 110
          });
        expect(createRes.status).toBe(201);
      }

      // Try adding 5th reading on the same date
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 120
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('You can add only 4 readings per day.');
    });
  });

  describe('CRUD & Pagination', () => {
    it('creates, retrieves, paginates, updates, and deletes readings', async () => {
      // 1. Create reading
      const createRes = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'After lunch',
          value_mg_dl: 135
        });

      expect(createRes.status).toBe(201);
      const readingId = createRes.body.data.id;
      expect(createRes.body.data.value_mg_dl).toBe(135);

      // 2. List with pagination
      const listRes = await request(app)
        .get('/api/readings?page=1&limit=20')
        .set('Authorization', `Bearer ${userToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.pagination).toMatchObject({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      // 3. Update reading
      const updateRes = await request(app)
        .put(`/api/readings/${readingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'After lunch',
          value_mg_dl: 140
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.value_mg_dl).toBe(140);

      // 4. Delete reading
      const deleteRes = await request(app)
        .delete(`/api/readings/${readingId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(deleteRes.status).toBe(200);

      // Verify deletion
      const verifyRes = await request(app)
        .get('/api/readings')
        .set('Authorization', `Bearer ${userToken}`);
      expect(verifyRes.body.data.length).toBe(0);
    });

    it('enforces row-level isolation between users', async () => {
      // User 1 creates a reading
      const createRes = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 90
        });
      expect(createRes.status).toBe(201);
      const readingId = createRes.body.data.id;

      // User 2 attempts to update User 1's reading
      const updateRes = await request(app)
        .put(`/api/readings/${readingId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          reading_date: today,
          time_slot: 'Morning (fasting)',
          value_mg_dl: 120
        });
      expect(updateRes.status).toBe(404);

      // User 2 attempts to delete User 1's reading
      const deleteRes = await request(app)
        .delete(`/api/readings/${readingId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);
      expect(deleteRes.status).toBe(404);

      // User 2 does not see User 1's reading in their list
      const listRes = await request(app)
        .get('/api/readings')
        .set('Authorization', `Bearer ${otherUserToken}`);
      expect(listRes.body.data.length).toBe(0);
    });
  });
});
