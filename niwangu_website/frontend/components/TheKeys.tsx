import { useState, type FC, type FormEvent } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { requestPasswordReset } from '../lib/api';
import { ArrowLeft } from 'lucide-react';

export const TheKeys: FC = () => {
  const { setView, signIn, isBusy, clearMessages } = useSanctuaryStore(useShallow((state) => ({
    setView: state.setView,
    signIn: state.signIn,
    isBusy: state.isBusy,
    clearMessages: state.clearMessages,
  })));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const formControls = useAnimation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;

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
      className="min-h-dvh bg-sandstone flex flex-col p-6"
    >
      <button aria-label="Return to homepage"
        onClick={() => {
          clearMessages();
          setView('home');
        }}
        className="self-start p-2 text-midnight/80 hover:text-midnight transition-colors"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <h2 className="font-serif text-4xl text-midnight mb-2">Welcome back</h2>
        <p className="text-midnight/80 mb-10 font-light">Sign in to continue your connections.</p>

        <motion.form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="flex flex-col gap-6"
          animate={formControls}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="signin-email" className="text-sm font-medium text-midnight/80">Email</label>
            <input
              id="signin-email" autoComplete="email" required type="email"
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
            <label htmlFor="signin-password" className="text-sm font-medium text-midnight/80">Password</label>
            <input
              id="signin-password" autoComplete="current-password" required type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="********"
            />
          </div>

          <button type="button" className="min-h-11 text-left text-sm text-sageDeep underline" onClick={async()=>{if(!email.trim()){setError('Enter your email address first.');return;}try{await requestPasswordReset(email.trim().toLowerCase());useSanctuaryStore.setState({infoMessage:'If an account exists, a recovery link will arrive in your email.'});setError('');}catch(e){setError(e instanceof Error?e.message:'Unable to send recovery email.');}}}>Forgot password?</button>
          {/* infoMessage is rendered globally in App.tsx. */}
          {error && <p className="text-sm text-red-800">{error}</p>}

          <Button type="submit" className="mt-4" disabled={isBusy}>
            {isBusy ? 'Entering...' : 'Sign in'}
          </Button>
        </motion.form>
      </div>
    </motion.div>
  );
};
