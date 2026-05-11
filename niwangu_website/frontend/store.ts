import { create } from 'zustand';
import {
  closeMatch,
  choosePricingPlan as choosePricingPlanRequest,
  getMyProfile,
  getMyRitualAnswers,
  getSession,
  getTodaySwipeCount,
  handleSwipe,
  listGalleryProfiles,
  listMatches,
  listProfilePhotos,
  onAuthStateChange,
  saveRitualAnswer,
  sendMatchMessage,
  signInWithEmail,
  signOut as signOutRequest,
  signUpWithEmail,
  unlockPremium as unlockPremiumRequest,
  updateMyProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
} from './lib/api';
import { isSupabaseConfigured } from './lib/supabase';
import { CurrentUserProfile, Gender, PricingPlan, ProfilePhoto, ProfileUpdateInput, SignUpInput, SwipeDirection, UserProfile, ViewState, ChatSession } from './types';

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
  dailySwipes: number;
  swipedCount: number;
  isPremium: boolean;
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
  choosePricingPlan: (plan: PricingPlan) => Promise<void>;
  loadGallery: () => Promise<void>;
  swipeProfile: (targetProfileId: string, direction: SwipeDirection) => Promise<{ matched: boolean }>;
  unlockPremium: () => Promise<void>;
  loadChats: () => Promise<void>;
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
  | 'dailySwipes'
  | 'swipedCount'
  | 'isPremium'
  | 'userLocation'
  | 'userGender'
> => ({
  currentProfile: null,
  activeChats: [],
  galleryProfiles: [],
  photos: [],
  formData: {},
  ritualStep: 0,
  dailySwipes: 5,
  swipedCount: 0,
  isPremium: false,
  userLocation: '',
  userGender: '',
});

export const useSanctuaryStore = create<SanctuaryStore>((set, get) => ({
  view: 'home',
  ritualStep: 0,
  formData: {},
  photos: [],
  galleryProfiles: [],
  activeChats: [],
  dailySwipes: 5,
  swipedCount: 0,
  isPremium: false,
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

      const [answers, photos, chats, swipedCount] = await Promise.all([
        getMyRitualAnswers(profile.id),
        listProfilePhotos(profile.id),
        listMatches(),
        getTodaySwipeCount(profile.id),
      ]);

      const targetView = preferredView ?? resolveAuthenticatedView(profile, photos.length);
      set({
        currentProfile: profile,
        formData: answers,
        photos,
        activeChats: chats,
        dailySwipes: profile.dailySwipeLimit,
        swipedCount,
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

  choosePricingPlan: async (plan) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to choose a plan.' });
      return;
    }

    set({ isBusy: true, errorMessage: '' });

    try {
      await choosePricingPlanRequest(profile.id, plan);
      const refreshedProfile = await getMyProfile();

      set({
        currentProfile: refreshedProfile,
        dailySwipes: refreshedProfile?.dailySwipeLimit ?? 5,
        isPremium: plan === 'premium',
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
    if (!get().currentProfile) {
      return;
    }

    set({ galleryLoading: true, errorMessage: '' });

    try {
      const galleryProfiles = await listGalleryProfiles();
      set({ galleryProfiles, galleryLoading: false });
    } catch (error) {
      set({
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
      const nextSwipedCount = get().isPremium
        ? get().swipedCount
        : Math.min(get().dailySwipes, get().dailySwipes - result.remainingSwipes);

      set({
        galleryProfiles: nextProfiles,
        swipedCount: nextSwipedCount,
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
            ? 'You have reached your daily intentional connection limit.'
            : error instanceof Error
              ? error.message
              : 'Unable to save that swipe.',
      });
      return { matched: false };
    }
  },

  unlockPremium: async () => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: 'You must be signed in to unlock premium.' });
      return;
    }

    set({ isBusy: true, errorMessage: '' });

    try {
      await unlockPremiumRequest(profile.id);
      const refreshedProfile = await getMyProfile();
      set({
        currentProfile: refreshedProfile,
        isPremium: true,
        dailySwipes: refreshedProfile?.dailySwipeLimit ?? 5,
        isBusy: false,
      });

      await get().loadGallery();
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: error instanceof Error ? error.message : 'Unable to unlock premium.',
      });
    }
  },

  loadChats: async () => {
    if (!get().currentProfile) {
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

  sendMessage: async (chatId, text) => {
    try {
      await sendMatchMessage(chatId, text);
      await get().loadChats();
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : 'Unable to send your message.',
      });
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
