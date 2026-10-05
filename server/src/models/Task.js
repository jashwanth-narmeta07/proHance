import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'], default: 'TODO' },
    dueDate: { type: Date },
  },
  { timestamps: true }
);

taskSchema.index({ organizationId: 1, projectId: 1, status: 1 });
taskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });

export default mongoose.model('Task', taskSchema);
