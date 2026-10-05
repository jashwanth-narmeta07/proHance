import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    projectManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
    },
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, status: 1 });
projectSchema.index({ organizationId: 1, members: 1 });

export default mongoose.model('Project', projectSchema);
