import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { initTestDatabase, clearDatabase } from './setup.js';

describe('Auth API (/api/auth)', () => {
  const app = createApp();

  beforeAll(() => {
    initTestDatabase();
  });

  beforeEach(() => {
    clearDatabase();
  });

  it('registers a new user and returns JWT token and user profile', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        password: 'Password@123'
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({
      name: 'Sarah Connor',
      email: 'sarah@example.com'
    });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects registration with duplicate email with 409 Conflict', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        password: 'Password@123'
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sarah Duplicate',
        email: 'sarah@example.com',
        password: 'AnotherPassword@123'
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  it('rejects registration with short password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Short Pass',
        email: 'short@example.com',
        password: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at least 8 characters');
  });

  it('authenticates user with valid credentials', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password@123'
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'john@example.com',
        password: 'Password@123'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('john@example.com');
  });

  it('rejects login with incorrect password with 401 Unauthorized', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password@123'
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'john@example.com',
        password: 'WrongPassword'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
  });

  it('retrieves current authenticated user via /api/auth/me', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ellen Ripley',
        email: 'ripley@example.com',
        password: 'Password@123'
      });

    const token = regRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('ripley@example.com');
  });

  it('rejects unauthenticated requests to /api/auth/me with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required.');
  });
});

