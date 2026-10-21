const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, registerUser, api } = require('./helpers');
const Course = require('../models/Course');
const Job = require('../models/Job');

describe('Profiles, projects, learning, mentoring, chat, jobs', () => {
  let owner, member, outsider;

  before(async () => {
    await setup();
    owner = await registerUser({ firstName: 'Owner' });
    member = await registerUser({ firstName: 'Member' });
    outsider = await registerUser({ firstName: 'Outsider' });
  });
  after(teardown);

  it('updates profile and skills; strips fields users must not set', async () => {
    const res = await api(owner.token).patch('/api/users/me')
      .send({ headline: 'Full stack dev', lookingForTeam: true, email: 'hijack@test.example', ratingAverage: 5 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.headline, 'Full stack dev');
    assert.notEqual(res.body.data.user.email, 'hijack@test.example');
    assert.equal(res.body.data.user.ratingAverage, 0);

    const skills = await api(owner.token).put('/api/users/me/skills')
      .send({ skills: [{ name: 'React', level: 'advanced' }, { name: 'react', level: 'beginner' }, { name: 'Node.js' }] });
    assert.equal(skills.status, 200);
    assert.equal(skills.body.data.user.skills.length, 2); // duplicate removed

    const bad = await api(owner.token).patch('/api/users/me').send({ links: { github: 'javascript:alert(1)' } });
    assert.equal(bad.status, 400);
  });

  let projectId;
  it('runs the full project workflow with ownership checks', async () => {
    const created = await api(owner.token).post('/api/projects').send({
      title: 'Campus Marketplace', description: 'A marketplace for students to trade used books.',
      techStack: ['React', 'Node.js', 'react'], rolesNeeded: ['Docker'], maxTeamSize: 3,
    });
    assert.equal(created.status, 201);
    projectId = created.body.data.project._id;
    assert.deepEqual(created.body.data.project.techStack, ['React', 'Node.js']);

    const list = await api(member.token).get('/api/projects?q=marketplace');
    assert.equal(list.body.data.items.length, 1);

    assert.equal((await api(member.token).patch(`/api/projects/${projectId}`).send({ title: 'Hacked' })).status, 403);
    assert.equal((await api(owner.token).patch(`/api/projects/${projectId}`).send({ status: 'in-progress' })).status, 200);

    // bookmarks are idempotent
    await api(member.token).post(`/api/projects/${projectId}/bookmark`);
    await api(member.token).post(`/api/projects/${projectId}/bookmark`);
    const detail = await api(member.token).get(`/api/projects/${projectId}`);
    assert.equal(detail.body.data.project.bookmarkCount, 1);
    assert.equal(detail.body.data.project.isBookmarked, true);

    // join request → owner notified → accept → member added
    const jr = await api(member.token).post(`/api/projects/${projectId}/join-requests`).send({ message: 'I know Docker' });
    assert.equal(jr.status, 201);
    assert.equal((await api(member.token).post(`/api/projects/${projectId}/join-requests`).send({})).status, 409);
    assert.equal((await api(member.token).get(`/api/projects/${projectId}/join-requests`)).status, 403);

    const notes = await api(owner.token).get('/api/notifications');
    assert.equal(notes.body.data.items[0].type, 'join-request');

    const decide = await api(owner.token)
      .patch(`/api/projects/${projectId}/join-requests/${jr.body.data.request._id}`).send({ status: 'accepted' });
    assert.equal(decide.status, 200);
    const after = await api(member.token).get(`/api/projects/${projectId}`);
    assert.equal(after.body.data.project.isMember, true);

    assert.equal((await api(outsider.token).delete(`/api/projects/${projectId}`)).status, 403);
  });

  it('tracks course enrollment and progress', async () => {
    const course = await Course.create({
      slug: 'test-course', title: 'Test Course', skills: ['React'],
      modules: [{ title: 'One', durationMinutes: 30 }, { title: 'Two', durationMinutes: 30 }],
    });
    assert.equal((await api(member.token).patch(`/api/courses/${course._id}/progress`).send({ moduleIndex: 0, completed: true })).status, 400);
    assert.equal((await api(member.token).post(`/api/courses/${course._id}/enroll`)).status, 201);
    assert.equal((await api(member.token).post(`/api/courses/${course._id}/enroll`)).status, 200);
    await api(member.token).patch(`/api/courses/${course._id}/progress`).send({ moduleIndex: 0, completed: true });
    const done = await api(member.token).patch(`/api/courses/${course._id}/progress`).send({ moduleIndex: 1, completed: true });
    assert.equal(done.body.data.enrollment.progress, 100);
    assert.equal(done.body.data.enrollment.status, 'completed');
    assert.equal((await api(member.token).patch(`/api/courses/${course._id}/progress`).send({ moduleIndex: 9, completed: true })).status, 400);
  });

  it('runs the mentoring workflow with reviews and rating recomputation', async () => {
    const offer = await api(owner.token).post('/api/mentoring/offers')
      .send({ title: 'React for beginners', skill: 'React', sessionMinutes: 60 });
    assert.equal(offer.status, 201);
    const offerId = offer.body.data.offer._id;

    assert.equal((await api(owner.token).post(`/api/mentoring/offers/${offerId}/sessions`)
      .send({ scheduledAt: new Date(Date.now() + 864e5).toISOString() })).status, 400); // own offer
    assert.equal((await api(member.token).post(`/api/mentoring/offers/${offerId}/sessions`)
      .send({ scheduledAt: '2000-01-01T00:00:00Z' })).status, 400); // past date

    const s = await api(member.token).post(`/api/mentoring/offers/${offerId}/sessions`)
      .send({ scheduledAt: new Date(Date.now() + 864e5).toISOString(), message: 'Help with hooks' });
    const sid = s.body.data.session._id;

    assert.equal((await api(member.token).patch(`/api/mentoring/sessions/${sid}`).send({ status: 'accepted' })).status, 403);
    assert.equal((await api(member.token).post(`/api/mentoring/sessions/${sid}/review`).send({ rating: 5 })).status, 400);
    assert.equal((await api(owner.token).patch(`/api/mentoring/sessions/${sid}`).send({ status: 'completed' })).status, 400);
    await api(owner.token).patch(`/api/mentoring/sessions/${sid}`).send({ status: 'accepted' });
    await api(owner.token).patch(`/api/mentoring/sessions/${sid}`).send({ status: 'completed' });

    assert.equal((await api(member.token).post(`/api/mentoring/sessions/${sid}/review`).send({ rating: 4, comment: 'Great' })).status, 201);
    assert.equal((await api(member.token).post(`/api/mentoring/sessions/${sid}/review`).send({ rating: 5 })).status, 409);
    const profile = await api(outsider.token).get(`/api/users/${owner.user._id}`);
    assert.equal(profile.body.data.user.ratingAverage, 4);
    assert.equal(profile.body.data.user.ratingCount, 1);
  });

  it('sends chat messages only between participants', async () => {
    const convo = await api(owner.token).post('/api/chat/conversations').send({ userId: member.user._id });
    const again = await api(member.token).post('/api/chat/conversations').send({ userId: owner.user._id });
    assert.equal(convo.body.data.conversation._id, again.body.data.conversation._id); // one convo per pair
    const cid = convo.body.data.conversation._id;

    assert.equal((await api(owner.token).post(`/api/chat/conversations/${cid}/messages`).send({ body: 'Hi!' })).status, 201);
    assert.equal((await api(outsider.token).get(`/api/chat/conversations/${cid}/messages`)).status, 404);
    assert.equal((await api(owner.token).post(`/api/chat/conversations/${cid}/messages`).send({ body: '   ' })).status, 400);

    assert.equal((await api(member.token).get('/api/chat/unread-count')).body.data.count, 1);
    await api(member.token).post(`/api/chat/conversations/${cid}/read`);
    assert.equal((await api(member.token).get('/api/chat/unread-count')).body.data.count, 0);
  });

  it('tracks job applications with status history and feeds the dashboard', async () => {
    const job = await Job.create({ title: 'Junior Dev', company: 'Fictional Co', description: 'Build things', requiredSkills: ['React'] });
    const app1 = await api(member.token).post('/api/applications').send({ jobId: job._id, status: 'saved' });
    assert.equal(app1.status, 201);
    assert.equal((await api(member.token).post('/api/applications').send({ jobId: job._id })).status, 409);
    const upd = await api(member.token).patch(`/api/applications/${app1.body.data.application._id}`).send({ status: 'applied' });
    assert.equal(upd.body.data.application.statusHistory.length, 2);
    assert.ok(upd.body.data.application.appliedAt);
    assert.equal((await api(outsider.token).patch(`/api/applications/${app1.body.data.application._id}`).send({ status: 'offer' })).status, 404);

    const dash = await api(member.token).get('/api/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.data.applicationsByStatus.applied, 1);
    assert.equal(dash.body.data.stats.coursesCompleted, 1);
    assert.equal(dash.body.data.stats.projectsJoined, 1);
    assert.ok(dash.body.data.weeklyActivity.some((w) => w.applications === 1));
  });

  it('validates ids and goal input', async () => {
    assert.equal((await api(member.token).get('/api/projects/not-an-id')).status, 400);
    const goal = await api(member.token).post('/api/goals').send({ targetRole: 'Frontend Developer', hoursPerWeek: 10 });
    assert.equal(goal.status, 201);
    const g2 = await api(member.token).post('/api/goals').send({ targetRole: 'Data Analyst' });
    const goals = await api(member.token).get('/api/goals');
    assert.equal(goals.body.data.items.filter((g) => g.status === 'active').length, 1);
    assert.equal(g2.body.data.goal.status, 'active');
  });
});
