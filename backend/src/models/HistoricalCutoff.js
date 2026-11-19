import mongoose from 'mongoose';

const historicalCutoffSchema = new mongoose.Schema({
  collegeCode: { type: String, required: true, trim: true, uppercase: true },
  collegeName: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: '' },
  branchCode: { type: String, required: true, trim: true, uppercase: true },
  branchName: { type: String, trim: true, default: '' },
  examName: { type: String, default: 'JEE Main', trim: true },
  year: { type: Number, required: true },
  round: { type: Number, default: 1 },
  category: { type: String, required: true },
  closingRank: { type: Number, required: true, min: 1 },
  openingRank: { type: Number, min: 1 }
}, { timestamps: true });

historicalCutoffSchema.index({
  collegeCode: 1,
  branchCode: 1,
  examName: 1,
  year: 1,
  round: 1,
  category: 1
}, { unique: true });
historicalCutoffSchema.index({ year: -1, category: 1, examName: 1 });

export default mongoose.model('HistoricalCutoff', historicalCutoffSchema);
