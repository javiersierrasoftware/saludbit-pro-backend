import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  document?: string;
  phone?: string;
  institution?: mongoose.Types.ObjectId; // referencia a Institution
  status?: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'STUDENT' },
  document: { type: String, default: '' },
  phone: { type: String, default: '' },
  institution: { type: Schema.Types.ObjectId, ref: 'Institution', default: null }, // referencia
  status: { type: String, default: 'Activo' },
});

// Hashea la contraseña antes de guardar
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compara la contraseña al hacer login
UserSchema.methods.comparePassword = function (candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);