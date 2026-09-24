import { useEffect, useRef, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { Check, Heart, X, Zap } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu';
import { OptimizedImage } from './OptimizedImage';
import { optimizeImageUrl } from '../lib/images';

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const TheGallery: FC = () => {
  const {
    galleryProfiles,
    galleryLoading,
    galleryLoaded,
    profileViewsUsed,
    dailyProfileViews,
    paymentRequired,
    isPremium,
    boostCredits,
    boostActiveUntil,
    activateBoost,
    swipeProfile,
    loadGallery,
    activeChats,
    setView,
  } = useSanctuaryStore(useShallow((state) => ({
    galleryProfiles: state.galleryProfiles,
    galleryLoading: state.galleryLoading,
    galleryLoaded: state.galleryLoaded,
    profileViewsUsed: state.profileViewsUsed,
    dailyProfileViews: state.dailyProfileViews,
    paymentRequired: state.paymentRequired,
    isPremium: state.isPremium,
    boostCredits: state.boostCredits,
    boostActiveUntil: state.boostActiveUntil,
    activateBoost: state.activateBoost,
    swipeProfile: state.swipeProfile,
    loadGallery: state.loadGallery,
    activeChats: state.activeChats,
    setView: state.setView,
  })));

  // boost_active_until is never reset to null server-side on expiry — a past
  // timestamp means "no boost," so this ticks down to 0 and then the pill
  // switches views on its own, no write-back needed.
  const [boostRemainingMs, setBoostRemainingMs] = useState(0);

  useEffect(() => {
    if (!boostActiveUntil) {
      setBoostRemainingMs(0);
      return;
    }

    const target = new Date(boostActiveUntil).getTime();
    const tick = () => setBoostRemainingMs(Math.max(0, target - Date.now()));
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [boostActiveUntil]);

  const boostIsActive = boostRemainingMs > 0;

  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [blurAmount, setBlurAmount] = useState(20);
  const [matchedName, setMatchedName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const paywalled = paymentRequired && !isPremium;

  // Keyed on "have we tried yet", not "is the list empty". Keying on the length
  // meant a legitimately empty gallery re-triggered the fetch forever, pinning
  // the loading screen on and wiping the error toast on every pass. Restocking
  // after swipes is handled by swipeProfile.
  useEffect(() => {
    if (!galleryLoaded && !galleryLoading) {
      void loadGallery();
    }
  }, [galleryLoaded, galleryLoading, loadGallery]);

  // Navigating is a side effect, so it belongs here rather than in the render
  // body where it triggered a React update-during-render warning.
  useEffect(() => {
    if (paywalled) {
      setView('pricing');
    }
  }, [paywalled, setView]);

  useEffect(() => {
    if (currentProfileIndex >= galleryProfiles.length) {
      setCurrentProfileIndex(0);
    }
  }, [currentProfileIndex, galleryProfiles.length]);

  const currentProfile = galleryProfiles[currentProfileIndex] ?? null;
  const currentPhoto = currentProfile?.photos[0] ?? null;

  useEffect(() => {
    const nextPhotos = galleryProfiles
      .slice(currentProfileIndex + 1, currentProfileIndex + 3)
      .map((profile) => profile.photos[0])
      .filter(Boolean);

    nextPhotos.forEach((photoUrl) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = optimizeImageUrl(photoUrl, 960);
    });
  }, [currentProfileIndex, galleryProfiles]);

  const resetCardState = () => {
    setBlurAmount(20);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const scrollableDistance = Math.max(scrollHeight - clientHeight, 1);
    const percentage = Math.min(1, Math.max(0, scrollTop / scrollableDistance));
    const newBlur = Math.max(0, 20 - percentage * 25);
    setBlurAmount(newBlur);
  };

  const handleAction = async (action: 'like' | 'pass') => {
    if (!currentProfile) {
      return;
    }

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    const result = await swipeProfile(currentProfile.id, action);

    if (result.matched) {
      setMatchedName(currentProfile.name);
      setTimeout(() => setMatchedName(''), 2800);
    }

    resetCardState();
  };

  if (galleryLoading && !currentProfile) {
    return (
      <div className="h-dvh bg-midnight text-sandstone flex items-center justify-center">
        <p className="text-sm tracking-widest uppercase">Loading intentional connections...</p>
      </div>
    );
  }

  if (!currentProfile) {
    // The effect above is already navigating to the pricing view.
    if (paywalled) {
      return null;
    }

    return (
      <div className="h-dvh bg-midnight text-sandstone flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-serif text-4xl mb-4">The Gallery Is Quiet</h2>
        <p className="text-sandstone/70 max-w-md mb-8">
          You have reached the end of the current candidate set. Return shortly as more members join.
        </p>
        <Button
          onClick={() => {
            void loadGallery();
          }}
        >
          Refresh Gallery
        </Button>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-sandstone relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <h1 className="font-serif text-xl text-sandstone drop-shadow-md">Niwangu</h1>
        <div className="flex items-center gap-2 pointer-events-auto">
          {boostIsActive ? (
            <div className="flex h-9 items-center gap-1.5 rounded-full bg-sageDeep px-3.5 text-xs font-semibold text-white shadow-md">
              <Zap className="h-3.5 w-3.5 animate-pulse" fill="currentColor" aria-hidden="true" />
              <span className="tabular-nums">{formatCountdown(boostRemainingMs)}</span>
            </div>
          ) : boostCredits > 0 ? (
            <button
              type="button"
              onClick={() => void activateBoost()}
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/40 bg-sandstone/10 px-3.5 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-sandstone/20"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Boost ×{boostCredits}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => useSanctuaryStore.setState({ showBoostPromo: true })}
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/20 bg-sandstone/10 px-3.5 text-xs font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-sandstone/20"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Get Boost
            </button>
          )}
          <ProfileMenu light onOpenPaywall={() => setView('pricing')} />
        </div>
      </div>

      <AnimatePresence>
        {matchedName && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-sageDeep px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-xl"
          >
            Match with {matchedName}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full h-full">
        <OptimizedImage
          key={currentProfile.id}
          src={currentPhoto}
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
          srcWidth={1280}
          srcSetWidths={[640, 960, 1280]}
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover transition-all duration-100 ease-out"
          style={{
            filter: `blur(${blurAmount}px) brightness(${0.7 + (1 - blurAmount / 20) * 0.3})`,
            transform: 'scale(1.04)',
          }}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto no-scrollbar snap-y snap-mandatory"
        >
          <div className="h-[60dvh] w-full snap-start" />

          <div className="min-h-[60dvh] bg-gradient-to-t from-midnight/70 via-midnight/45 to-transparent pt-20 pb-32 px-6 flex flex-col justify-end text-sandstone snap-start">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="max-w-md mx-auto w-full">
              <span className="inline-block px-3 py-1 border border-sandstone/30 rounded-full text-xs mb-4 uppercase tracking-widest">
                {currentProfile.ritualAnswers[1]}
              </span>

              <h2 className="font-serif text-5xl mb-2">
                {currentProfile.name}, {currentProfile.age}
              </h2>
              <p className="text-sandstone/70 mb-8 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sage" />
                {currentProfile.distance}
              </p>

              {/* The payoff for answering the Ritual: say plainly why this
                  person was surfaced, instead of leaving it to chance. */}
              {currentProfile.alignmentReasons.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs uppercase tracking-widest text-sageLight mb-3">
                    Why you align
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {currentProfile.alignmentReasons.map((reason) => (
                      <li
                        key={reason}
                        className="inline-flex items-center gap-1.5 rounded-full border border-sage/40 bg-sage/10 px-3 py-1.5 text-xs font-medium text-sandstone backdrop-blur-sm"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0 text-sageLight" aria-hidden="true" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-8 mb-12">
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-sageLight mb-2">The Boundary</h3>
                  <p className="font-serif text-xl leading-relaxed text-sandstone/90 border-l-2 border-sage pl-4 italic">
                    "{currentProfile.boundary}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                    <h4 className="text-[10px] uppercase text-sandstone/70 mb-1">Core Value</h4>
                    <p className="font-medium">{currentProfile.ritualAnswers[6]}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                    <h4 className="text-[10px] uppercase text-sandstone/70 mb-1">Intent</h4>
                    <p className="font-medium">{currentProfile.ritualAnswers[10]}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 z-40 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - blurAmount / 5) }}
        >
          <button
            type="button"
            onClick={() => {
              void handleAction('pass');
            }}
            aria-label={`Pass on ${currentProfile.name}`}
            className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-red-500/20 hover:border-red-500 hover:text-red-100 transition-all pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="w-8 h-8" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              void handleAction('like');
            }}
            aria-label={`Like ${currentProfile.name}`}
            className="w-16 h-16 rounded-full bg-sageDeep text-white shadow-lg shadow-sageDeep/30 flex items-center justify-center hover:scale-110 transition-all pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Heart className="w-8 h-8 fill-current" aria-hidden="true" />
          </button>
        </motion.div>

        <motion.div
          className="absolute bottom-10 left-0 right-0 text-center pointer-events-none text-white/50 text-xs animate-bounce"
          style={{ opacity: Math.min(1, blurAmount / 10) }}
        >
          Scroll to Reveal
        </motion.div>
      </div>
    </div>
  );
};
