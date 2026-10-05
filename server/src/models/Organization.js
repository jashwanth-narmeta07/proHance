import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'],
    },
    companyEmail: { type: String, required: true, lowercase: true, trim: true },
    industry: { type: String, trim: true },
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    country: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    website: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    contactPhone: { type: String, trim: true },

    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'],
      default: 'ACTIVE',
    },

    // Denormalized quick settings; deeper policy documents live in OrganizationPolicy
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// slug already has a unique index via the schema field definition above.
organizationSchema.index({ companyEmail: 1 });

export default mongoose.model('Organization', organizationSchema);
