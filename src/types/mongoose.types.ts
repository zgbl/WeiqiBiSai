import { Types } from 'mongoose';

export type MongoId = string | Types.ObjectId;

export const toObjectId = (id: MongoId): Types.ObjectId => {
  return typeof id === 'string' ? new Types.ObjectId(id) : id;
};

export const toString = (id: MongoId): string => {
  return typeof id === 'string' ? id : id.toString();
};