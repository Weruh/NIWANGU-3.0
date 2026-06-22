export type ViewState = 'home' | 'auth' | 'register' | 'ritual' | 'essence' | 'pricing' | 'gallery' | 'parlor' | 'profile';
export type Gender = 'female' | 'male';
export type PricingPlan = 'free' | 'premium';
export type SwipeDirection = 'like' | 'pass';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  photos: string[];
  boundary: string;
  ritualAnswers: Record<number, string>;
  distance: string;
}

export interface CurrentUserProfile {
  id: string;
  authUserId: string | null;
  name: string;
  age: number | null;
  gender: Gender | '';
  seekingGender: Gender | '';
  location: string;
  intent: string;
  coreValue: string;
  whyNiwangu: string;
  boundary: string;
  onboardingCompleted: boolean;
  profileReady: boolean;
  isPremium: boolean;
  dailySwipeLimit: number;
}

export interface ProfileViewStatus {
  usedViews: number;
  remainingViews: number;
  isLocked: boolean;
  lockedUntil: string | null;
  paymentAmountKsh: number;
}

export interface ProfileUpdateInput {
  name: string;
  age: number;
  gender: Gender;
  seekingGender: Gender;
  location: string;
  intent: string;
  coreValue: string;
  whyNiwangu: string;
  boundary: string;
}

export interface ProfilePhoto {
  id: string;
  url: string;
  sortOrder: number;
  storagePath: string | null;
}

export interface ChatSession {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerPhoto: string;
  messages: Message[];
  gardenLevel: number;
  valuesOverlap: string[];
  isClosed: boolean;
  lastMessage?: string;
  lastMessageAt?: string | null;
}

export interface Message {
  id: string;
  sender: 'me' | 'partner' | 'system';
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface MatchMessageRow {
  id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  is_system: boolean;
}

export interface RitualQuestion {
  id: number;
  category: string;
  question: string;
  type: 'text' | 'choice';
  options?: string[];
  maxLength?: number;
}

export interface SignUpInput {
  fullName: string;
  age: number;
  gender: Gender;
  location: string;
  email: string;
  password: string;
}

export interface SwipeResult {
  matched: boolean;
  matchId: string | null;
  remainingSwipes: number;
}
