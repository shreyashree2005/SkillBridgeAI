// Multi-user workflow tests (complements smoke.mjs). Two real browser sessions:
// a newly registered student ("Mia") and the seeded demo account.
// Usage: E2E_BASE_URL=http://localhost:5174 node e2e/workflows.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const BROWSER = process.env.E2E_BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(HERE, 'screenshots');
const DATA = path.join(HERE, '..', '..', 'datasets', 'generated');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const errors = [];
let current;
const step = async (name, fn) => {
  const t = Date.now();
  try { await fn(); results.push(`✔ ${name} (${Date.now() - t} ms)`); }
  catch (err) {
    results.push(`✘ ${name}: ${err.message.split('\n')[0]}`);
    await current?.screenshot({ path: path.join(SHOTS, `FAILED-wf-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
};
const watch = (page, label) => {
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`[${label}] ${m.text()}`); });
  page.setDefaultTimeout(15000);
};
const login = async (page, email, password) => {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/\/dashboard/);
};
const noErrorState = async (page) => {
  if (await page.getByText('Something went wrong').count()) throw new Error('error state rendered');
};

// Minimal valid PDF with text (no extra dependencies).
const makePdf = (lines) => {
  const content = `BT /F1 11 Tf 50 780 Td 14 TL ${lines.map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`).join(' ')} ET`;
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
};

const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
const mia = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const demo = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
watch(mia, 'mia'); watch(demo, 'demo');
const stamp = Date.now();
const offerTitle = `Docker basics ${stamp}`;
const projectTitle = `Workflow Project ${stamp}`;

await step('demo logs in through the login form', async () => { current = demo; await login(demo, 'demo@skillbridge.example', 'DemoPass123'); });

await step('Mia registers', async () => {
  current = mia;
  await mia.goto(`${BASE}/register`);
  await mia.getByLabel('First name').fill('Mia');
  await mia.getByLabel('Last name').fill('Workflow');
  await mia.getByLabel('Email').fill(`mia.${stamp}@test.example`);
  await mia.getByLabel('Password').fill('Passw0rd!');
  await mia.getByRole('button', { name: 'Create account' }).click();
  await mia.waitForURL(/\/profile/);
  const skill = mia.getByPlaceholder('Type a skill and press Enter').first();
  for (const s of ['React', 'Node.js']) { await skill.fill(s); await mia.locator('.ac-list [role=option]').first().waitFor(); await skill.press('Enter'); }
  await mia.getByRole('button', { name: 'Save skills' }).click();
  await mia.getByText('Skills saved').waitFor();
});

await step('top search bar updates results while already on Projects', async () => {
  current = mia;
  await mia.goto(`${BASE}/projects`);
  await mia.getByLabel('Search projects').fill('Marketplace');
  await mia.getByLabel('Search projects').press('Enter');
  await mia.waitForURL(/q=Marketplace/);
  await mia.locator('#project-search').and(mia.locator('[value="Marketplace"]')).waitFor();
  await mia.locator('.cards h3', { hasText: 'Marketplace' }).first().waitFor();
});

await step('learning: enroll, complete a module, see it in My learning', async () => {
  current = mia;
  await mia.goto(`${BASE}/learning`);
  await mia.locator('.cards a').first().click();
  await mia.getByRole('button', { name: 'Enroll for free' }).click();
  await mia.getByText('Enrolled!').waitFor();
  await mia.getByRole('button', { name: 'Mark complete' }).first().click();
  await mia.locator('[aria-label="Course progress"]').and(mia.locator(':not([aria-valuenow="0"])')).waitFor();
  await mia.goto(`${BASE}/learning?tab=mine`);
  await mia.locator('.card-link .subtle', { hasText: /1\/\d+ modules/ }).first().waitFor();
});

await step('mentoring: offer → booking → accept → complete → review → rating', async () => {
  current = mia;
  await mia.goto(`${BASE}/mentoring?tab=offers`);
  await mia.getByRole('button', { name: 'New offer' }).click();
  await mia.getByLabel('Title').fill(offerTitle);
  await mia.getByLabel('Skill').fill('Docker');
  await mia.getByRole('button', { name: 'Publish' }).click();
  await mia.getByText('Offer published').waitFor();

  current = demo;
  await demo.goto(`${BASE}/mentoring`);
  await demo.getByLabel('Search mentoring offers').fill(offerTitle);
  const card = demo.locator('.card', { hasText: offerTitle });
  await card.getByRole('button', { name: 'Book a session' }).click();
  await demo.getByLabel('What do you want to work on?').fill('Help me containerise my app');
  await demo.getByRole('button', { name: 'Request session' }).click();
  await demo.getByText('Session requested').waitFor();

  current = mia;
  await mia.goto(`${BASE}/mentoring?tab=sessions`);
  const s = mia.locator('.card', { hasText: offerTitle });
  await s.getByRole('button', { name: 'Accept' }).click();
  await mia.getByLabel('Meeting link (optional)').fill('https://meet.example.com/abc');
  await mia.getByRole('dialog').getByRole('button', { name: 'Accept' }).click();
  await mia.getByText('Session accepted').waitFor();
  await s.getByRole('link', { name: 'Join meeting' }).waitFor();
  await s.getByRole('button', { name: 'Mark completed' }).click();
  await mia.getByText('Session completed').waitFor();

  current = demo;
  await demo.goto(`${BASE}/mentoring?tab=sessions`);
  await demo.locator('.card', { hasText: offerTitle }).getByRole('button', { name: 'Leave review' }).click();
  await demo.getByRole('radio', { name: '4 stars' }).click();
  await demo.getByLabel('Comment (optional)').fill('Clear and practical');
  await demo.getByRole('button', { name: 'Submit review' }).click();
  await demo.getByText('Thanks for your review').waitFor();
  await demo.locator('.card', { hasText: offerTitle }).getByText('Reviewed').waitFor();

  current = mia;
  await mia.goto(`${BASE}/profile`);
  await mia.getByRole('link', { name: 'View public profile' }).click();
  await mia.getByText('Clear and practical').waitFor();
  await mia.getByText(/4 \(1\)/).waitFor();
});

let projectUrl;
await step('projects: join request → owner accepts → member added', async () => {
  current = mia;
  await mia.goto(`${BASE}/projects`);
  await mia.getByRole('button', { name: 'New project' }).click();
  await mia.getByLabel('Title').fill(projectTitle);
  await mia.getByLabel('Description').fill('A workflow test project that needs DevOps help.');
  const needed = mia.getByLabel('Skills still needed');
  await needed.fill('Docker'); await mia.locator('.ac-list [role=option]').first().waitFor(); await needed.press('Enter');
  await mia.getByRole('button', { name: 'Create project' }).click();
  await mia.waitForURL(/\/projects\/[a-f0-9]{24}$/);
  projectUrl = mia.url();

  current = demo;
  await demo.goto(projectUrl);
  await demo.getByRole('button', { name: 'Request to join' }).click();
  await demo.getByLabel('Message to the owner (optional)').fill('I can help with Docker');
  await demo.getByRole('button', { name: 'Send request' }).click();
  await demo.getByText('Join request pending').waitFor();

  current = mia;
  await mia.goto(projectUrl);
  await mia.getByText('I can help with Docker').waitFor();
  await mia.getByRole('button', { name: 'Accept' }).click();
  await mia.getByText('Request accepted').waitFor();
  await mia.locator('.card', { hasText: 'Team (2/' }).getByText('Demo Student').waitFor();

  current = demo;
  await demo.goto(projectUrl);
  await demo.getByText("You're on this team").waitFor();
});

await step('team finder returns complementary teammates for the project', async () => {
  current = mia;
  await mia.goto(`${BASE}/team-finder?project=${projectUrl.split('/').pop()}`);
  await mia.getByText('Project needs:').waitFor();
  await mia.getByText('Fit score').first().waitFor();
  await noErrorState(mia);
  await mia.screenshot({ path: path.join(SHOTS, 'wf-team-finder.png'), fullPage: true });
});

await step('notifications: live unread count and mark all as read', async () => {
  current = mia;
  await mia.goto(`${BASE}/notifications`);
  await mia.getByText(/wants to join/).first().waitFor();
  await mia.getByRole('button', { name: 'Mark all as read' }).click();
  await mia.getByRole('link', { name: 'Notifications (0 unread)' }).waitFor();
});

await step('seeded notification links open real pages', async () => {
  const notes = JSON.parse(fs.readFileSync(path.join(DATA, 'notifications.json'), 'utf8'));
  const users = JSON.parse(fs.readFileSync(path.join(DATA, 'users.json'), 'utf8'));
  const n = notes.find((x) => x.type === 'join-request');
  const u = users.find((x) => x.id === n.user);
  const ctx = await browser.newContext(); const p = await ctx.newPage(); watch(p, 'synthetic'); current = p;
  await login(p, u.email, 'Synthetic2026!');
  await p.goto(`${BASE}/notifications`);
  await p.locator('a', { hasText: /wants to join/ }).first().click();
  await p.waitForURL(/\/projects\/[a-f0-9]{24}$/);
  await p.locator('h1').first().waitFor();
  await noErrorState(p);
  await ctx.close();
});

await step('applications: save a job, move it to Interviewing, add notes', async () => {
  current = mia;
  await mia.goto(`${BASE}/jobs`);
  await mia.locator('.cards > button').first().click();
  await mia.getByRole('button', { name: 'Save', exact: true }).click();
  await mia.getByText('Saved to your tracker').waitFor();
  await mia.keyboard.press('Escape');
  await mia.goto(`${BASE}/applications`);
  const card = mia.locator('.board-col[aria-label="Saved"] article').first();
  await card.getByLabel('Status').selectOption('interviewing');
  const moved = mia.locator('.board-col[aria-label="Interviewing"] article').first();
  await moved.waitFor();
  await moved.getByRole('button', { name: 'Notes' }).click();
  await mia.getByRole('dialog').getByLabel('Notes').fill('Technical round on Friday');
  await mia.getByRole('button', { name: 'Save notes' }).click();
  await moved.getByText('Technical round on Friday').waitFor();
});

await step('resume: real PDF upload through the UI is parsed', async () => {
  current = mia;
  await mia.goto(`${BASE}/resume`);
  const pdf = makePdf(['Mia Workflow', 'mia@example.com', 'SKILLS', 'Python, Docker, PostgreSQL, React', 'EXPERIENCE',
    'Backend Intern (Jan 2023 - Dec 2024)', '- Built an API used by 900 students', 'EDUCATION', 'B.Tech Computer Science (2026)']);
  await mia.locator('input[type=file]').setInputFiles({ name: 'mia.pdf', mimeType: 'application/pdf', buffer: pdf });
  await mia.getByText('Resume analysed').waitFor();
  for (const s of ['Python', 'Docker', 'PostgreSQL']) await mia.locator('.chip', { hasText: new RegExp(`^${s}$`) }).first().waitFor();
  await mia.getByText('2 yrs').waitFor();
});

await step('resume: a disguised file is rejected with a clear message', async () => {
  current = mia;
  await mia.locator('input[type=file]').setInputFiles({ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not really a pdf') });
  await mia.getByText('The file content does not match its type.').waitFor();
});

await step('skill recommendations and full interview session', async () => {
  current = mia;
  await mia.goto(`${BASE}/career?tab=skills`);
  await mia.locator('.cards .card h3').first().waitFor();
  await mia.goto(`${BASE}/interview`);
  await mia.getByLabel('Role').selectOption('Backend Developer');
  await mia.getByLabel('Questions').fill('3');
  await mia.getByRole('button', { name: 'Start' }).click();
  await mia.waitForURL(/\/interview\/[a-f0-9]{24}/);
  for (let i = 0; i < 3; i += 1) {
    await mia.getByLabel('Your answer').nth(i).fill('For example, in my project I used REST APIs with status codes; however there are trade-offs such as caching versus consistency.');
    await mia.getByRole('button', { name: 'Submit answer' }).first().click();
    await mia.getByText('Key points covered').nth(i).waitFor();
  }
  await mia.getByRole('img', { name: /Overall score/ }).waitFor();
  await mia.goto(`${BASE}/dashboard`);
  await mia.locator('.stat', { hasText: 'Avg. interview score' }).locator('.stat-value').filter({ hasNotText: '—' }).waitFor();
});

await browser.close();
console.log(results.join('\n'));
if (errors.length) console.log('\nBrowser errors:\n' + [...new Set(errors)].join('\n'));
const failed = results.filter((r) => r.startsWith('✘')).length;
console.log(`\n${results.length - failed}/${results.length} workflow steps passed, ${errors.length} browser error(s).`);
process.exit(failed || errors.length ? 1 : 0);
