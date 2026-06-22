import { useEffect, useRef, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { Heart, X, Lock } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu';
import { OptimizedImage } from './OptimizedImage';
import { optimizeImageUrl } from '../lib/images';

export const TheGallery: FC = () => {
  const {
    galleryProfiles,
    galleryLoading,
    swipedCount,
    dailySwipes,
    isPremium,
    unlockPremium,
    swipeProfile,
    loadGallery,
    activeChats,
    setView,
  } = useSanctuaryStore(useShallow((state) => ({
    galleryProfiles: state.galleryProfiles,
    galleryLoading: state.galleryLoading,
    swipedCount: state.swipedCount,
    dailySwipes: state.dailySwipes,
    isPremium: state.isPremium,
    unlockPremium: state.unlockPremium,
    swipeProfile: state.swipeProfile,
    loadGallery: state.loadGallery,
    activeChats: state.activeChats,
    setView: state.setView,
  })));

  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [blurAmount, setBlurAmount] = useState(20);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [matchedName, setMatchedName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (galleryProfiles.length === 0) {
      void loadGallery();
    }
  }, [galleryProfiles.length, loadGallery]);

  useEffect(() => {
    if (currentProfileIndex >= galleryProfiles.length) {
      setCurrentProfileIndex(0);
    }
  }, [currentProfileIndex, galleryProfiles.length]);

  const currentProfile = galleryProfiles[currentProfileIndex] ?? null;
  const currentPhoto = currentProfile?.photos[0] ?? null;
  const isLimitReached = !isPremium && swipedCount >= dailySwipes;

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

    if (isLimitReached) {
      setShowPaywall(true);
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

  const handlePayment = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
      void unlockPremium().finally(() => {
        setPaymentProcessing(false);
        setShowPaywall(false);
      });
    }, 1800);
  };

  if (galleryLoading && !currentProfile) {
    return (
      <div className="h-screen bg-midnight text-sandstone flex items-center justify-center">
        <p className="text-sm tracking-widest uppercase">Loading intentional connections...</p>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="h-screen bg-midnight text-sandstone flex flex-col items-center justify-center p-6 text-center">
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
    <div className="h-screen bg-sandstone relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <h1 className="font-serif text-xl text-sandstone drop-shadow-md">Niwangu</h1>
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="rounded-full border border-white/20 bg-sandstone/10 px-4 py-2 text-xs font-medium text-white backdrop-blur-md">
            {isPremium ? 'Premium: 5 partner matches' : `${Math.max(0, dailySwipes - swipedCount)} swipes left`}
          </div>
          <button
            onClick={() => setView('parlor')}
            className="bg-sandstone/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full text-xs font-medium hover:bg-sandstone/20 transition-all"
          >
            Parlor ({activeChats.length})
          </button>
          <ProfileMenu light />
        </div>
      </div>

      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-midnight/90 p-6"
          >
            <div className="bg-sandstone rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
              <Lock className="w-12 h-12 text-midnight mx-auto mb-4" />
              <h2 className="font-serif text-2xl text-midnight mb-2">Commitment Pass</h2>
              <p className="text-midnight/70 mb-6 text-sm">
                You have reached your 5 free swipes for today. Upgrade for 2000 KSH to receive 5 profiles matched to the partner you want.
              </p>
              <Button
                onClick={handlePayment}
                fullWidth
                disabled={paymentProcessing}
                className="bg-[#4CAF50] hover:bg-[#43a047] text-white"
              >
                {paymentProcessing ? 'Processing STK Push...' : 'Unlock via M-Pesa'}
              </Button>
              <button
                onClick={() => setShowPaywall(false)}
                className="mt-4 text-xs text-midnight/50 hover:text-midnight underline"
              >
                Return to Gallery
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {matchedName && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="absolute top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-sage px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white shadow-xl"
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
          <div className="h-[60vh] w-full snap-start" />

          <div className="min-h-[60vh] bg-gradient-to-t from-midnight/70 via-midnight/45 to-transparent pt-20 pb-32 px-6 flex flex-col justify-end text-sandstone snap-start">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="max-w-md mx-auto w-full">
              <span className="inline-block px-3 py-1 border border-sandstone/30 rounded-full text-xs mb-4 uppercase tracking-widest">
                {currentProfile.ritualAnswers[1]}
              </span>

              <h2 className="font-serif text-5xl mb-2">
                {currentProfile.name}, {currentProfile.age}
              </h2>
              <p className="text-sandstone/60 mb-8 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sage" />
                {currentProfile.distance}
              </p>

              <div className="space-y-8 mb-12">
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-sage mb-2">The Boundary</h3>
                  <p className="font-serif text-xl leading-relaxed text-sandstone/90 border-l-2 border-sage pl-4 italic">
                    "{currentProfile.boundary}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                    <h4 className="text-[10px] uppercase text-sandstone/50 mb-1">Core Value</h4>
                    <p className="font-medium">{currentProfile.ritualAnswers[6]}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg backdrop-blur-sm">
                    <h4 className="text-[10px] uppercase text-sandstone/50 mb-1">Intent</h4>
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
            onClick={() => {
              void handleAction('pass');
            }}
            className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-red-500/20 hover:border-red-500 hover:text-red-100 transition-all pointer-events-auto"
          >
            <X className="w-8 h-8" />
          </button>
          <button
            onClick={() => {
              void handleAction('like');
            }}
            className="w-16 h-16 rounded-full bg-sage text-white shadow-lg shadow-sage/30 flex items-center justify-center hover:scale-110 transition-all pointer-events-auto"
          >
            <Heart className="w-8 h-8 fill-current" />
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
