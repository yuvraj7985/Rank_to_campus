import mongoose from 'mongoose';
import { calculateProfileCompletion } from '../utils/profile.js';

const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  applicationNumber: { type: String, unique: true, sparse: true },
  fullName: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  dateOfBirth: { type: Date, default: null },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
  state: { type: String, default: '' },
  city: { type: String, default: '' },
  category: { type: String, enum: ['OPEN', 'EWS', 'OBC-NCL', 'SC', 'ST'], default: 'OPEN' },
  subcategory: { type: String, default: '' },
  examName: { type: String, default: 'JEE Main' },
  rank: { type: Number, min: 1, default: null },
  score: { type: Number, min: 0, default: null },
  percentile: { type: Number, min: 0, max: 100, default: null },
  academicInfo: {
    board: { type: String, default: '' },
    schoolName: { type: String, default: '' },
    stream: { type: String, default: '' },
    class10Percentage: { type: Number, min: 0, max: 100, default: null },
    class12Percentage: { type: Number, min: 0, max: 100, default: null }
  },
  interestedBranches: [{ type: String, trim: true }],
  profileCompleted: { type: Boolean, default: false },
  profileCompletion: { type: Number, default: 0, min: 0, max: 100 }
}, { timestamps: true });

function computeProfileCompletion(student) {
  const result = calculateProfileCompletion(student);
  student.profileCompletion = result.profileCompletion;
  student.profileCompleted = result.profileCompleted;
}

studentSchema.pre('save', function(next) {
  computeProfileCompletion(this);
  next();
});

export default mongoose.model('Student', studentSchema);
