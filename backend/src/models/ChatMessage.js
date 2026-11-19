import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user','assistant'], required: true },
  message: { type: String, required: true, maxlength: 5000 }
}, { timestamps: true });
export default mongoose.model('ChatMessage', schema);
