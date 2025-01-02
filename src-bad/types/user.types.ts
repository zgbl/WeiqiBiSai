export interface IUser {
  id?: string;
  name: string;
  email: string;
  password: string;
  age: number;
  rank: string;
  country?: string;
  city?: string;
  club?: string;
  tournaments: string[];  // Tournament IDs
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserResponse extends Omit<IUser, 'password'> {
  id: string;
}

export interface IUserCreate extends Omit<IUser, 'id' | 'tournaments' | 'createdAt' | 'updatedAt'> {}

export interface IUserUpdate extends Partial<Omit<IUser, 'id' | 'password' | 'tournaments' | 'createdAt' | 'updatedAt'>> {}
