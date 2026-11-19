import mongoose from 'mongoose';
const collegeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  location: { type: String, required: true },
  type: { type: String, enum: ['Government','Private','Deemed','Other'], default: 'Private' },
  website: String, description: String, isActive: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('College', collegeSchema);
