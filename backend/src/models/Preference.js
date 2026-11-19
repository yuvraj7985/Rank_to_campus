import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  admissionRound: { type: mongoose.Schema.Types.ObjectId, ref: 'AdmissionRound', required: true },
  choices: [{ branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true }, order: { type: Number, required: true } }],
  isLocked: { type: Boolean, default: false }, lockedAt: Date
}, { timestamps: true });
schema.index({ student: 1, admissionRound: 1 }, { unique: true });
export default mongoose.model('Preference', schema);
