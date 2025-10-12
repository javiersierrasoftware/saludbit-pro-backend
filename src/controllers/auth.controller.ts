import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { generateToken } from '../utils/jwt.util';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({ email, password, name }); // Puedes añadir más campos si los capturas desde el frontend
    const savedUser = await newUser.save();

    const token = generateToken(savedUser.id);
    
    // Populamos la institución para devolver el objeto completo
    await savedUser.populate({ path: 'institution', select: 'name' });

    return res.status(201).json({
      token,
      user: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        document: savedUser.document,
        phone: savedUser.phone,
        institution: savedUser.institution, // Ahora será un objeto { _id: ..., name: ... } o null
        status: savedUser.status,
        deactivatedGroupIds: savedUser.deactivatedGroupIds,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // ✨ Usamos .populate() para obtener los datos de la institución
    const user = await User.findOne({ email }).populate('institution', 'name');

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        document: user.document,
        phone: user.phone,
        institution: user.institution, // Ahora será un objeto { _id: ..., name: ... } o null
        status: user.status,
        deactivatedGroupIds: user.deactivatedGroupIds,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
};