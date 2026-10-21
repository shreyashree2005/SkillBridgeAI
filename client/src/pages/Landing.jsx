import { Link } from 'react-router-dom';
import {
  ArrowRight, Bot, Briefcase, FileText, FolderGit2, GraduationCap, MessageSquare, Mic, Moon, Route, Sparkles, Sun, Users,
} from 'lucide-react';
import { Brand } from '../components/Layout';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button, Progress } from '../components/ui';

const FEATURES = [
  { icon: FolderGit2, title: 'Projects & portfolio', text: 'Publish projects, bookmark ideas, and recruit teammates with the skills your team is missing.' },
  { icon: Users, title: 'Team finder', text: 'Get teammate suggestions that complement your stack, not copies of it.' },
  { icon: GraduationCap, title: 'Learn & teach', text: 'Track courses module by module, offer mentoring, book sessions and leave reviews.' },
  { icon: MessageSquare, title: 'Real-time chat', text: 'Message collaborators instantly with live delivery and notifications.' },
  { icon: FileText, title: 'Resume analyzer', text: 'Upload a PDF or DOCX for a transparent score, extracted skills and concrete fixes.' },
  { icon: Briefcase, title: 'Job match & tracker', text: 'See how well you fit each job, what is missing, and track every application.' },
  { icon: Route, title: 'Learning roadmaps', text: 'A week-by-week plan to your target role, ordered by prerequisites.' },
  { icon: Mic, title: 'Interview practice', text: 'Role-specific questions with rubric-based feedback on every answer.' },
  { icon: Bot, title: 'AI career coach', text: 'Ask about gaps, plans or applications — answers grounded in your own data.' },
];

export default function Landing() {
  const { resolved, toggle } = useTheme();
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <div className="row">
          <Button variant="ghost" icon={resolved === 'dark' ? Sun : Moon} onClick={toggle} aria-label="Toggle dark mode" />
          {user ? (
            <Link className="btn btn-primary" to="/dashboard">Open dashboard</Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">Log in</Link>
              <Link className="btn btn-primary" to="/register">Get started</Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <span className="eyebrow"><Sparkles size={14} /> Learn • Teach • Collaborate • Build • Get Hired</span>
        <h1>Your career, <span className="grad">bridged</span> from classroom to first job.</h1>
        <p>SkillBridge AI brings your profile, projects, learning, teammates and job search into one place — with
          explainable AI that tells you exactly what to learn next and why.</p>
        <div className="cta">
          <Link className="btn btn-primary btn-lg" to={user ? '/dashboard' : '/register'}>Create your free profile <ArrowRight size={16} /></Link>
          <Link className="btn btn-outline btn-lg" to="/login">Try the demo account</Link>
        </div>
        <p className="subtle" style={{ marginTop: 12 }}>Demo login: demo@skillbridge.example · DemoPass123 (after seeding)</p>
      </section>

      <div className="hero-preview" aria-hidden>
        <div className="frame">
          <div className="grid-3">
            <div className="card card-body stack">
              <span className="subtle">Skill coverage · Full Stack Developer</span>
              <strong style={{ fontSize: 28 }}>64%</strong>
              <Progress value={64} />
              <span className="subtle">Next: Express.js → TypeScript → Docker</span>
            </div>
            <div className="card card-body stack">
              <span className="subtle">Resume score</span>
              <strong style={{ fontSize: 28 }}>78 / 100</strong>
              <Progress value={78} tone="good" />
              <span className="subtle">Add numbers to 2 more bullet points</span>
            </div>
            <div className="card card-body stack">
              <span className="subtle">Job match · Junior Frontend Developer</span>
              <strong style={{ fontSize: 28 }}>Good match</strong>
              <div className="chips"><span className="chip chip-match">React</span><span className="chip chip-match">CSS</span><span className="chip chip-missing">Jest</span></div>
            </div>
          </div>
        </div>
      </div>

      <section className="section">
        <h2>Everything a student builder needs</h2>
        <p className="lead">Inspired by the best of professional networks, freelance marketplaces, course platforms and dev communities — designed for students.</p>
        <div className="grid-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card feature">
              <div className="ficon"><f.icon size={19} /></div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <h2>AI you can actually inspect</h2>
        <p className="lead">Every score comes with its breakdown. Recommendations list their reasons. No black boxes, no invented facts.</p>
        <div className="grid-3">
          {[
            ['1. Add your skills', 'Or upload a resume — skills are extracted automatically.'],
            ['2. Pick a target role', 'Compare yourself to 17 role profiles and see your coverage.'],
            ['3. Follow the plan', 'Courses, projects and teammates matched to your gaps.'],
          ].map(([t, d]) => (
            <div key={t} className="card card-body"><h3>{t}</h3><p className="muted" style={{ marginTop: 6 }}>{d}</p></div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 32 }}>
          <Link className="btn btn-primary btn-lg" to={user ? '/dashboard' : '/register'}>Start building <ArrowRight size={16} /></Link>
        </div>
      </section>

      <footer className="footer">SkillBridge AI · Portfolio project · Demo data is synthetic</footer>
    </div>
  );
}
