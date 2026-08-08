import { create } from 'zustand';
import {
  closeMatch,
  finalizeProfileReadiness,
  getMyProfile,
  getMyRitualAnswers,
  getPaymentState,
  getProfileViewStatus,
  getSession,
  handleSwipe,
  listGalleryProfiles,
  listMatches,
  listProfilePhotos,
  markMatchRead,
  onAuthStateChange,
  saveRitualAnswer,
  sendMatchMessage,
  signInWithEmail,
  signOut as signOutRequest,
  signUpWithEmail,
  requestMpesaCharge,
  updateMyProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
} from './lib/api';
import { fetchPricingPlans } from './lib/plans';
import { isSupabaseConfigured } from './lib/supabase';
import { CurrentUserProfile, Gender, PaidPricingPlan, PricingPlanOption, ProfilePhoto, ProfileUpdateInput, SignUpInput, SwipeDirection, UserProfile, ViewState, ChatSession } from './types';

const resolveAuthenticatedView = (
  profile: CurrentUserProfile,
  photoCount: number,
): ViewState => {
  if (!profile.onboardingCompleted) {
    return 'ritual';
  }

  if (photoCount < 3 || !profile.profileReady) {
    if (photoCount === 3 && !profile.profileReady) {
      return 'pricing';
    }

    return 'essence';
  }

  return 'gallery';
};

interface SanctuaryStore {
  view: ViewState;
  ritualStep: number;
  formData: Record<number, string>;
  photos: ProfilePhoto[];
  galleryProfiles: UserProfile[];
  activeChats: ChatSession[];
  dailyProfileViews: number;
  profileViewsUsed: number;
  paymentRequired: boolean;
  paymentAmountKsh: number;
  profileViewLockUntil: string | null;
  isPremium: boolean;
  /** Whether a gallery fetch has completed at least once, successfully or not. */
  galleryLoaded: boolean;
  plans: PricingPlanOption[];
  plansLoading: boolean;
  paymentPending: boolean;
  userLocation: string;
  userGender: Gender | '';
  currentProfile: CurrentUserProfile | null;
  sessionReady: boolean;
  backendConfigured: boolean;
  isBusy: boolean;
  galleryLoading: boolean;
  chatsLoading: boolean;
  errorMessage: string;
  infoMessage: string;
  authListenerReady: boolean;
  initializeApp: () => Promise<void>;
  bootstrapAuthenticatedState: (preferredView?: ViewState) => Promise<void>;
  listenForAuthChanges: () => void;
  setView: (view: ViewState) => void;
  setRitualStep: (step: number) => void;
  clearMessages: () => void;
  setErrorMessage: (message: string) => void;
  register: (input: SignUpInput) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<boolean>;
  saveRitualAnswer: (step: number, answer: string) => Promise<void>;
  refreshPhotos: () => Promise<void>;
  uploadPhoto: (file: File, sortOrder: number) => Promise<void>;
  removePhoto: (photo: ProfilePhoto) => Promise<void>;
  completePhotoStep: () => Promise<void>;
  continueWithFreePlan: () => Promise<void>;
  loadPricingPlans: () => Promise<void>;
  loadGallery: () => Promise<void>;
  swipeProfile: (targetProfileId: string, direction: SwipeDirection) => Promise<{ matched: boolean }>;
  startPremiumPayment: (planId: PaidPricingPlan, phoneNumber: string) => Promise<void>;
  loadChats: () => Promise<void>;
  markChatRead: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  closeConnection: (chatId: string, reason: string) => Promise<void>;
}

let authSubscriptionCleanup: (() => void) | null = null;

const resetUnauthedState = (): Pick<
  SanctuaryStore,
  | 'currentProfile'
  | 'activeChats'
  | 'galleryProfiles'
  | 'photos'
  | 'formData'
  | 'ritualStep'
  | 'dailyProfileViews'
  | 'profileViewsUsed'
  | 'paymentRequired'
  | 'paymentAmountKsh'
  | 'profileViewLockUntil'
  | 'isPremium'
  | 'galleryLoaded'
  | 'paymentPending'
  | 'userLocation'
  | 'userGender'
