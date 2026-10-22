// End-to-end browser test of the main user journeys.
//
// Requires the full stack running (AI service, API server, Vite) and a seeded
// database. Uses an installed Chrome/Edge through playwright-core (no browser
// download). Usage:
//   E2E_BASE_URL=http://localhost:5173 node e2e/smoke.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const BROWSER = process.env.E2E_BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
const SHOTS = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const problems = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    results.push(`✔ ${name} (${Date.now() - t} ms)`);
  } catch (err) {
    results.push(`✘ ${name}: ${err.message.split('\n')[0]}`);
    problems.push(name);
  }
};

const watch = (page, label) => {
  page.on('pageerror', (e) => problems.push(`[${label}] page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`[${label}] console: ${m.text()}`);
  });
};

const expectNoErrorState = async (page) => {
  if (await page.getByText('Something went wrong').count()) throw new Error('error state rendered');
};

if (!BROWSER) {
  console.error('No Chrome/Edge found. Set E2E_BROWSER_PATH.');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
watch(page, 'student');
globalThis.__page = page;
page.setDefaultTimeout(15000);
const email = `e2e.${Date.now()}@test.example`;

await step('landing page renders', async () => {
  await page.goto(BASE);
  await page.getByRole('heading', { name: /bridged/i }).waitFor();
  await page.screenshot({ path: path.join(SHOTS, '01-landing.png'), fullPage: true });
});

await step('register a new account', async () => {
  await page.getByRole('link', { name: 'Get started' }).click();
  await page.getByLabel('First name').fill('Eva');
  await page.getByLabel('Last name').fill('Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Passw0rd!');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/profile/);
  await page.getByText('Welcome to SkillBridge AI').waitFor();
});

await step('edit profile and add skills with autocomplete', async () => {
  await page.getByLabel('Headline').fill('CS student · aspiring full stack developer');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Profile updated').waitFor();
  const skill = page.getByPlaceholder('Type a skill and press Enter').first();
  for (const s of ['React', 'JavaScript', 'Node.js', 'HTML', 'CSS']) {
    await skill.fill(s);
    await page.getByRole('option', { name: new RegExp(`^${s.replace('.', '\\.')}`) }).first().waitFor();
    await skill.press('Enter');
  }
  await page.getByRole('button', { name: 'Save skills' }).click();
  await page.getByText('Skills saved').waitFor();
  await page.getByLabel('Target role').selectOption('Full Stack Developer');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByText('Goal saved').waitFor();
  await page.screenshot({ path: path.join(SHOTS, '02-profile.png'), fullPage: true });
});

const pages = [
  ['/dashboard', /Welcome back, Eva/], ['/projects', /Projects/], ['/projects?tab=recommended', /Match/],
  ['/team-finder', /Team finder/], ['/learning', /Course catalog/], ['/mentoring', /Find a mentor/],
  ['/mentoring?tab=sessions', /Sessions/], ['/notifications', /Notifications/], ['/jobs', /Jobs/],
  ['/applications', /Applications/], ['/career?tab=gap', /Skill gap/], ['/career?tab=skills', /Skills to learn/],
  ['/interview', /Interview prep/], ['/chat', /Messages/],
];
for (const [url, marker] of pages) {
  await step(`page ${url} loads without errors`, async () => {
    await page.goto(BASE + url);
    await page.getByText(marker).first().waitFor();
    await page.waitForLoadState('networkidle');
    await expectNoErrorState(page);
    await page.screenshot({ path: path.join(SHOTS, `page-${url.replace(/[/?=&]+/g, '_')}.png`), fullPage: true });
  });
}

let projectUrl;
await step('create, view and bookmark a project', async () => {
  await page.goto(`${BASE}/projects`);
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Title').fill('E2E Study Planner');
  await page.getByLabel('Description').fill('A planner that helps students schedule study sessions together.');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.waitForURL(/\/projects\/[a-f0-9]{24}$/);
  projectUrl = page.url();
  await page.getByRole('heading', { name: 'E2E Study Planner' }).waitFor();
  await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
  await page.getByRole('button', { name: 'Bookmarked' }).waitFor();
});

await step('upload a resume and see the analysis', async () => {
  await page.goto(`${BASE}/resume`);
  const text = 'Eva Tester\neva@example.com | github.com/eva\nSUMMARY\nFull stack student.\nSKILLS\nJavaScript, React, Node.js, MongoDB, Git\nEXPERIENCE\nWeb Intern (Jan 2024 - Dec 2024)\n- Built a REST API used by 800 students\n- Improved load time by 30%\nPROJECTS\n- Study planner built with React\nEDUCATION\nB.Tech Computer Science (2026)\n';
  await page.locator('input[type=file]').setInputFiles({ name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await page.getByText('Resume analysed').waitFor();
  await page.getByText(/Skills detected \(/).waitFor();
  await page.getByRole('button', { name: 'Paste a job description' }).click();
  await page.getByLabel('Job description').fill('Requirements:\n- React, TypeScript, Node.js\nNice to have:\n- Docker');
  await page.getByRole('button', { name: 'Calculate match' }).click();
  await page.getByText(/Required — missing/).waitFor();
  await page.screenshot({ path: path.join(SHOTS, '03-resume.png'), fullPage: true });
});

await step('match a job and add it to the tracker', async () => {
  await page.goto(`${BASE}/jobs`);
  await page.locator('.cards > button').first().click();
  await page.getByRole('button', { name: 'Calculate my match' }).click();
  await page.getByText(/Required — you have/).waitFor();
  await page.getByRole('button', { name: 'I applied' }).click();
  await page.getByText('Marked as applied').waitFor();
  await page.screenshot({ path: path.join(SHOTS, '04-job-match.png') });
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/applications`);
  await page.locator('.board-col[aria-label="Applied"] article').first().waitFor();
});

