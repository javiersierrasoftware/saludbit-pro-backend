import mongoose, { Schema, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  description?: string;
  tutor?: string;
  code: string;
  processes: mongoose.Types.ObjectId[];
  members: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  institution: mongoose.Types.ObjectId; // <-- CAMBIO IMPORTANTE
}

const GroupSchema: Schema<IGroup> = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    tutor: { type: String, trim: true },
    code: { type: String, required: true, unique: true },
    processes: [{ type: Schema.Types.ObjectId, ref: 'Process' }],
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    institution: { type: Schema.Types.ObjectId, ref: 'Institution', required: true }, // <-- CAMBIO IMPORTANTE
  },
  { timestamps: true }
);

export const Group = mongoose.model<IGroup>('Group', GroupSchema);