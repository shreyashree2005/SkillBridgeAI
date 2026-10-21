const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { io: connect } = require('socket.io-client');
const { setup, teardown, registerUser, api, app } = require('./helpers');
const initSockets = require('../sockets');

const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

describe('Real-time chat over Socket.IO', () => {
  let server, url, alice, bob, ioServer;

  before(async () => {
    await setup();
    server = http.createServer(app);
    ioServer = initSockets(server);
    await new Promise((r) => server.listen(0, r));
    url = `http://localhost:${server.address().port}`;
    alice = await registerUser({ firstName: 'Alice' });
    bob = await registerUser({ firstName: 'Bob' });
  });
  after(async () => {
    ioServer.close();
    await new Promise((r) => server.close(r));
    await teardown();
  });

  it('rejects connections without a valid token', async () => {
    const s = connect(url, { auth: { token: 'bad' }, transports: ['websocket'] });
    const err = await once(s, 'connect_error');
    assert.match(err.message, /invalid|expired/i);
    s.close();
  });

  it('delivers messages live to the other participant and pushes notifications', async () => {
    const convo = await api(alice.token).post('/api/chat/conversations').send({ userId: bob.user._id });
    const cid = convo.body.data.conversation._id;

    const a = connect(url, { auth: { token: alice.token }, transports: ['websocket'] });
    const b = connect(url, { auth: { token: bob.token }, transports: ['websocket'] });
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);

    const received = once(b, 'message:new');
    const ack = await new Promise((resolve) => a.emit('message:send', { conversationId: cid, body: 'Hello Bob!' }, resolve));
    assert.equal(ack.ok, true);
    const msg = await received;
    assert.equal(msg.body, 'Hello Bob!');
    assert.equal(String(msg.sender), String(alice.user._id));

    // Persisted, so it is visible over REST too.
    const history = await api(bob.token).get(`/api/chat/conversations/${cid}/messages`);
    assert.equal(history.body.data.items.length, 1);

    // Invalid sends are rejected through the ack, not silently dropped.
    const bad = await new Promise((resolve) => a.emit('message:send', { conversationId: cid, body: '' }, resolve));
    assert.equal(bad.ok, false);

    // Notifications arrive live: Bob requests to join Alice's project.
    const p = await api(alice.token).post('/api/projects').send({ title: 'Live Project', description: 'Testing realtime notifications here' });
    const note = once(a, 'notification:new');
    await api(bob.token).post(`/api/projects/${p.body.data.project._id}/join-requests`).send({});
    assert.equal((await note).type, 'join-request');

    a.close();
    b.close();
  });
});
