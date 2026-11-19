import mongoose from 'mongoose';
const cutoffSchema = new mongoose.Schema({
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  examName: { type: String, default: 'JEE Main' },
  year: { type: Number, required: true },
  round: { type: Number, default: 1 },
  category: { type: String, required: true },
  closingRank: { type: Number, required: true, min: 1 },
  openingRank: { type: Number, min: 1 }
}, { timestamps: true });
cutoffSchema.index({ branch: 1, year: 1, round: 1, category: 1 }, { unique: true });
export default mongoose.model('Cutoff', cutoffSchema);
