import mongoose from 'mongoose';
const branchSchema = new mongoose.Schema({
  college: { type: mongoose.Schema.Types.ObjectId, ref: 'College', required: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  totalSeats: { type: Number, required: true, min: 0 },
  allocatedSeats: { type: Number, default: 0, min: 0 },
  fees: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
branchSchema.index({ college: 1, code: 1 }, { unique: true });

// Virtual: seats available for new allocations
branchSchema.virtual('availableSeats').get(function () {
  return Math.max(0, this.totalSeats - this.allocatedSeats);
});

export default mongoose.model('Branch', branchSchema);
