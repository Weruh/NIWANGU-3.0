import type { FC } from 'react';
import { motion } from 'framer-motion';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';

const NiwanguLogo = () => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className="w-24 h-24 text-white mb-6 opacity-95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
  >
    {/* Abstract elegant shape combining a heart and a leaf */}
    <path 
      d="M50 92C50 92 15 70 15 40C15 22 28 12 42 16C48 17.5 50 25 50 25C50 25 52 17.5 58 16C72 12 85 22 85 40C85 70 50 92 50 92Z" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M50 25Q48 50 35 65" 
      stroke="currentColor" 
      strokeWidth="1" 
      strokeLinecap="round"
    />
    <path 
      d="M50 45Q60 40 65 35" 
      stroke="currentColor" 
      strokeWidth="1" 
      strokeLinecap="round"
    />
  </svg>
);

export const SanctuaryGate: FC = () => {
  const setView = useSanctuaryStore((state) => state.setView);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1624228652368-1cae5a2cf47c?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" 
          alt="Black couple sharing a moment" 
          className="w-full h-full object-cover opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-lg">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8 flex flex-col items-center rounded-3xl bg-black/20 px-8 py-6 backdrop-blur-[2px]"
        >
          <NiwanguLogo />
          <h1 className="font-serif text-6xl text-white mb-2 drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)]">Niwangu</h1>
          <p className="text-white/90 font-sans tracking-widest uppercase text-sm drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">Love, with Intention.</p>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-col gap-4 w-full"
        >
          <Button variant="primary" fullWidth onClick={() => setView('register')}>
            Begin Journey
          </Button>
          <Button
            variant="outline"
            fullWidth
            onClick={() => setView('auth')}
            className="border-white text-white bg-black/15 backdrop-blur-sm hover:bg-white hover:text-midnight"
          >
            Enter Sanctuary
          </Button>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-xs text-white/85 font-sans drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
        >
          A space for slow, meaningful connection.
        </motion.p>
      </div>
    </motion.div>
  );
};
