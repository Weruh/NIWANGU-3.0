import { errorMessage as describeError } from "./lib/errors";
import { create } from "zustand";
import {
  activateBoostCredit,
  closeMatch,
  fetchBoostPack,
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
  acknowledgeBoundary,
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
} from "./lib/api";
import { fetchPricingPlans } from "./lib/plans";
import { isSupabaseConfigured } from "./lib/supabase";
import {
  BoostPackOption,
  CurrentUserProfile,
  Gender,
  PaidPricingPlan,
  PricingPlanOption,
  ProfilePhoto,
  ProfileUpdateInput,
  PurchasableSkuId,
  SignUpInput,
  SwipeDirection,
  UserProfile,
  ViewState,
  ChatSession,
} from "./types";

const resolveAuthenticatedView = (
  profile: CurrentUserProfile,
  photoCount: number,
): ViewState => {
  if (!profile.onboardingCompleted) {
    return "ritual";
  }

  if (photoCount < 3 || !profile.profileReady) {
    if (photoCount === 3 && !profile.profileReady) {
      return "pricing";
    }

    return "essence";
  }

  return "gallery";
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
  discoveryMode: "discover" | "focus";
  focusedProfileId: string | null;
  discoverySection: import("./types").DiscoverySection;
  discoveryOffset: number;
  discoveryHasMore: boolean;
  selectedChatId: string | null;
  plans: PricingPlanOption[];
  plansLoading: boolean;
  paymentPending: boolean;
  boostCredits: number;
  /** May be a timestamp in the past — that means no boost is active, not null. */
  boostActiveUntil: string | null;
  boostPending: boolean;
  boostPack: BoostPackOption | null;
  boostPackLoading: boolean;
  /** Shown once per login/session-restore; dismissing it is session-only, not persisted. */
  showBoostPromo: boolean;
  userLocation: string;
  userGender: Gender | "";
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
  loadGallery: (
    section?: import("./types").DiscoverySection,
    append?: boolean,
  ) => Promise<void>;
  swipeProfile: (
    targetProfileId: string,
    direction: SwipeDirection,
  ) => Promise<{ matched: boolean; saved: boolean }>;
  startPremiumPayment: (
    planId: PaidPricingPlan,
    phoneNumber: string,
  ) => Promise<void>;
  loadBoostPack: () => Promise<void>;
  startBoostPayment: (phoneNumber: string) => Promise<void>;
  activateBoost: () => Promise<void>;
  dismissBoostPromo: () => void;
  loadChats: () => Promise<void>;
  markChatRead: (chatId: string) => Promise<void>;
  acknowledgeBoundaryFor: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  closeConnection: (chatId: string, reason: string) => Promise<void>;
}

let authSubscriptionCleanup: (() => void) | null = null;

const resetUnauthedState = (): Pick<
  SanctuaryStore,
  | "currentProfile"
  | "activeChats"
  | "galleryProfiles"
  | "photos"
  | "formData"
  | "ritualStep"
  | "dailyProfileViews"
  | "profileViewsUsed"
  | "paymentRequired"
  | "paymentAmountKsh"
  | "profileViewLockUntil"
  | "isPremium"
  | "galleryLoaded"
  | "paymentPending"
  | "userLocation"
  | "userGender"
  | "boostCredits"
  | "boostActiveUntil"
  | "boostPending"
  | "showBoostPromo"
