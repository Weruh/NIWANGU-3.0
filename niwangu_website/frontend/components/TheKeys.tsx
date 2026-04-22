import { useState, type FC, type FormEvent } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { ArrowLeft } from 'lucide-react';

export const TheKeys: FC = () => {
  const { setView, signIn, isBusy, infoMessage, clearMessages } = useSanctuaryStore(useShallow((state) => ({
    setView: state.setView,
    signIn: state.signIn,
    isBusy: state.isBusy,
    infoMessage: state.infoMessage,
    clearMessages: state.clearMessages,
  })));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const formControls = useAnimation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      setError('Enter your email and password.');
      await formControls.start({
        x: [0, -10, 10, -8, 8, -4, 4, 0],
        transition: { duration: 0.4 },
      });
      return;
    }

    setError('');
    clearMessages();
    await signIn(normalizedEmail, normalizedPassword);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="min-h-screen bg-sandstone flex flex-col p-6"
    >
      <button
        onClick={() => {
          clearMessages();
          setView('home');
        }}
        className="self-start p-2 text-midnight/60 hover:text-midnight transition-colors"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <h2 className="font-serif text-4xl text-midnight mb-2">The Keys</h2>
        <p className="text-midnight/70 mb-10 font-light">Sign in with your Supabase account.</p>

        <motion.form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="flex flex-col gap-6"
          animate={formControls}
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-midnight/80">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-midnight/80">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="********"
            />
          </div>

          {infoMessage && <p className="text-sm text-sage">{infoMessage}</p>}
          {error && <p className="text-sm text-red-800">{error}</p>}

          <Button type="submit" className="mt-4" disabled={isBusy}>
            {isBusy ? 'Entering...' : 'Enter Sanctuary'}
          </Button>
        </motion.form>
      </div>
    </motion.div>
  );
};
