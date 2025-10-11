import mongoose, { Schema, Document } from 'mongoose';
import { Counter } from './counter.model';

// Sub-document for questions
const QuestionSchema: Schema = new Schema(
  {
    text: { type: String, required: true },
    type: { type: String, enum: ['text', 'single', 'multiple'], required: true },
    options: [{ type: String }],
  },
  { _id: false }
);

export interface IRecord extends Document {
  code: number;
  name: string;
  questions: {
    text: string;
    type: 'text' | 'single' | 'multiple';
    options: string[];
  }[];
  createdBy: mongoose.Types.ObjectId;
}

const RecordSchema: Schema<IRecord> = new Schema<IRecord>(
  {
    code: { type: Number, unique: true },
    name: { type: String, required: true, trim: true },
    questions: [QuestionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Middleware for auto-incrementing code
RecordSchema.pre<IRecord>('save', async function (next) {
  if (!this.isNew) return next();
  const counter = await Counter.findByIdAndUpdate({ _id: 'recordCode' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  this.code = counter.seq;
  next();
});

export const Record = mongoose.model<IRecord>('Record', RecordSchema);