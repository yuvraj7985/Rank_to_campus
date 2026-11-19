import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  admissionRound: { type: mongoose.Schema.Types.ObjectId, ref: 'AdmissionRound', required: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  rankAtAllocation: Number,
  status: { type: String, enum: ['provisional','accepted','declined','cancelled'], default: 'provisional' }
}, { timestamps: true });
schema.index({ student: 1, admissionRound: 1 }, { unique: true });
schema.index({ branch: 1, admissionRound: 1 });
export default mongoose.model('Allocation', schema);
