// Resume upload handling. Files are kept in memory only (never written to disk),
// forwarded to the AI service for text extraction, and then discarded.
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.txt': ['text/plain'],
};

// Check the real file signature ("magic bytes"), not just the name.
const hasValidSignature = (ext, buf) => {
  if (ext === '.pdf') return buf.subarray(0, 5).toString('latin1') === '%PDF-';
  if (ext === '.docx') return buf[0] === 0x50 && buf[1] === 0x4b; // ZIP container "PK"
  if (ext === '.txt') return !buf.subarray(0, 4096).includes(0); // no binary NULs
  return false;
};

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext] || !ALLOWED[ext].includes(file.mimetype)) {
      return cb(AppError.badRequest('Only PDF, DOCX or TXT files are allowed.'));
    }
    cb(null, true);
  },
}).single('resume');

const verifyUploadedFile = (req, res, next) => {
  if (!req.file) throw AppError.badRequest('Please attach a resume file in the "resume" field.');
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!hasValidSignature(ext, req.file.buffer)) {
    throw AppError.badRequest('The file content does not match its type.');
  }
  next();
};

module.exports = { resumeUpload, verifyUploadedFile, hasValidSignature };
