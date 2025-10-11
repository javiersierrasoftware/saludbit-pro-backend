import mongoose, { Schema, Document } from 'mongoose';

const AnswerSchema: Schema = new Schema(
  {
    questionIndex: { type: Number, required: true },
    answer: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

export interface ISubmission extends Document {
  record: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  answers: { questionIndex: number; answer: any }[];
}

const SubmissionSchema: Schema<ISubmission> = new Schema<ISubmission>(
  {
    record: { type: Schema.Types.ObjectId, ref: 'Record', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    answers: [AnswerSchema],
  },
  {
    timestamps: true,
  }
);

export const Submission = mongoose.model<ISubmission>('Submission', SubmissionSchema);