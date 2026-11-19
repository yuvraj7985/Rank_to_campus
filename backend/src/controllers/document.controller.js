import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Document from '../models/Document.js';
import Student from '../models/Student.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const documentSignatures = {
  'application/pdf': { extensions: ['.pdf'], signature: Buffer.from('%PDF-') },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], signature: Buffer.from([0xff, 0xd8, 0xff]) },
  'image/png': { extensions: ['.png'], signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }
};

async function matchesDocumentSignature(file) {
  const expected = documentSignatures[file.mimetype];
  if (!expected || !expected.extensions.includes(path.extname(file.originalname).toLowerCase())) {
    return false;
  }

  const handle = await fs.promises.open(file.path, 'r');
  try {
    const bytes = Buffer.alloc(expected.signature.length);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    return bytesRead === expected.signature.length && bytes.equals(expected.signature);
  } finally {
    await handle.close();
  }
}

async function removeUploadedFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Secure filename: timestamp + random + sanitised extension only
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Only PDF, JPG and PNG files are allowed.');
      error.statusCode = 400;
      cb(error, false);
    }
  }
}).single('document');

const requiredDocumentTypes = ['marksheet_10', 'marksheet_12', 'rank_card'];

export const uploadRequiredDocuments = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: requiredDocumentTypes.length },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Only PDF, JPG and PNG files are allowed.');
      error.statusCode = 400;
      cb(error, false);
    }
  }
}).fields(requiredDocumentTypes.map((type) => ({ name: type, maxCount: 1 })));

export const createDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Select a document to upload.' });
  }

  if (requiredDocumentTypes.includes(req.body.type)) {
    await removeUploadedFile(req.file.path);
    return res.status(400).json({
      success: false,
      message: 'Class 10, Class 12, and entrance scorecard files must be submitted together.'
    });
  }

  if (!await matchesDocumentSignature(req.file)) {
    await removeUploadedFile(req.file.path);
    return res.status(400).json({ success: false, message: 'The uploaded file content does not match its PDF, JPG or PNG type.' });
  }

  const student = await Student.findOne({ user: req.user._id });
  if (!student) {
    await removeUploadedFile(req.file.path);
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  let doc;
  try {
    doc = await Document.create({
      student: student._id,
      type: req.body.type,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    await removeUploadedFile(req.file.path);
    throw error;
  }

  res.status(201).json({ success: true, data: doc });
});

export const createRequiredDocuments = asyncHandler(async (req, res) => {
  const uploaded = requiredDocumentTypes.map((type) => ({
    type,
    file: req.files?.[type]?.[0]
  }));
  const files = uploaded.map(({ file }) => file).filter(Boolean);
  if (files.length !== requiredDocumentTypes.length) {
    await Promise.all(files.map((file) => removeUploadedFile(file.path)));
    return res.status(400).json({
      success: false,
      message: 'Upload the Class 10 marksheet, Class 12 marksheet, and entrance scorecard together.'
    });
  }

  let signaturesValid;
  try {
    signaturesValid = await Promise.all(
      files.map((file) => matchesDocumentSignature(file))
    );
  } catch (error) {
    await Promise.all(files.map((file) => removeUploadedFile(file.path)));
    throw error;
  }
  if (signaturesValid.some((isValid) => !isValid)) {
    await Promise.all(files.map((file) => removeUploadedFile(file.path)));
    return res.status(400).json({
      success: false,
      message: 'One or more files do not match their PDF, JPG or PNG file type.'
    });
  }

  const student = await Student.findOne({ user: req.user._id });
  if (!student) {
    await Promise.all(files.map((file) => removeUploadedFile(file.path)));
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  const records = uploaded.map(({ type, file }) => ({
    student: student._id,
    type,
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size
  }));
  let documents;
  try {
    documents = await Document.insertMany(records, { ordered: true });
  } catch (error) {
    await Promise.all(files.map((file) => removeUploadedFile(file.path)));
    throw error;
  }

  res.status(201).json({
    success: true,
    message: 'All three documents were submitted together for separate verification.',
    data: documents
  });
});

export const myDocuments = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user._id });
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  const docs = await Document.find({ student: student._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: docs });
});

export const allDocuments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  const docs = await Document.find(filter)
    .populate({
      path: 'student',
      select: 'fullName applicationNumber examName',
      populate: { path: 'user', select: 'name email' }
    })
    .sort({ createdAt: -1 });

  res.json({ success: true, count: docs.length, data: docs });
});

/**
 * Authenticated file download — no public URL exposure.
 * Students can only access their own documents.
 * Admins can access any document.
 */
export const serveDocumentFile = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id).populate('student');
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }

  // Authorization check
  if (req.user.role === 'student') {
    const student = await Student.findOne({ user: req.user._id });
    if (!student || !doc.student || String(doc.student._id) !== String(student._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  const filePath = path.resolve(uploadDir, path.basename(doc.fileName));
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found on server.' });
  }

  res.type(doc.mimeType || 'application/octet-stream');
  res.download(filePath, path.basename(doc.originalName || doc.fileName));
});

export const reviewDocument = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const reviewNote = typeof req.body.reviewNote === 'string' ? req.body.reviewNote.trim() : '';

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be approved or rejected.' });
  }

  if (status === 'rejected' && !reviewNote) {
    return res.status(400).json({ success: false, message: 'A reason is required when rejecting a document.' });
  }

  const doc = await Document.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    {
      status,
      reviewNote,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    },
    { new: true, runValidators: true }
  );

  if (!doc) {
    const exists = await Document.exists({ _id: req.params.id });
    return res.status(exists ? 409 : 404).json({
      success: false,
      message: exists
        ? 'This document has already been reviewed.'
        : 'Document not found.'
    });
  }

  res.json({ success: true, data: doc });
});
