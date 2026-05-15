export type UserRole = 'claim handler' | 'broker' | 'client' | 'admin';

export interface User {
  userId: string;
  name: string;
  role: UserRole;
  email: string;
  avatar: string;
}
