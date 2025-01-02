import { Types } from 'mongoose';

export type MongoId = Types.ObjectId | string;

export const toObjectId = (id: MongoId): Types.ObjectId => {
  return typeof id === 'string' ? new Types.ObjectId(id) : id;
};

export const toString = (id: MongoId): string => {
  return typeof id === 'string' ? id : id.toString();
};

// Mongoose Document types
export interface MongooseDocument {
  _id: Types.ObjectId;
  save(): Promise<this>;
  toJSON(): any;
}

export type WithMongoId<T> = T & MongooseDocument;