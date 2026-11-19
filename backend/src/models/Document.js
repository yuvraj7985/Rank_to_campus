import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { type: String, enum: ['identity','rank_card','marksheet_10','marksheet_12','category','other'], required: true },
  originalName: String, fileName: String, mimeType: String, size: Number,
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  extractedText: String, reviewNote: String, reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date
}, { timestamps: true });
export default mongoose.model('Document', schema);
