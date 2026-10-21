import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { RealtimeProvider } from './context/RealtimeContext';
import AppLayout, { ProtectedRoute, PublicOnlyRoute } from './components/Layout';
import { EmptyState } from './components/ui';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';

// Pages behind login are code-split so the landing page loads fast.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Learning = lazy(() => import('./pages/Learning'));
const CourseDetail = lazy(() => import('./pages/Learning').then((m) => ({ default: m.CourseDetail })));
const Mentoring = lazy(() => import('./pages/Mentoring'));
const TeamFinder = lazy(() => import('./pages/TeamFinder'));
const Chat = lazy(() => import('./pages/Chat'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Resume = lazy(() => import('./pages/Resume'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Applications = lazy(() => import('./pages/Applications'));
const Career = lazy(() => import('./pages/Career'));
const Interview = lazy(() => import('./pages/Interview'));
const InterviewSession = lazy(() => import('./pages/Interview').then((m) => ({ default: m.InterviewSession })));

const Loading = () => <div className="state"><span className="spinner" aria-label="Loading" /></div>;

const NotFound = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <EmptyState title="Page not found" action={<Link className="btn btn-primary" to="/">Go home</Link>}>
      The page you're looking for doesn't exist or was moved.
    </EmptyState>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RealtimeProvider>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route element={<PublicOnlyRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                  </Route>
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/:id" element={<Profile />} />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/projects/:id" element={<ProjectDetail />} />
                      <Route path="/learning" element={<Learning />} />
                      <Route path="/learning/:id" element={<CourseDetail />} />
                      <Route path="/mentoring" element={<Mentoring />} />
                      <Route path="/team-finder" element={<TeamFinder />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/resume" element={<Resume />} />
                      <Route path="/jobs" element={<Jobs />} />
                      <Route path="/applications" element={<Applications />} />
                      <Route path="/career" element={<Career />} />
                      <Route path="/interview" element={<Interview />} />
                      <Route path="/interview/:id" element={<InterviewSession />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RealtimeProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