> => ({
  currentProfile: null,
  activeChats: [],
  galleryProfiles: [],
  photos: [],
  formData: {},
  ritualStep: 0,
  dailyProfileViews: 10,
  profileViewsUsed: 0,
  paymentRequired: false,
  paymentAmountKsh: 99,
  profileViewLockUntil: null,
  isPremium: false,
  galleryLoaded: false,
  paymentPending: false,
  userLocation: "",
  userGender: "",
  boostCredits: 0,
  boostActiveUntil: null,
  boostPending: false,
  showBoostPromo: false,
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

// Separate from paymentPollTimer so a boost purchase in flight doesn't cancel
// a concurrent premium purchase's poll, or vice versa.
let boostPaymentPollTimer: ReturnType<typeof setTimeout> | null = null;

const stopBoostPaymentPolling = () => {
  if (boostPaymentPollTimer) {
    clearTimeout(boostPaymentPollTimer);
    boostPaymentPollTimer = null;
  }
};

export const useSanctuaryStore = create<SanctuaryStore>((set, get) => ({
  view: "home",
  ritualStep: 0,
  formData: {},
  photos: [],
  galleryProfiles: [],
  activeChats: [],
  dailyProfileViews: 10,
  profileViewsUsed: 0,
  paymentRequired: false,
  paymentAmountKsh: 99,
  profileViewLockUntil: null,
  isPremium: false,
  galleryLoaded: false,
  discoveryMode: "focus",
  focusedProfileId: null,
  discoverySection: "discover",
  discoveryOffset: 0,
  discoveryHasMore: true,
  selectedChatId: null,
  plans: [],
  plansLoading: false,
  paymentPending: false,
  boostCredits: 0,
  boostActiveUntil: null,
  boostPending: false,
  boostPack: null,
  boostPackLoading: false,
  showBoostPromo: false,
  userLocation: "",
  userGender: "",
  currentProfile: null,
  sessionReady: false,
  backendConfigured: isSupabaseConfigured,
  isBusy: false,
  galleryLoading: false,
  chatsLoading: false,
  errorMessage: "",
  infoMessage: "",
  authListenerReady: false,

  initializeApp: async () => {
    if (!isSupabaseConfigured) {
      set({
        sessionReady: true,
        errorMessage:
          "Set VITE_SUPABASE_URL and a browser key to connect the app: VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY.",
      });
      return;
    }

    set({ isBusy: true, errorMessage: "", infoMessage: "" });

    try {
      const session = await getSession();

      if (!session) {
        set({
          ...resetUnauthedState(),
          view: "home",
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
        errorMessage: describeError(error, "Failed to initialize the app."),
      });
    }
  },

  bootstrapAuthenticatedState: async (preferredView) => {
    set({ isBusy: true, errorMessage: "", infoMessage: "" });

    try {
      const profile = await getMyProfile();

      if (!profile) {
        set({
          ...resetUnauthedState(),
          view: "home",
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
      const chats = await listMatches();

      const targetView =
        preferredView ??
        (new URLSearchParams(window.location.search).has("recovery")
          ? "recovery"
          : resolveAuthenticatedView(profile, photos.length));
      set({
        currentProfile: profile,
        formData: answers,
        ritualStep: Math.max(
          0,
          Array.from({ length: 12 }, (_, i) => i).find(
            (i) => !answers[i + 1],
          ) ?? 11,
        ),
        photos,
        activeChats: chats,
        dailyProfileViews: profile.dailySwipeLimit,
        profileViewsUsed: profileViewStatus.usedViews,
        paymentRequired: profileViewStatus.isLocked && !profile.isPremium,
        paymentAmountKsh: profileViewStatus.paymentAmountKsh,
        profileViewLockUntil: profileViewStatus.lockedUntil,
        isPremium: profile.isPremium,
        boostCredits: profile.boostCredits,
        boostActiveUntil: profile.boostActiveUntil,
        userLocation: profile.location,
        userGender: profile.gender,
        view: targetView,
        sessionReady: true,
        isBusy: false,
        // Fires on every sign-in and every restored session, once the user is
        // past onboarding/pricing setup — dismissing it is session-only, so it
        // reappears on the next bootstrap (next login) regardless.
        showBoostPromo: false,
      });

      if (targetView === "gallery") {
        await get().loadGallery();
        void get().loadBoostPack();
      }
    } catch (error) {
      set({
        sessionReady: true,
        isBusy: false,
        errorMessage: describeError(error, "Unable to load your account."),
      });
    }
  },

  listenForAuthChanges: () => {
    if (!isSupabaseConfigured || get().authListenerReady) {
      return;
    }

    const { data } = onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        set({ view: "recovery", sessionReady: true });
        return;
      }
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      if (
        event === "SIGNED_IN" &&
        (get().isBusy || get().currentProfile?.authUserId === session?.user.id)
      )
        return;
      if (session) {
        setTimeout(() => {
          void get().bootstrapAuthenticatedState();
        }, 0);
      } else {
        stopPaymentPolling();
        stopBoostPaymentPolling();
        set({
          ...resetUnauthedState(),
          view: "home",
          sessionReady: true,
        });
      }
    });

    authSubscriptionCleanup = () => {
      data.subscription.unsubscribe();
    };

    set({ authListenerReady: true });
  },

  setView: (view) => {
    const profile = get().currentProfile;
    if (
      profile &&
      ["gallery", "discover", "likes", "saved", "parlor", "profile"].includes(
        view,
      )
    ) {
      const onboardingView = resolveAuthenticatedView(
        profile,
        get().photos.length,
      );
      if (onboardingView !== "gallery") {
        set({
          view: onboardingView,
          errorMessage:
            "Finish setting up your profile before entering Discover.",
          infoMessage: "",
        });
        return;
      }
    }
    set({ view, errorMessage: "", infoMessage: "" });
    if (
      view === "gallery" ||
      (view === "discover" && get().isPremium) ||
      view === "likes" ||
      view === "saved"
    )
      void get().loadGallery(
        view === "gallery" || view === "discover" ? "discover" : view,
      );
  },

  setRitualStep: (step) => set({ ritualStep: step }),

  clearMessages: () => set({ errorMessage: "", infoMessage: "" }),

  setErrorMessage: (message) => set({ errorMessage: message }),

  register: async (input) => {
    set({ isBusy: true, errorMessage: "", infoMessage: "" });

    try {
      const { needsEmailConfirmation } = await signUpWithEmail(input);

      if (needsEmailConfirmation) {
        set({
          isBusy: false,
          infoMessage:
            "Your account is created. Open the confirmation link in your email, then sign in to continue.",
          view: "auth",
        });
        return false;
      }

      await get().bootstrapAuthenticatedState("ritual");
      return true;
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to create your account."),
      });
      return false;
    }
  },

  signIn: async (email, password) => {
    set({ isBusy: true, errorMessage: "", infoMessage: "" });

    try {
      await signInWithEmail(email, password);
      await get().bootstrapAuthenticatedState();
      return true;
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to sign in."),
      });
      return false;
    }
  },

  signOut: async () => {
    set({ isBusy: true, errorMessage: "", infoMessage: "" });
    stopPaymentPolling();
    stopBoostPaymentPolling();

    try {
      await signOutRequest();

      set({
        ...resetUnauthedState(),
        selectedChatId: null,
        focusedProfileId: null,
        discoverySection: "discover",
        discoveryOffset: 0,
        discoveryHasMore: true,
        view: "home",
        sessionReady: true,
        isBusy: false,
      });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to sign out."),
      });
    }
  },

  updateProfile: async (input) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: "You must be signed in to update your profile." });
      return false;
    }

    set({ isBusy: true, errorMessage: "", infoMessage: "" });

    try {
      await updateMyProfile(profile.id, input);
      const refreshedProfile = await getMyProfile();

      set({
        currentProfile: refreshedProfile,
        userLocation: refreshedProfile?.location ?? get().userLocation,
        userGender: refreshedProfile?.gender ?? get().userGender,
        isBusy: false,
        infoMessage: "Profile updated.",
      });

      return true;
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to update your profile."),
      });
      return false;
    }
  },

  saveRitualAnswer: async (step, answer) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({
        errorMessage: "You must be signed in to save your ritual answers.",
      });
      return;
    }

    const currentAnswers = get().formData;
    set({ isBusy: true, errorMessage: "" });

    try {
      const nextAnswers = await saveRitualAnswer(
        profile.id,
        step,
        answer,
        currentAnswers,
      );
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
        errorMessage: describeError(
          error,
          "Unable to save your ritual answer.",
        ),
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
        errorMessage: describeError(error, "Unable to refresh photos."),
      });
    }
  },

  uploadPhoto: async (file, sortOrder) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: "You must be signed in to upload photos." });
      return;
    }

    set({ isBusy: true, errorMessage: "" });

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
        errorMessage: describeError(error, "Unable to upload your photo."),
      });
    }
  },

  removePhoto: async (photo) => {
    set({ isBusy: true, errorMessage: "" });

    try {
      await deleteProfilePhoto(photo);
      const profile = get().currentProfile;

      if (profile) {
        const photos = await listProfilePhotos(profile.id);
        set({ photos, currentProfile: await getMyProfile(), isBusy: false });
        return;
      }

      set({ isBusy: false });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to remove that photo."),
      });
    }
  },

  completePhotoStep: async () => {
    const profile = get().currentProfile;
    const photoCount = get().photos.length;

    if (!profile) {
      set({ errorMessage: "You must be signed in to continue." });
      return;
    }

    if (photoCount !== 3) {
      set({
        errorMessage: "Add exactly 3 photos before entering the gallery.",
      });
      return;
    }

    set({ isBusy: true, errorMessage: "" });

    try {
      set({
        isBusy: false,
        view: "pricing",
      });
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to finalize your profile."),
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
        errorMessage: describeError(error, "Unable to load pricing plans."),
      });
    }
  },

  continueWithFreePlan: async () => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: "You must be signed in to choose a plan." });
      return;
    }

    set({ isBusy: true, errorMessage: "" });

    try {
      await finalizeProfileReadiness(profile.id);

      const refreshedProfile = await getMyProfile();
      const profileViewStatus = await getProfileViewStatus();

      set({
        currentProfile: refreshedProfile,
        dailyProfileViews: refreshedProfile?.dailySwipeLimit ?? 10,
        profileViewsUsed: profileViewStatus.usedViews,
        paymentRequired:
          profileViewStatus.isLocked && !refreshedProfile?.isPremium,
        paymentAmountKsh: profileViewStatus.paymentAmountKsh,
        profileViewLockUntil: profileViewStatus.lockedUntil,
        isPremium: Boolean(refreshedProfile?.isPremium),
        isBusy: false,
        view: "gallery",
      });

      await get().loadGallery();
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to choose that plan."),
      });
    }
  },

  loadGallery: async (section = get().discoverySection, append = false) => {
    if (!get().currentProfile || get().galleryLoading) {
      return;
    }

    set({ galleryLoading: true, errorMessage: "" });

    try {
      const offset = append ? get().discoveryOffset : 0;
      const { profiles, status } = await listGalleryProfiles(section, offset);
      set({
        galleryProfiles: append
          ? [
              ...new Map(
                [...get().galleryProfiles, ...profiles].map((p) => [p.id, p]),
              ).values(),
            ]
          : profiles,
        focusedProfileId:
          section === "discover"
            ? profiles.some((p) => p.id === get().focusedProfileId)
              ? get().focusedProfileId
              : (profiles[0]?.id ?? null)
            : get().focusedProfileId,
        discoverySection: section,
        discoveryOffset: offset + profiles.length,
        discoveryHasMore: profiles.length === 20,
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
        errorMessage: describeError(error, "Unable to load the gallery."),
      });
    }
  },

  swipeProfile: async (targetProfileId, direction) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: "You must be signed in to swipe." });
      return { matched: false, saved: false };
    }

    set({ errorMessage: "" });

    try {
      const result = await handleSwipe(targetProfileId, direction);
      const nextProfiles = get().galleryProfiles.filter(
        (profileItem) => profileItem.id !== targetProfileId,
      );
      const nextProfileViewsUsed = get().isPremium
        ? get().profileViewsUsed
        : Math.min(
            get().dailyProfileViews,
            get().dailyProfileViews - result.remainingSwipes,
          );

      set({
        galleryProfiles: nextProfiles,
        profileViewsUsed: nextProfileViewsUsed,
        discoveryOffset: Math.max(0, get().discoveryOffset - 1),
        paymentRequired: !get().isPremium && result.remainingSwipes === 0,
      });

      // A refresh failure must not turn a successfully saved decision into a failed one.
      try {
        if (result.matched) await get().loadChats();
        if (nextProfiles.length < 3 || result.remainingSwipes === 0)
          await get().loadGallery();
      } catch (error) {
        set({
          errorMessage: describeError(
            error,
            "Saved. Refresh to load more profiles.",
          ),
        });
      }

      return { matched: result.matched, saved: true };
    } catch (error) {
      const message = describeError(
        error,
        "Unable to save that decision. Please try again.",
      );
      set({
        errorMessage: message.includes("daily_limit_reached")
          ? "You have used your 10 decisions today. Messages remain available."
          : message.includes("profile_view_limit_reached")
            ? "You have used your 10 decisions today. Messages remain available."
            : message.includes("Complete or resume your profile first")
              ? "Finish setting up your profile, or resume discovery in your settings, before liking or passing."
              : message,
      });
      return { matched: false, saved: false };
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
      set({ errorMessage: "You must be signed in to unlock premium." });
      return;
    }

    stopPaymentPolling();
    set({
      isBusy: true,
      paymentPending: false,
      errorMessage: "",
      infoMessage: "",
    });

    let reference: string;
    let promptMessage: string;

    try {
      if (!profile.profileReady) await finalizeProfileReadiness(profile.id);
      ({ reference, message: promptMessage } = await requestMpesaCharge(
        planId,
        phoneNumber,
      ));
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to start M-Pesa payment."),
      });
      throw error;
    }

    set({
      isBusy: false,
      paymentPending: true,
      // Paystack returns its own prompt copy; fall back when it sends none.
      infoMessage:
        promptMessage ||
        "STK push sent. Enter your M-Pesa PIN on your phone to unlock premium access.",
    });

    // The prompt expires after about a minute; keep checking a little past that
    // so a slow confirmation still lands without leaving the poll running.
    const deadline = Date.now() + 120_000;

    const finish = async (
      settled: "completed" | "failed" | "amount_mismatch",
    ) => {
      stopPaymentPolling();

      if (settled !== "completed") {
        set({
          paymentPending: false,
          infoMessage: "",
          errorMessage:
            settled === "amount_mismatch"
              ? "The amount received did not match the plan price. Contact support with your M-Pesa code."
              : "The M-Pesa payment was not completed. You can try again.",
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
        dailyProfileViews: refreshedProfile?.dailySwipeLimit ?? 10,
        profileViewsUsed: profileViewStatus.usedViews,
        paymentRequired: false,
        profileViewLockUntil: null,
        paymentPending: false,
        infoMessage: "Payment confirmed. Premium access is now active.",
      });

      set({
        boostCredits: refreshedProfile?.boostCredits ?? 0,
        boostActiveUntil: refreshedProfile?.boostActiveUntil ?? null,
      });
      await get().loadGallery();
    };

    const poll = async () => {
      try {
        const state = await getPaymentState(reference);

        if (
          state === "completed" ||
          state === "failed" ||
          state === "amount_mismatch"
        ) {
          await finish(state);
          return;
        }
      } catch (error) {
        // A transient read failure should not abandon a payment in flight.
        console.error("Payment status check failed:", error);
      }

      if (Date.now() >= deadline) {
        stopPaymentPolling();
        set({
          paymentPending: false,
          infoMessage:
            "Still waiting for M-Pesa to confirm. If you completed the payment, reopen the app in a moment.",
        });
        return;
      }

      paymentPollTimer = setTimeout(() => void poll(), 3000);
    };

    paymentPollTimer = setTimeout(() => void poll(), 3000);
  },

  loadBoostPack: async () => {
    if (get().boostPackLoading || get().boostPack) {
      return;
    }

    set({ boostPackLoading: true });

    try {
      set({ boostPack: await fetchBoostPack(), boostPackLoading: false });
    } catch (error) {
      set({ boostPackLoading: false });
      console.error("Unable to load the boost pack:", error);
    }
  },

  /**
   * Same STK-push-then-poll shape as startPremiumPayment, but for the boost
   * SKU: on completion it credits boost_credits, never is_premium. Uses its
   * own poll timer so it can't cancel (or be cancelled by) a concurrent
   * premium purchase.
   */
  startBoostPayment: async (phoneNumber) => {
    const profile = get().currentProfile;

    if (!profile) {
      set({ errorMessage: "You must be signed in to buy a boost." });
      return;
    }

    const skuId: PurchasableSkuId = get().boostPack?.id ?? "boost_pack_2";

    stopBoostPaymentPolling();
    set({
      isBusy: true,
      boostPending: false,
      errorMessage: "",
      infoMessage: "",
    });

    let reference: string;
    let promptMessage: string;

    try {
      ({ reference, message: promptMessage } = await requestMpesaCharge(
        skuId,
        phoneNumber,
      ));
    } catch (error) {
      set({
        isBusy: false,
        errorMessage: describeError(error, "Unable to start M-Pesa payment."),
      });
      throw error;
    }

    set({
      isBusy: false,
      boostPending: true,
      infoMessage:
        promptMessage ||
        "STK push sent. Enter your M-Pesa PIN on your phone to buy your boosts.",
    });

    const deadline = Date.now() + 120_000;

    const finish = async (
      settled: "completed" | "failed" | "amount_mismatch",
    ) => {
      stopBoostPaymentPolling();

      if (settled !== "completed") {
        set({
          boostPending: false,
          infoMessage: "",
          errorMessage:
            settled === "amount_mismatch"
              ? "The amount received did not match the boost pack price. Contact support with your M-Pesa code."
              : "The M-Pesa payment was not completed. You can try again.",
        });
        return;
      }

      const refreshedProfile = await getMyProfile();

      set({
        currentProfile: refreshedProfile,
        boostCredits: refreshedProfile?.boostCredits ?? 0,
        boostActiveUntil: refreshedProfile?.boostActiveUntil ?? null,
        boostPending: false,
        infoMessage: "Payment confirmed. Your boosts are ready to use.",
      });
    };

    const poll = async () => {
      try {
        const state = await getPaymentState(reference);

        if (
          state === "completed" ||
          state === "failed" ||
          state === "amount_mismatch"
        ) {
          await finish(state);
          return;
        }
      } catch (error) {
        console.error("Boost payment status check failed:", error);
      }

      if (Date.now() >= deadline) {
        stopBoostPaymentPolling();
        set({
          boostPending: false,
          infoMessage:
            "Still waiting for M-Pesa to confirm. If you completed the payment, reopen the app in a moment.",
        });
        return;
      }

      boostPaymentPollTimer = setTimeout(() => void poll(), 3000);
    };

    boostPaymentPollTimer = setTimeout(() => void poll(), 3000);
  },

  activateBoost: async () => {
    try {
      const outcome = await activateBoostCredit();

      if (outcome === "activated") {
        const refreshedProfile = await getMyProfile();
        set({
          currentProfile: refreshedProfile,
          boostCredits: refreshedProfile?.boostCredits ?? 0,
          boostActiveUntil: refreshedProfile?.boostActiveUntil ?? null,
          infoMessage: "Boost activated for 30 minutes.",
        });
      } else if (outcome === "no_credits") {
        set({
          errorMessage:
            "You have no boosts left. Buy a Boost Pack to activate one.",
        });
      } else if (outcome === "already_active") {
        set({
          errorMessage:
            "A boost is already active. Wait for it to finish before activating another.",
        });
      }
    } catch (error) {
      set({ errorMessage: describeError(error, "Unable to activate boost.") });
    }
  },

  // Session-only: no DB/localStorage write, so the next login (or even a
  // reload that restores the session) shows the promo again by design.
  dismissBoostPromo: () => {
    set({ showBoostPromo: false });
  },

  loadChats: async () => {
    if (!get().currentProfile) {
      return;
    }

    set({ chatsLoading: true, errorMessage: "" });

    try {
      const activeChats = await listMatches();
      set({ activeChats, chatsLoading: false });
    } catch (error) {
      set({
        chatsLoading: false,
        errorMessage: describeError(error, "Unable to load conversations."),
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
      console.error("Unable to mark conversation as read:", error);
    }
  },

  acknowledgeBoundaryFor: async (chatId) => {
    try {
      await acknowledgeBoundary(chatId);
      // Unlock the composer immediately rather than waiting on a reload.
      set({
        activeChats: get().activeChats.map((item) =>
          item.id === chatId ? { ...item, boundaryAcknowledged: true } : item,
        ),
      });
    } catch (error) {
      set({
        errorMessage: describeError(
          error,
          "Unable to record that acknowledgement.",
        ),
      });
      throw error;
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
        errorMessage: describeError(error, "Unable to send your message."),
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
        errorMessage: describeError(error, "Unable to close that connection."),
      });
    }
  },
}));
