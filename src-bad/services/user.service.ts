import User from '../models/user.model';
import { IUser, IUserCreate, IUserUpdate, IUserResponse } from '../types/user.types';
import { FilterQuery } from 'mongoose';

export class UserService {
  // Create new user
  async createUser(userData: IUserCreate): Promise<IUserResponse> {
    const user = new User(userData);
    await user.save();
    return user.toJSON();
  }

  // Get all users with pagination and filters
  async getUsers(
    page: number = 1,
    limit: number = 10,
    filters: FilterQuery<IUser> = {}
  ): Promise<{ users: IUserResponse[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .select('-password'),
      User.countDocuments(filters)
    ]);

    return {
      users: users.map(user => user.toJSON()),
      total,
      pages: Math.ceil(total / limit)
    };
  }

  // Get user by ID
  async getUserById(id: string): Promise<IUserResponse | null> {
    const user = await User.findById(id).select('-password');
    return user ? user.toJSON() : null;
  }

  // Update user
  async updateUser(id: string, updates: IUserUpdate): Promise<IUserResponse | null> {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    
    return user ? user.toJSON() : null;
  }

  // Delete user
  async deleteUser(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return !!result;
  }

  // Search users
  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ users: IUserResponse[]; total: number; pages: number }> {
    const searchRegex = new RegExp(query, 'i');
    const filters = {
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { club: searchRegex },
        { country: searchRegex }
      ]
    };

    return this.getUsers(page, limit, filters);
  }

  // Add tournament to user
  async addTournament(userId: string, tournamentId: string): Promise<IUserResponse | null> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { tournaments: tournamentId } },
      { new: true, runValidators: true }
    ).select('-password');

    return user ? user.toJSON() : null;
  }

  // Remove tournament from user
  async removeTournament(userId: string, tournamentId: string): Promise<IUserResponse | null> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { tournaments: tournamentId } },
      { new: true, runValidators: true }
    ).select('-password');

    return user ? user.toJSON() : null;
  }
}
