import mongoose, { Schema } from 'mongoose';
import { IUser } from '../types/user.types';
import bcrypt from 'bcryptjs';

const userSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true 
  },
  age: { 
    type: Number, 
    required: true,
    min: 0,
    max: 150
  },
  rank: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v: string) {
        return /^([1-9]d|[1-3][0-9]k|[1-9]k)$/.test(v);
      },
      message: 'Invalid rank format (e.g., "1d" or "30k")'
    }
  },
  country: { 
    type: String,
    trim: true
  },
  city: { 
    type: String,
    trim: true
  },
  club: { 
    type: String,
    trim: true
  },
  tournaments: [{
    type: Schema.Types.ObjectId,
    ref: 'Tournament'
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Remove password when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Compare password method
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', userSchema);
