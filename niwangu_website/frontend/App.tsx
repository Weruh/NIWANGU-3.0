import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from './store';

const SanctuaryGate = lazy(() => import('./components/SanctuaryGate').then((module) => ({ default: module.SanctuaryGate })));
const TheKeys = lazy(() => import('./components/TheKeys').then((module) => ({ default: module.TheKeys })));
const TheRegistration = lazy(() => import('./components/TheRegistration').then((module) => ({ default: module.TheRegistration })));
const AlignmentRitual = lazy(() => import('./components/AlignmentRitual').then((module) => ({ default: module.AlignmentRitual })));
const TheEssence = lazy(() => import('./components/TheEssence').then((module) => ({ default: module.TheEssence })));
const ThePricing = lazy(() => import('./components/ThePricing').then((module) => ({ default: module.ThePricing })));
const TheGallery = lazy(() => import('./components/TheGallery').then((module) => ({ default: module.TheGallery })));
const TheParlor = lazy(() => import('./components/TheParlor').then((module) => ({ default: module.TheParlor })));
const TheProfile = lazy(() => import('./components/TheProfile').then((module) => ({ default: module.TheProfile })));

const BootScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-midnight text-sandstone flex items-center justify-center p-6">
    <div className="text-center max-w-md">
      <div className="w-10 h-10 border-2 border-sandstone/30 border-t-sandstone rounded-full animate-spin mx-auto mb-4" />
      <p className="font-serif text-2xl mb-2">Niwangu</p>
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
    initializeApp,
    listenForAuthChanges,
  } = useSanctuaryStore(useShallow((state) => ({
    view: state.view,
    sessionReady: state.sessionReady,
    backendConfigured: state.backendConfigured,
    errorMessage: state.errorMessage,
    initializeApp: state.initializeApp,
    listenForAuthChanges: state.listenForAuthChanges,
  })));

  useEffect(() => {
    listenForAuthChanges();
    void initializeApp();
  }, [initializeApp, listenForAuthChanges]);

  if (!sessionReady) {
    return <BootScreen message="Connecting to your sanctuary..." />;
  }

  if (!backendConfigured) {
    return (
      <BootScreen message="Set VITE_SUPABASE_URL and a browser key in frontend/.env.local: VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY." />
    );
  }

  return (
    <>
      {errorMessage && (
        <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-red-900 px-5 py-3 text-xs text-white shadow-xl">
          {errorMessage}
        </div>
      )}

      <Suspense fallback={<BootScreen message="Opening Niwangu..." />}>
        <AnimatePresence mode="wait">
          {view === 'home' && <SanctuaryGate key="home" />}
          {view === 'auth' && <TheKeys key="auth" />}
          {view === 'register' && <TheRegistration key="register" />}
          {view === 'ritual' && <AlignmentRitual key="ritual" />}
          {view === 'essence' && <TheEssence key="essence" />}
          {view === 'pricing' && <ThePricing key="pricing" />}
          {view === 'gallery' && <TheGallery key="gallery" />}
          {view === 'parlor' && <TheParlor key="parlor" />}
          {view === 'profile' && <TheProfile key="profile" />}
        </AnimatePresence>
      </Suspense>
    </>
  );
}
