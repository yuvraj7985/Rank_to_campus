import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  admissionRound: { type: mongoose.Schema.Types.ObjectId, ref: 'AdmissionRound' },
  status: { type: String, enum: ['draft','submitted','documents_pending','verified','allocated','rejected'], default: 'draft' },
  submittedAt: Date
}, { timestamps: true });
schema.index({ student: 1, admissionRound: 1 }, { unique: true, sparse: true });
export default mongoose.model('Application', schema);
