import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'STUDENT' | 'SIN_ROL';
  document?: string;
  phone?: string;
  institution?: Types.ObjectId;
  status: 'Activo' | 'Inactivo';
  deactivatedGroupIds?: Types.ObjectId[]; // <-- CAMBIO IMPORTANTE
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // Ocultar por defecto
  role: { type: String, enum: ['ADMIN', 'STUDENT', 'SIN_ROL'], default: 'SIN_ROL' },
  document: { type: String },
  phone: { type: String },
  institution: { type: Schema.Types.ObjectId, ref: 'Institution', default: null },
  status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' },
  deactivatedGroupIds: [{ type: Schema.Types.ObjectId, ref: 'Group' }], // <-- CAMBIO IMPORTANTE
}, { timestamps: true });

// Middleware para encriptar la contraseña antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  const user = await User.findOne({ _id: this._id }).select('password');
  if (!user || !user.password) return false;
  return bcrypt.compare(password, user.password);
};

export const User = mongoose.model<IUser>('User', userSchema);