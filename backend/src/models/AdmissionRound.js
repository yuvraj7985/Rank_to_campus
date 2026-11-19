import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true },
  year: { type: Number, required: true },
  status: { type: String, enum: ['upcoming','open','closed','allocation_completed'], default: 'upcoming' },
  startsAt: Date, endsAt: Date, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export default mongoose.model('AdmissionRound', schema);
