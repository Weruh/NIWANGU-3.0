import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { useSanctuaryStore } from "./store";
import { AppNavigation } from "./components/AppNavigation";
import { BrandLogo } from "./components/BrandLogo";
import { MemberNotifications } from "./components/MemberNotifications";

const BoostPromoModal = lazy(() =>
  import("./components/BoostPromoModal").then((module) => ({
    default: module.BoostPromoModal,
  })),
);
const SanctuaryGate = lazy(() =>
  import("./components/SanctuaryGate").then((module) => ({
    default: module.SanctuaryGate,
  })),
);
const TheKeys = lazy(() =>
  import("./components/TheKeys").then((module) => ({
    default: module.TheKeys,
  })),
);
const TheRegistration = lazy(() =>
  import("./components/TheRegistration").then((module) => ({
    default: module.TheRegistration,
  })),
);
const AlignmentRitual = lazy(() =>
  import("./components/AlignmentRitual").then((module) => ({
    default: module.AlignmentRitual,
  })),
);
const TheEssence = lazy(() =>
  import("./components/TheEssence").then((module) => ({
    default: module.TheEssence,
  })),
);
const ThePricing = lazy(() =>
  import("./components/ThePricing").then((module) => ({
    default: module.ThePricing,
  })),
);
const Discover = lazy(() =>
  import("./components/Discover").then((m) => ({ default: m.Discover })),
);

const TheGallery = lazy(() =>
  import("./components/TheGallery").then((module) => ({
    default: module.TheGallery,
  })),
);
const TheParlor = lazy(() =>
  import("./components/TheParlor").then((module) => ({
    default: module.TheParlor,
  })),
);
const TheProfile = lazy(() =>
  import("./components/TheProfile").then((module) => ({
    default: module.TheProfile,
  })),
);

const PasswordRecovery = lazy(() =>
  import("./components/PasswordRecovery").then((m) => ({
    default: m.PasswordRecovery,
  })),
);

const BootScreen = ({ message }: { message: string }) => (
  <div className="min-h-dvh bg-midnight text-sandstone flex items-center justify-center p-6">
    <div className="text-center max-w-md">
      <div className="w-10 h-10 border-2 border-sandstone/30 border-t-sandstone rounded-full animate-spin mx-auto mb-4" />
      <BrandLogo className="mx-auto mb-3 h-16 w-16 rounded-full" />
      <p className="text-sm text-sandstone/70">{message}</p>
    </div>
  </div>
);

export default function App() {
  const {
    view,
    sessionReady,
    backendConfigured,
    errorMessage,
    infoMessage,
    showBoostPromo,
    currentProfile,
    initializeApp,
    listenForAuthChanges,
  } = useSanctuaryStore(
    useShallow((state) => ({
      view: state.view,
      sessionReady: state.sessionReady,
      backendConfigured: state.backendConfigured,
      errorMessage: state.errorMessage,
      infoMessage: state.infoMessage,
      showBoostPromo: state.showBoostPromo,
      currentProfile: state.currentProfile,
      initializeApp: state.initializeApp,
      listenForAuthChanges: state.listenForAuthChanges,
    })),
  );

  useEffect(() => {
    listenForAuthChanges();
    void initializeApp();
  }, [initializeApp, listenForAuthChanges]);

  if (!sessionReady) {
    return <BootScreen message="Connecting..." />;
  }

  if (!backendConfigured) {
    return (
      <BootScreen message="Set VITE_SUPABASE_URL and a browser key in frontend/.env.local: VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY." />
    );
  }

  const inApp =
    Boolean(currentProfile?.profileReady) &&
    [
      "gallery",
      "discover",
      "likes",
      "saved",
      "parlor",
      "profile",
      "pricing",
    ].includes(view);

  return (
    // reducedMotion="user" makes Framer Motion honour the OS setting, which the
    // CSS media query alone cannot do for JS-driven animation.
    <MotionConfig reducedMotion="user">
      {/* Errors and payment progress are announced here so they survive view
          changes, e.g. while the Paystack webhook is still pending. */}
      <div aria-live="polite" role="status">
        {errorMessage && (
          <div className="fixed top-4 left-1/2 z-[100] max-w-[90vw] -translate-x-1/2 rounded-full bg-red-900 px-5 py-3 text-center text-xs text-white shadow-xl">
            {errorMessage}
          </div>
        )}

        {!errorMessage && infoMessage && (
          <div className="fixed top-4 left-1/2 z-[100] max-w-[90vw] -translate-x-1/2 rounded-full bg-midnight px-5 py-3 text-center text-xs text-sandstone shadow-xl">
            {infoMessage}
          </div>
        )}
      </div>

      {currentProfile && <MemberNotifications />}
      {inApp && <AppNavigation />}
      <div className={inApp ? "app-content" : ""}>
        <Suspense fallback={<BootScreen message="Opening Niwangu..." />}>
          <AnimatePresence mode="wait">
            {view === "home" && <SanctuaryGate key="home" />}
            {view === "auth" && <TheKeys key="auth" />}
            {view === "register" && <TheRegistration key="register" />}
            {view === "ritual" && <AlignmentRitual key="ritual" />}
            {view === "essence" && <TheEssence key="essence" />}
            {view === "pricing" && <ThePricing key="pricing" />}
            {view === "recovery" && <PasswordRecovery key="recovery" />}
            {view === "likes" && <TheGallery key="likes" section="likes" />}
            {view === "saved" && <TheGallery key="saved" section="saved" />}
            {view === "gallery" && (
              <TheGallery key="gallery" viewMode="focus" />
            )}
            {view === "discover" && <Discover key="discover" />}
            {view === "parlor" && <TheParlor key="parlor" />}
            {view === "profile" && <TheProfile key="profile" />}
          </AnimatePresence>
        </Suspense>
      </div>

      {/* Independent of the view switch above so it can appear over gallery,
          parlor, or profile alike, and survives view changes while open. */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {showBoostPromo && <BoostPromoModal key="boost-promo" />}
        </AnimatePresence>
      </Suspense>
    </MotionConfig>
  );
}
