// All /api routes in one place. Everything except /health and /auth requires login.
const express = require('express');
const auth = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { aiLimiter } = require('../middleware/rateLimiters');
const { resumeUpload, verifyUploadedFile } = require('../middleware/upload');
const v = require('../validators');

const users = require('../controllers/user.controller');
const catalog = require('../controllers/catalog.controller');
const projects = require('../controllers/project.controller');
const courses = require('../controllers/course.controller');
const mentoring = require('../controllers/mentoring.controller');
const chat = require('../controllers/chat.controller');
const notifications = require('../controllers/notification.controller');
const jobs = require('../controllers/job.controller');
const applications = require('../controllers/application.controller');
const resumes = require('../controllers/resume.controller');
const aiCtrl = require('../controllers/ai.controller');
const goals = require('../controllers/goal.controller');
const dashboard = require('../controllers/dashboard.controller');

const router = express.Router();
const id = validate({ params: v.idParam });

router.use('/', require('./health.routes'));
router.use('/auth', require('./auth'));

router.use(auth); // ---- everything below requires a valid token ----

// Users & profile
router.get('/users', validate({ query: v.users.list }), users.listUsers);
router.patch('/users/me', validate({ body: v.users.updateMe }), users.updateMe);
router.put('/users/me/skills', validate({ body: v.users.setSkills }), users.setSkills);
router.get('/users/:id', id, users.getUser);
router.get('/users/:id/reviews', id, users.getReviews);

// Catalog
router.get('/catalog/skills', validate({ query: v.catalogQuery }), catalog.listSkills);
router.get('/catalog/roles', catalog.listRoles);

// Projects
router.get('/projects', validate({ query: v.projects.list }), projects.listProjects);
router.post('/projects', validate({ body: v.projects.create }), projects.createProject);
router.get('/projects/mine', projects.myProjects);
router.get('/projects/bookmarks', projects.myBookmarks);
router.get('/projects/:id', id, projects.getProject);
router.patch('/projects/:id', validate({ params: v.idParam, body: v.projects.update }), projects.updateProject);
router.delete('/projects/:id', id, projects.deleteProject);
router.post('/projects/:id/bookmark', id, projects.addBookmark);
router.delete('/projects/:id/bookmark', id, projects.removeBookmark);
router.post('/projects/:id/join-requests', validate({ params: v.idParam, body: v.projects.joinRequest }), projects.requestToJoin);
router.get('/projects/:id/join-requests', id, projects.listJoinRequests);
router.patch('/projects/:id/join-requests/:requestId',
  validate({ params: v.projects.requestParams, body: v.projects.decideRequest }), projects.decideJoinRequest);
router.delete('/projects/:id/members/:userId', validate({ params: v.projects.memberParams }), projects.removeMember);

// Learning
router.get('/courses', validate({ query: v.courses.list }), courses.listCourses);
router.get('/courses/enrollments/me', courses.myEnrollments);
router.get('/courses/:id', id, courses.getCourse);
router.post('/courses/:id/enroll', id, courses.enroll);
router.patch('/courses/:id/progress', validate({ params: v.idParam, body: v.courses.progress }), courses.updateProgress);

// Teaching & mentoring
router.get('/mentoring/offers', validate({ query: v.mentoring.listOffers }), mentoring.listOffers);
router.get('/mentoring/offers/mine', mentoring.myOffers);
router.post('/mentoring/offers', validate({ body: v.mentoring.createOffer }), mentoring.createOffer);
router.patch('/mentoring/offers/:id', validate({ params: v.idParam, body: v.mentoring.updateOffer }), mentoring.updateOffer);
router.delete('/mentoring/offers/:id', id, mentoring.deleteOffer);
router.post('/mentoring/offers/:id/sessions', validate({ params: v.idParam, body: v.mentoring.requestSession }), mentoring.requestSession);
router.get('/mentoring/sessions', validate({ query: v.mentoring.listSessions }), mentoring.listSessions);
router.patch('/mentoring/sessions/:id', validate({ params: v.idParam, body: v.mentoring.updateSession }), mentoring.updateSession);
router.post('/mentoring/sessions/:id/review', validate({ params: v.idParam, body: v.mentoring.review }), mentoring.reviewSession);

// Chat
router.get('/chat/conversations', chat.listConversations);
router.post('/chat/conversations', validate({ body: v.chat.start }), chat.startConversation);
router.get('/chat/unread-count', chat.unreadCount);
router.get('/chat/conversations/:id/messages', validate({ params: v.idParam, query: v.chat.history }), chat.getMessages);
router.post('/chat/conversations/:id/messages', validate({ params: v.idParam, body: v.chat.send }), chat.sendMessage);
router.post('/chat/conversations/:id/read', id, chat.markRead);

// Notifications
router.get('/notifications', notifications.list);
router.get('/notifications/unread-count', notifications.unreadCount);
router.patch('/notifications/read-all', notifications.markAllRead);
router.patch('/notifications/:id/read', id, notifications.markRead);
router.delete('/notifications/:id', id, notifications.remove);

// Jobs & applications
router.get('/jobs', validate({ query: v.jobs.list }), jobs.listJobs);
router.get('/jobs/:id', id, jobs.getJob);
router.get('/jobs/:id/match', aiLimiter, id, jobs.matchJob);
router.get('/applications', applications.list);
router.post('/applications', validate({ body: v.applications.create }), applications.create);
router.patch('/applications/:id', validate({ params: v.idParam, body: v.applications.update }), applications.update);
router.delete('/applications/:id', id, applications.remove);

// Resumes
router.post('/resumes', aiLimiter, resumeUpload, verifyUploadedFile, resumes.upload);
router.get('/resumes', resumes.list);
router.get('/resumes/:id', id, resumes.getOne);
router.delete('/resumes/:id', id, resumes.remove);
router.post('/resumes/:id/match', aiLimiter, validate({ params: v.idParam, body: v.ai.match }), resumes.match);

// AI career intelligence
router.get('/ai/status', aiCtrl.status);
router.get('/ai/recommendations/skills', aiLimiter, aiCtrl.recommendSkills);
router.get('/ai/recommendations/projects', aiLimiter, aiCtrl.recommendProjects);
router.get('/ai/recommendations/teammates', aiLimiter, validate({ query: v.ai.teammates }), aiCtrl.recommendTeammates);
router.post('/ai/skill-gap', aiLimiter, validate({ body: v.ai.targetRole }), aiCtrl.skillGap);
router.post('/ai/roadmap', aiLimiter, validate({ body: v.ai.roadmap }), aiCtrl.roadmap);
router.get('/ai/assistant/history', aiCtrl.assistantHistory);
router.delete('/ai/assistant/history', aiCtrl.clearAssistantHistory);
router.post('/ai/assistant', aiLimiter, validate({ body: v.ai.assistant }), aiCtrl.assistant);
router.get('/ai/interview', aiCtrl.listInterviews);
router.post('/ai/interview', aiLimiter, validate({ body: v.ai.interviewStart }), aiCtrl.startInterview);
router.get('/ai/interview/:id', id, aiCtrl.getInterview);
router.post('/ai/interview/:id/answers', aiLimiter, validate({ params: v.idParam, body: v.ai.interviewAnswer }), aiCtrl.answerInterview);

// Career goals & dashboard
router.get('/goals', goals.list);
router.post('/goals', validate({ body: v.goals.create }), goals.create);
router.patch('/goals/:id', validate({ params: v.idParam, body: v.goals.update }), goals.update);
router.delete('/goals/:id', id, goals.remove);
router.get('/dashboard', dashboard.getDashboard);

module.exports = router;
