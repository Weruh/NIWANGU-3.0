import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from './store';
import { SanctuaryGate } from './components/SanctuaryGate';
import { TheKeys } from './components/TheKeys';
import { TheRegistration } from './components/TheRegistration';
import { AlignmentRitual } from './components/AlignmentRitual';
import { TheEssence } from './components/TheEssence';
import { TheGallery } from './components/TheGallery';
import { TheParlor } from './components/TheParlor';

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

      <AnimatePresence mode="wait">
        {view === 'home' && <SanctuaryGate key="home" />}
        {view === 'auth' && <TheKeys key="auth" />}
        {view === 'register' && <TheRegistration key="register" />}
        {view === 'ritual' && <AlignmentRitual key="ritual" />}
        {view === 'essence' && <TheEssence key="essence" />}
        {view === 'gallery' && <TheGallery key="gallery" />}
        {view === 'parlor' && <TheParlor key="parlor" />}
      </AnimatePresence>
    </>
  );
}
