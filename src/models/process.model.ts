import mongoose, { Schema, Document } from 'mongoose';
import { Counter } from './counter.model';

export interface IProcess extends Document {
  name: string;
  type: 'Valoración' | 'Procedimiento';
  groups: mongoose.Types.ObjectId[];
  records: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  code: number;
}

const ProcessSchema: Schema<IProcess> = new Schema<IProcess>(
  {
    code: { type: Number, unique: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['Valoración', 'Procedimiento'],
      required: true,
    },
    groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
    records: [{ type: Schema.Types.ObjectId, ref: 'Record' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Middleware para generar el código secuencial antes de guardar
ProcessSchema.pre<IProcess>('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'processCode' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.code = counter.seq;
      next();
    } catch (error: any) {
      return next(error);
    }
  }
  next();
});

export const Process = mongoose.model<IProcess>('Process', ProcessSchema);