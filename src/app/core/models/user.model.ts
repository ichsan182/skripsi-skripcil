import { FinancialData } from '../services/journal.service';

export interface User {
  id?: number | string;
  name: string;
  email: string;
  phone: string;
  password: string;
  profileImage?: string;
  onboardingCompleted?: boolean;
  level?: number;
  financialData?: FinancialData;
  investmentWatchlist?: unknown;
  journal?: unknown;
  streak?: unknown;
  debts?: unknown[];
}

export interface RegisterPayload {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  onboardingCompleted: boolean;
  level: number;
  investmentWatchlist: null;
  journal: null;
  financialData: null;
  streak: null;
  debts: never[];
}
