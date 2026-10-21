// End-to-end tests through the Node server into the real Python AI service.
// Skipped (not faked) when the AI service is not running on AI_SERVICE_URL.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, registerUser, api, aiAvailable } = require('./helpers');
const Job = require('../models/Job');
const Project = require('../models/Project');
const User = require('../models/User');

const RESUME = `Riya Example
riya@example.com | +91 98765 43210 | github.com/riya
SKILLS
JavaScript, React, Node.js, Express, MongoDB, Git
EXPERIENCE
Web Developer Intern (Jan 2023 - Dec 2024)
- Built a REST API used by 1,500 students
- Improved page load time by 35%
PROJECTS
- Study Group Finder built with React and Node.js
EDUCATION
B.Tech Computer Science, Example Institute (2025)`;

describe('AI integration (server ↔ AI service)', async () => {
  const available = await aiAvailable();
  let user;

  before(async () => {
    await setup();
    user = await registerUser();
    await api(user.token).put('/api/users/me/skills').send({ skills: [{ name: 'HTML', level: 'advanced' }, { name: 'CSS', level: 'intermediate' }] });
  });
  after(teardown);

  it('uploads and analyses a resume, rejecting disguised files', { skip: !available && 'AI service not running' }, async () => {
    const res = await api(user.token).post('/api/resumes').attach('resume', Buffer.from(RESUME), { filename: 'cv.txt', contentType: 'text/plain' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.data.resume.parsed.skills.includes('React'));
    assert.ok(res.body.data.resume.analysis.score > 0);
    assert.equal(res.body.data.resume.text, undefined); // raw text not returned by default

    const fake = await api(user.token).post('/api/resumes').attach('resume', Buffer.from('not a pdf at all'), { filename: 'cv.pdf', contentType: 'application/pdf' });
    assert.equal(fake.status, 400);
    const exe = await api(user.token).post('/api/resumes').attach('resume', Buffer.from('MZ...'), { filename: 'cv.exe', contentType: 'application/octet-stream' });
    assert.equal(exe.status, 400);
  });

  it('matches the resume with a job and records the score', { skip: !available && 'AI service not running' }, async () => {
    const job = await Job.create({ title: 'Junior Full Stack Developer', company: 'Fictional Co', description: 'React, Node.js and Docker', requiredSkills: ['React', 'Node.js', 'Docker'] });
    await api(user.token).post('/api/applications').send({ jobId: job._id });
    const res = await api(user.token).get(`/api/jobs/${job._id}/match`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.basedOn, 'resume');
    assert.deepEqual(res.body.data.match.missing_required, ['Docker']);
    const apps = await api(user.token).get('/api/applications');
    assert.equal(apps.body.data.items[0].matchScore, res.body.data.match.score);
  });

  it('computes skill gap and roadmap for a target role', { skip: !available && 'AI service not running' }, async () => {
    const gap = await api(user.token).post('/api/ai/skill-gap').send({ targetRole: 'Frontend Developer' });
    assert.equal(gap.status, 200);
    assert.ok(gap.body.data.coverage > 0);
    const bad = await api(user.token).post('/api/ai/skill-gap').send({ targetRole: 'Astronaut Chef' });
    assert.equal(bad.status, 400);
    const plan = await api(user.token).post('/api/ai/roadmap').send({ targetRole: 'Backend Developer', hoursPerWeek: 10 });
    assert.equal(plan.status, 200);
    assert.ok(plan.body.data.steps.length > 0);
  });

  it('recommends projects and complementary teammates', { skip: !available && 'AI service not running' }, async () => {
    const other = await User.create({ firstName: 'Ops', lastName: 'Person', email: 'ops@test.example', password: 'Passw0rd!', lookingForTeam: true, skills: [{ name: 'Docker', level: 'advanced' }] });
    const project = await Project.create({ owner: other._id, members: [other._id], title: 'React Dashboard', description: 'A React and Node.js analytics dashboard project', techStack: ['React', 'Node.js'], rolesNeeded: ['CSS'] });
    const recs = await api(user.token).get('/api/ai/recommendations/projects');
    assert.equal(recs.status, 200);
    assert.equal(recs.body.data.items[0].project._id, String(project._id));

    const mine = await api(user.token).post('/api/projects').send({ title: 'Ops Tool', description: 'Needs someone who knows Docker well', techStack: ['React'], rolesNeeded: ['Docker'] });
    const team = await api(user.token).get(`/api/ai/recommendations/teammates?projectId=${mine.body.data.project._id}`);
    assert.equal(team.status, 200);
    assert.equal(team.body.data.items[0].user._id, String(other._id));
    const notMember = await api(user.token).get(`/api/ai/recommendations/teammates?projectId=${project._id}`);
    assert.equal(notMember.status, 403);
  });

  it('runs an interview session and stores evaluations', { skip: !available && 'AI service not running' }, async () => {
    const start = await api(user.token).post('/api/ai/interview').send({ role: 'Frontend Developer', count: 3 });
    assert.equal(start.status, 201);
    const session = start.body.data.session;
    for (const q of session.questions) {
      const r = await api(user.token).post(`/api/ai/interview/${session._id}/answers`).send({ qid: q.qid, answer: 'For example, I used this in my project; however there are trade-offs.' });
      assert.equal(r.status, 200);
    }
    const done = await api(user.token).get(`/api/ai/interview/${session._id}`);
    assert.equal(done.body.data.session.status, 'completed');
    assert.equal(typeof done.body.data.session.overallScore, 'number');
  });

  it('answers assistant questions with grounded data and keeps history', { skip: !available && 'AI service not running' }, async () => {
    await api(user.token).post('/api/goals').send({ targetRole: 'Frontend Developer' });
    const res = await api(user.token).post('/api/ai/assistant').send({ message: 'What skills am I missing?' });
    assert.equal(res.status, 200);
    assert.match(res.body.data.reply.content, /Frontend Developer/);
    const hist = await api(user.token).get('/api/ai/assistant/history');
    assert.equal(hist.body.data.items.length, 2);
  });
});
