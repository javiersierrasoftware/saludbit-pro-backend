import mongoose, { Document, Schema } from 'mongoose';

export interface IInstitution extends Document {
  name: string;
  description?: string;
  createdBy: mongoose.Types.ObjectId; // Admin que creó la institución
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionSchema = new Schema<IInstitution>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Institution = mongoose.model<IInstitution>(
  'Institution',
  InstitutionSchema
);