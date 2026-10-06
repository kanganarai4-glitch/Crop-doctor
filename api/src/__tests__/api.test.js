'use strict';

const request = require('supertest');
const app = require('../app');

describe('CropDoctor API Endpoints', () => {
  let guestToken = '';
  let userToken = '';
  let createdScanId = '';

  test('GET /health should return 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('cropdoctor-api');
  });

  test('POST /api/auth/guest should return a guest token', async () => {
    const res = await request(app).post('/api/auth/guest');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
    expect(res.body.role).toBe('guest');
    guestToken = res.body.token;
  });

  test('POST /api/auth/otp and POST /api/auth/verify should work', async () => {
    const otpRes = await request(app)
      .post('/api/auth/otp')
      .send({ phone: '9876543210' });
    expect(otpRes.statusCode).toBe(200);

    const verifyRes = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', otp: '123456' });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body).toHaveProperty('token');
    expect(verifyRes.body.role).toBe('user');
    userToken = verifyRes.body.token;
  });

  test('GET /api/disease should list diseases', async () => {
    const res = await request(app).get('/api/disease');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('diseases');
    expect(Array.isArray(res.body.diseases)).toBe(true);
  });

  test('GET /api/disease/:key should return specific disease info', async () => {
    const res = await request(app).get('/api/disease/tomato_early_blight');
    expect(res.statusCode).toBe(200);
    expect(res.body.key).toBe('tomato_early_blight');
    expect(res.body).toHaveProperty('symptoms');
    expect(res.body).toHaveProperty('organic');
    expect(res.body).toHaveProperty('chemical');
  });

  test('GET /api/disease/unknown_key should return 404', async () => {
    const res = await request(app).get('/api/disease/non_existent_key_123');
    expect(res.statusCode).toBe(404);
  });

  test('GET /api/model/latest should return model info', async () => {
    const res = await request(app).get('/api/model/latest');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('modelUrl');
  });

  test('POST /api/scans/analyze without image should return 400', async () => {
    const res = await request(app)
      .post('/api/scans/analyze')
      .set('Authorization', `Bearer ${guestToken}`);
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/scans/analyze with dummy image should succeed', async () => {
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const res = await request(app)
      .post('/api/scans/analyze')
      .set('Authorization', `Bearer ${guestToken}`)
      .attach('image', buffer, 'leaf.jpg');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('scanId');
    expect(res.body.success).toBe(true);
    createdScanId = res.body.scanId;
  });

  test('GET /api/scans should return list of scans', async () => {
    const res = await request(app)
      .get('/api/scans')
      .set('Authorization', `Bearer ${guestToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('scans');
    expect(res.body.count).toBeGreaterThan(0);
  });

  test('GET /api/scans/:id should return single scan', async () => {
    const res = await request(app)
      .get(`/api/scans/${createdScanId}`)
      .set('Authorization', `Bearer ${guestToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(createdScanId);
  });

  test('POST /api/sync should bulk sync offline scans', async () => {
    const res = await request(app)
      .post('/api/sync')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scans: [
          {
            clientId: 'offline_scan_1',
            diseaseKey: 'tomato_early_blight',
            confidence: 0.92,
            timestamp: new Date().toISOString()
          }
        ]
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.syncedCount).toBe(1);
  });

  test('POST /api/feedback should record feedback', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        scanId: createdScanId,
        diseaseKey: 'tomato_early_blight',
        helpful: true,
        notes: 'Great diagnosis'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/stats should return stats', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('totalScans');
  });
});
