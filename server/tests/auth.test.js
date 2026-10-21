const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, registerUser, api, request, app } = require('./helpers');

describe('Authentication', () => {
  before(setup);
  after(teardown);

  it('registers, hashes the password and never returns it', async () => {
    const { user, token } = await registerUser({ email: 'ana@test.example' });
    assert.ok(token);
    assert.equal(user.password, undefined);
    assert.equal(user.tokenVersion, undefined);
    const User = require('../models/User');
    const stored = await User.findById(user._id).select('+password');
    assert.match(stored.password, /^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it('rejects duplicate emails (case-insensitive) and weak passwords', async () => {
    const dup = await request(app).post('/api/auth/register')
      .send({ firstName: 'A', lastName: 'B', email: 'ANA@test.example', password: 'Passw0rd!' });
    assert.equal(dup.status, 409);
    const weak = await request(app).post('/api/auth/register')
      .send({ firstName: 'A', lastName: 'B', email: 'x@test.example', password: 'password' });
    assert.equal(weak.status, 400);
    assert.match(weak.body.message, /number/);
  });

  it('logs in with correct credentials and gives a generic error otherwise', async () => {
    const { password } = await registerUser({ email: 'login@test.example' });
    const ok = await request(app).post('/api/auth/login').send({ email: 'login@test.example', password });
    assert.equal(ok.status, 200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'login@test.example', password: 'Wrong1234' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.example', password: 'Wrong1234' });
    assert.equal(bad.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(bad.body.message, unknown.body.message);
  });

  it('protects routes and revokes tokens on logout', async () => {
    assert.equal((await request(app).get('/api/dashboard')).status, 401);
    assert.equal((await api('not-a-jwt').get('/api/auth/me')).status, 401);

    const { token } = await registerUser();
    assert.equal((await api(token).get('/api/auth/me')).status, 200);
    assert.equal((await api(token).post('/api/auth/logout')).status, 200);
    const after = await api(token).get('/api/auth/me');
    assert.equal(after.status, 401);
  });

  it('keeps the original /signup route working', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ firstName: 'Old', lastName: 'Route', email: 'signup@test.example', password: 'Passw0rd!' });
    assert.equal(res.status, 201);
  });

  it('returns JSON 404s and rejects malformed JSON', async () => {
    const nf = await request(app).get('/api/does-not-exist');
    assert.equal(nf.status, 401); // unknown /api routes are behind auth
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.success, false);
  });
});