> => ({
  currentProfile: null,
  activeChats: [],
  galleryProfiles: [],
  photos: [],
  formData: {},
  ritualStep: 0,
  dailyProfileViews: 5,
  profileViewsUsed: 0,
  paymentRequired: false,
  paymentAmountKsh: 99,
  profileViewLockUntil: null,
  isPremium: false,
  galleryLoaded: false,
  paymentPending: false,
  userLocation: '',
  userGender: '',
});

// Module-level so a second payment attempt cancels the first poller rather than
// racing it, and so signing out stops the polling.
let paymentPollTimer: ReturnType<typeof setTimeout> | null = null;

const stopPaymentPolling = () => {
  if (paymentPollTimer) {
    clearTimeout(paymentPollTimer);
    paymentPollTimer = null;
  }
};

export const useSanctuaryStore = create<SanctuaryStore>((set, get) => ({
  view: 'home',
  ritualStep: 0,
  formData: {},
  photos: [],
  galleryProfiles: [],
  activeChats: [],
  dailyProfileViews: 5,
  profileViewsUsed: 0,
  paymentRequired: false,
  paymentAmountKsh: 99,
  profileViewLockUntil: null,
  isPremium: false,
  galleryLoaded: false,
  plans: [],
  plansLoading: false,
  paymentPending: false,
  userLocation: '',
  userGender: '',
  currentProfile: null,
  sessionReady: false,
  backendConfigured: isSupabaseConfigured,
  isBusy: false,
  galleryLoading: false,
  chatsLoading: false,
  errorMessage: '',
  infoMessage: '',
  authListenerReady: false,

  initializeApp: async () => {
    if (!isSupabaseConfigured) {
      set({
        sessionReady: true,
        errorMessage:
          'Set VITE_SUPABASE_URL and a browser key to connect the app: VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY.',
      });
      return;
    }

    set({ isBusy: true, errorMessage: '', infoMessage: '' });

    try {
      const session = await getSession();

      if (!session) {
        set({
          ...resetUnauthedState(),
          view: 'home',
          sessionReady: true,
          isBusy: false,
        });
        return;
      }

      await get().bootstrapAuthenticatedState();
    } catch (error) {
      set({
        ...resetUnauthedState(),
        sessionReady: true,
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to initialize the app.',
      });
    }
  },

  bootstrapAuthenticatedState: async (preferredView) => {
    set({ isBusy: true, errorMessage: '', infoMessage: '' });

    try {
      const profile = await getMyProfile();

      if (!profile) {
        set({
          ...resetUnauthedState(),
          view: 'home',
          sessionReady: true,
          isBusy: false,
        });
        return;
      }

      const [answers, photos, profileViewStatus] = await Promise.all([
        getMyRitualAnswers(profile.id),
        listProfilePhotos(profile.id),
        getProfileViewStatus(),
      ]);
      const chats = profileViewStatus.isLocked && !profile.isPremium ? [] : await listMatches();

      const targetView = preferredView ?? resolveAuthenticatedView(profile, photos.length);
      set({
        currentProfile: profile,
        formData: answers,
        photos,
        activeChats: chats,
        dailyProfileViews: profile.dailySwipeLimit,
        profileViewsUsed: profileViewStatus.usedViews,
        paymentRequired: profileViewStatus.isLocked && !profile.isPremium,
        paymentAmountKsh: profileViewStatus.paymentAmountKsh,
        profileViewLockUntil: profileViewStatus.lockedUntil,
        isPremium: profile.isPremium,
        userLocation: profile.location,
        userGender: profile.gender,
        view: targetView,
        sessionReady: true,
        isBusy: false,
      });

      if (targetView === 'gallery') {
        await get().loadGallery();
      }
    } catch (error) {
      set({
        sessionReady: true,
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to load your account.',
      });
    }
  },

  listenForAuthChanges: () => {
    if (!isSupabaseConfigured || get().authListenerReady) {
      return;
    }

    const { data } = onAuthStateChange((_event, session) => {
      if (session) {
        void get().bootstrapAuthenticatedState();
      } else {
        stopPaymentPolling();
        set({
          ...resetUnauthedState(),
          view: 'home',
          sessionReady: true,
        });
      }
    });

    authSubscriptionCleanup = () => {
      data.subscription.unsubscribe();
    };

    set({ authListenerReady: true });
  },

  setView: (view) => set({ view }),

  setRitualStep: (step) => set({ ritualStep: step }),

  clearMessages: () => set({ errorMessage: '', infoMessage: '' }),

  setErrorMessage: (message) => set({ errorMessage: message }),

  register: async (input) => {
    set({ isBusy: true, errorMessage: '', infoMessage: '' });

    try {
      const { needsEmailConfirmation } = await signUpWithEmail(input);

      if (needsEmailConfirmation) {
        set({
          isBusy: false,
          infoMessage:
            'Registration created your account. Confirm your email in Supabase, then sign in to continue.',
          view: 'auth',
        });
        return false;
      }

      await get().bootstrapAuthenticatedState('ritual');
      return true;
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to create your account.',
      });
      return false;
    }
  },

  signIn: async (email, password) => {
    set({ isBusy: true, errorMessage: '', infoMessage: '' });

    try {
      await signInWithEmail(email, password);
      await get().bootstrapAuthenticatedState();
      return true;
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to sign in.',
      });
      return false;
    }
  },

  signOut: async () => {
    set({ isBusy: true, errorMessage: '', infoMessage: '' });
    stopPaymentPolling();

    try {
      await signOutRequest();
      if (authSubscriptionCleanup) {
        authSubscriptionCleanup();
        authSubscriptionCleanup = null;
      }

      set({
        ...resetUnauthedState(),
        authListenerReady: false,
        view: 'home',
        sessionReady: true,
        isBusy: false,
      });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to sign out.',
      });
    }
  },

  updateProfile: async (input) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to update your profile.' });
      return false;
    }

    set({ isBusy: true, errorMessage: '', infoMessage: '' });

    try {
      await updateMyProfile(profile.id, input);
      const refreshedProfile = await getMyProfile();

      set({
        currentProfile: refreshedProfile,
        userLocation: refreshedProfile?.location ?? get().userLocation,
        userGender: refreshedProfile?.gender ?? get().userGender,
        isBusy: false,
        infoMessage: 'Profile updated.',
      });

      return true;
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to update your profile.',
      });
      return false;
    }
  },

  saveRitualAnswer: async (step, answer) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to save your ritual answers.' });
      return;
    }

    const currentAnswers = get().formData;
    set({ isBusy: true, errorMessage: '' });

    try {
      const nextAnswers = await saveRitualAnswer(profile.id, step, answer, currentAnswers);
      const refreshedProfile = await getMyProfile();

      set({
        formData: nextAnswers,
        currentProfile: refreshedProfile,
        userLocation: refreshedProfile?.location ?? get().userLocation,
        userGender: refreshedProfile?.gender ?? get().userGender,
        isBusy: false,
      });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to save your ritual answer.',
      });
    }
  },

  refreshPhotos: async () => {
    const profile = get().currentProfile;

    if (!profile) {
      return;
    }

    try {
      const photos = await listProfilePhotos(profile.id);
      set({ photos });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : 'Unable to refresh photos.',
      });
    }
  },

  uploadPhoto: async (file, sortOrder) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to upload photos.' });
      return;
    }

    set({ isBusy: true, errorMessage: '' });

    try {
      await uploadProfilePhoto(profile.id, file, sortOrder);
      const [photos, refreshedProfile] = await Promise.all([
        listProfilePhotos(profile.id),
        getMyProfile(),
      ]);

      set({
        photos,
        currentProfile: refreshedProfile,
        isBusy: false,
      });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to upload your photo.',
      });
    }
  },

  removePhoto: async (photo) => {
    set({ isBusy: true, errorMessage: '' });

    try {
      await deleteProfilePhoto(photo);
      const profile = get().currentProfile;

      if (profile) {
        const photos = await listProfilePhotos(profile.id);
        set({ photos, isBusy: false });
        return;
      }

      set({ isBusy: false });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to remove that photo.',
      });
    }
  },

  completePhotoStep: async () => {
    const profile = get().currentProfile;
    const photoCount = get().photos.length;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to continue.' });
      return;
    }

    if (photoCount !== 3) {
      set({ errorMessage: 'Add exactly 3 photos before entering the gallery.' });
      return;
    }

    set({ isBusy: true, errorMessage: '' });

    try {
      set({
        isBusy: false,
        view: 'pricing',
      });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to finalize your profile.',
      });
    }
  },

  loadPricingPlans: async () => {
    if (get().plansLoading || get().plans.length > 0) {
      return;
    }

    set({ plansLoading: true });

    try {
      set({ plans: await fetchPricingPlans(), plansLoading: false });
    } catch (error) {
      set({
        plansLoading: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to load pricing plans.',
      });
    }
  },

  continueWithFreePlan: async () => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to choose a plan.' });
      return;
    }

    set({ isBusy: true, errorMessage: '' });

    try {
      await finalizeProfileReadiness(profile.id);

      const refreshedProfile = await getMyProfile();
      const profileViewStatus = await getProfileViewStatus();

      set({
        currentProfile: refreshedProfile,
        dailyProfileViews: refreshedProfile?.dailySwipeLimit ?? 5,
        profileViewsUsed: profileViewStatus.usedViews,
        paymentRequired: profileViewStatus.isLocked && !refreshedProfile?.isPremium,
        paymentAmountKsh: profileViewStatus.paymentAmountKsh,
        profileViewLockUntil: profileViewStatus.lockedUntil,
        isPremium: Boolean(refreshedProfile?.isPremium),
        isBusy: false,
        view: 'gallery',
      });

      await get().loadGallery();
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to choose that plan.',
      });
    }
  },

  loadGallery: async () => {
    if (!get().currentProfile || get().galleryLoading) {
      return;
    }

    set({ galleryLoading: true, errorMessage: '' });

    try {
      const { profiles, status } = await listGalleryProfiles();
      set({
        galleryProfiles: profiles,
        // Marks the attempt as done even when it returns nobody, so an empty
        // gallery shows its own screen instead of retrying forever.
        galleryLoaded: true,
        galleryLoading: false,
        profileViewsUsed: status.usedViews,
        paymentRequired: status.isLocked && !get().isPremium,
        paymentAmountKsh: status.paymentAmountKsh,
        profileViewLockUntil: status.lockedUntil,
      });
    } catch (error) {
      set({
        galleryLoaded: true,
        galleryLoading: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to load the gallery.',
      });
    }
  },

  swipeProfile: async (targetProfileId, direction) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to swipe.' });
      return { matched: false };
    }

    set({ errorMessage: '' });

    try {
      const result = await handleSwipe(targetProfileId, direction);
      const nextProfiles = get().galleryProfiles.filter((profileItem) => profileItem.id !== targetProfileId);
      const nextProfileViewsUsed = get().isPremium
        ? get().profileViewsUsed
        : Math.min(get().dailyProfileViews, get().dailyProfileViews - result.remainingSwipes);

      set({
        galleryProfiles: nextProfiles,
        profileViewsUsed: nextProfileViewsUsed,
      });

      if (result.matched) {
        await get().loadChats();
      }

      if (nextProfiles.length < 3) {
        await get().loadGallery();
      }

      return { matched: result.matched };
    } catch (error) {
      set({
        errorMessage:
          error instanceof Error && error.message.includes('daily_limit_reached')
            ? 'You have reached your free profile view limit.'
            : error instanceof Error && error.message.includes('profile_view_limit_reached')
              ? 'You have reached your free profile view limit.'
            : error instanceof Error
              ? error.message
              : 'Unable to save that swipe.',
      });
      return { matched: false };
    }
  },

  /**
   * Sends the STK prompt via Paystack, then waits for the Paystack webhook to
   * activate the subscription server-side. Nothing here grants premium: the
   * client only reads back what the webhook wrote.
   */
  startPremiumPayment: async (planId, phoneNumber) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to unlock premium.' });
      return;
    }

    stopPaymentPolling();
    set({ isBusy: true, paymentPending: false, errorMessage: '', infoMessage: '' });

    let reference: string;
    let promptMessage: string;

    try {
      ({ reference, message: promptMessage } = await requestMpesaCharge(planId, phoneNumber));
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to start M-Pesa payment.',
      });
      throw error;
    }

    set({
      isBusy: false,
      paymentPending: true,
      // Paystack returns its own prompt copy; fall back when it sends none.
      infoMessage: promptMessage ||
        'STK push sent. Enter your M-Pesa PIN on your phone to unlock premium access.',
    });

    // The prompt expires after about a minute; keep checking a little past that
    // so a slow confirmation still lands without leaving the poll running.
    const deadline = Date.now() + 120_000;

    const finish = async (settled: 'completed' | 'failed' | 'amount_mismatch') => {
      stopPaymentPolling();

      if (settled !== 'completed') {
        set({
          paymentPending: false,
          infoMessage: '',
          errorMessage: settled === 'amount_mismatch'
            ? 'The amount received did not match the plan price. Contact support with your M-Pesa code.'
            : 'The M-Pesa payment was not completed. You can try again.',
        });
        return;
      }

      const [refreshedProfile, profileViewStatus] = await Promise.all([
        getMyProfile(),
        getProfileViewStatus(),
      ]);

      set({
        currentProfile: refreshedProfile,
        isPremium: Boolean(refreshedProfile?.isPremium),
        dailyProfileViews: refreshedProfile?.dailySwipeLimit ?? 5,
        profileViewsUsed: profileViewStatus.usedViews,
        paymentRequired: false,
        profileViewLockUntil: null,
        paymentPending: false,
        infoMessage: 'Payment confirmed. Premium access is now active.',
      });

      await get().loadGallery();
    };

    const poll = async () => {
      try {
        const state = await getPaymentState(reference);

        if (state === 'completed' || state === 'failed' || state === 'amount_mismatch') {
          await finish(state);
          return;
        }
      } catch (error) {
        // A transient read failure should not abandon a payment in flight.
        console.error('Payment status check failed:', error);
      }

      if (Date.now() >= deadline) {
        stopPaymentPolling();
        set({
          paymentPending: false,
          infoMessage:
            'Still waiting for M-Pesa to confirm. If you completed the payment, reopen the app in a moment.',
        });
        return;
      }

      paymentPollTimer = setTimeout(() => void poll(), 3000);
    };

    paymentPollTimer = setTimeout(() => void poll(), 3000);
  },

  loadChats: async () => {
    if (!get().currentProfile) {
      return;
    }

    if (!get().isPremium && get().paymentRequired) {
      set({
        activeChats: [],
        errorMessage: `Unlock premium for ${get().paymentAmountKsh} KSH or wait for the 24-hour profile view window to reset.`,
      });
      return;
    }

    set({ chatsLoading: true, errorMessage: '' });

    try {
      const activeChats = await listMatches();
      set({ activeChats, chatsLoading: false });
    } catch (error) {
      set({
        chatsLoading: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to load conversations.',
      });
    }
  },

  markChatRead: async (chatId) => {
    const chat = get().activeChats.find((item) => item.id === chatId);

    if (!chat || chat.unreadCount === 0) {
      return;
    }

    // Clear the badge immediately; the count is recomputed on the next load.
    set({
      activeChats: get().activeChats.map((item) =>
        item.id === chatId ? { ...item, unreadCount: 0 } : item,
      ),
    });

    try {
      await markMatchRead(chatId);
    } catch (error) {
      console.error('Unable to mark conversation as read:', error);
    }
  },

  // Rethrows so the composer can keep the text and mark the bubble failed.
  // Swallowing the error here used to clear the input and lose the message.
  sendMessage: async (chatId, text) => {
    try {
      await sendMatchMessage(chatId, text);
      await get().loadChats();
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : 'Unable to send your message.',
      });
      throw error;
    }
  },

  closeConnection: async (chatId, reason) => {
    try {
      await closeMatch(chatId, reason);
      await get().loadChats();
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : 'Unable to close that connection.',
      });
    }
  },
}));
