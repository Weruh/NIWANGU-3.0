export type ViewState = 'home' | 'auth' | 'register' | 'ritual' | 'essence' | 'pricing' | 'gallery' | 'parlor' | 'profile';
export type Gender = 'female' | 'male';
export type PricingPlan = 'free' | '7_days' | '30_days' | '90_days' | '180_days' | '365_days';
export type PaidPricingPlan = Exclude<PricingPlan, 'free'>;
export type BoostSkuId = 'boost_pack_2';
/** Anything requestMpesaCharge can be asked to charge for: a subscription plan or a boost pack. */
export type PurchasableSkuId = PaidPricingPlan | BoostSkuId;
export type SwipeDirection = 'like' | 'pass';
export type PaymentState = 'pending' | 'completed' | 'failed' | 'amount_mismatch';

/** Which tab of the pricing page a plan belongs to. */
export type PricingPlanGroup = 'standard' | 'long_term';

/** A plan as shown in the UI: price and duration from the database, copy from lib/plans. */
export interface PricingPlanOption {
  id: PaidPricingPlan;
  label: string;
  priceKsh: number;
  durationDays: number;
  group: PricingPlanGroup;
  period: string;
  description: string;
  features: string[];
  badge?: string;
  isPopular?: boolean;
  isDark?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  photos: string[];
  boundary: string;
  ritualAnswers: Record<number, string>;
  distance: string;
  /** Why the server surfaced this person, derived from the Ritual answers you both gave. */
  alignmentReasons: string[];
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
  /** True only while the subscription is also unexpired, matching has_active_premium() server-side. */
  isPremium: boolean;
  premiumExpiresAt: string | null;
  dailySwipeLimit: number;
  boostCredits: number;
  /** Timestamp may be in the past — that means no boost is active, not null. */
  boostActiveUntil: string | null;
}

/** A purchasable boost pack: price/credit count from the database, copy is local. */
export interface BoostPackOption {
  id: BoostSkuId;
  label: string;
  priceKsh: number;
  boostCredits: number;
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
  unreadCount: number;
  /** The partner's stated boundary, or null if they never set one. */
  partnerBoundary: string | null;
  /** False only when they stated a boundary you have not acknowledged yet. */
  boundaryAcknowledged: boolean;
}

/** `sending` and `failed` mark optimistic bubbles that the server has not accepted yet. */
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  sender: 'me' | 'partner' | 'system';
  text: string;
  timestamp: number;
  isSystem?: boolean;
  status: MessageStatus;
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
