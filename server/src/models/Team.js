import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

teamSchema.index({ organizationId: 1, departmentId: 1, name: 1 }, { unique: true });
teamSchema.index({ organizationId: 1, managerId: 1 });

export default mongoose.model('Team', teamSchema);
