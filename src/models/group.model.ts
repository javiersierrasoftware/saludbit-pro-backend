import mongoose, { Schema, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  description?: string;
  code: string;
  tutor?: string;
  createdBy: mongoose.Types.ObjectId;
  processes: mongoose.Types.ObjectId[];
  members: mongoose.Types.ObjectId[];
}

const GroupSchema: Schema<IGroup> = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tutor: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    processes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Process',
      },
    ],
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Group = mongoose.model<IGroup>('Group', GroupSchema);