await step('skill gap and roadmap', async () => {
  await page.goto(`${BASE}/career?tab=gap`);
  await page.getByLabel('Target role').selectOption('Full Stack Developer');
  await page.getByRole('button', { name: 'Analyse my gap' }).click();
  await page.getByText(/Missing \(/).waitFor();
  await page.getByRole('link', { name: 'Build my roadmap' }).click();
  await page.getByRole('button', { name: 'Generate roadmap' }).click();
  await page.locator('.tl-item').first().waitFor();
  await page.screenshot({ path: path.join(SHOTS, '05-roadmap.png'), fullPage: true });
});

await step('career assistant answers from real data', async () => {
  await page.goto(`${BASE}/career`);
  await page.getByLabel('Message the assistant').fill('What skills am I missing?');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByText(/Full Stack Developer skill profile/).waitFor({ timeout: 60000 });
});

await step('mock interview: answer and get scored', async () => {
  await page.goto(`${BASE}/interview`);
  await page.getByLabel('Role').selectOption('Frontend Developer');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForURL(/\/interview\/[a-f0-9]{24}/);
  await page.getByLabel('Your answer').first().fill('For example, in my project I used this; however there are trade-offs, such as performance versus readability.');
  await page.getByRole('button', { name: 'Submit answer' }).first().click();
  await page.getByText('Key points covered').first().waitFor();
  await page.screenshot({ path: path.join(SHOTS, '06-interview.png'), fullPage: true });
});

await step('real-time chat between two users', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 860 } });
  const demo = await ctx2.newPage();
  watch(demo, 'demo');
  await demo.goto(`${BASE}/login`);
  await demo.getByLabel('Email').fill('demo@skillbridge.example');
  await demo.getByLabel('Password').fill('DemoPass123');
  await demo.getByRole('button', { name: 'Log in' }).click();
  await demo.waitForURL(/dashboard/);
  const demoId = await demo.evaluate(async () => {
    const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('sb_token')}` } });
    return (await r.json()).data.user._id;
  });
  await demo.goto(`${BASE}/chat`);

  await page.goto(`${BASE}/profile/${demoId}`);
  await page.getByRole('button', { name: 'Message' }).click();
  await page.waitForURL(/\/chat\?c=/);
  await page.getByLabel('Message', { exact: true }).fill('Hi Demo, want to build something together?');
  await page.getByRole('button', { name: 'Send' }).click();

  // Demo sees the new conversation and message without reloading.
  await demo.getByText('Hi Demo, want to build something together?').first().waitFor({ timeout: 10000 });
  await demo.getByRole('button', { name: /Eva Tester/ }).first().click(); // newest conversation is listed first
  await demo.getByLabel('Message', { exact: true }).fill('Yes! Let us do it 🚀');
  await demo.getByRole('button', { name: 'Send' }).click();
  await page.locator('.bubble.theirs', { hasText: 'Yes! Let us do it' }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, '07-chat.png') });
  await ctx2.close();
});

await step('dark mode and mobile layout', async () => {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.documentElement.dataset.theme) !== 'dark') throw new Error('theme not applied');
  await page.screenshot({ path: path.join(SHOTS, '08-dashboard-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/projects`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error('horizontal overflow on mobile');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('.sidebar.open').waitFor();
  await page.waitForTimeout(400); // let the slide-in animation finish
  await page.screenshot({ path: path.join(SHOTS, '09-mobile-menu.png') });
});

await step('clean up: delete the e2e project', async () => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await page.waitForURL(/projects\?tab=mine/);
});

await step('logout ends the session', async () => {
  await page.locator('.dropdown > button').click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForURL(BASE + '/');
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/login/);
});

await browser.close();
console.log(results.join('\n'));
const errors = problems.filter((p) => p.startsWith('['));
if (errors.length) console.log('\nBrowser errors:\n' + [...new Set(errors)].join('\n'));
const failed = results.filter((r) => r.startsWith('✘')).length;
console.log(`\n${results.length - failed}/${results.length} steps passed, ${errors.length} browser error(s). Screenshots: ${SHOTS}`);
process.exit(failed || errors.length ? 1 : 0);
