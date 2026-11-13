import { useState, type FC, type FormEvent } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { ArrowLeft } from 'lucide-react';
import { TOWN_OPTIONS } from '../lib/towns';

export const TheRegistration: FC = () => {
  const { setView, register, isBusy, clearMessages } = useSanctuaryStore(useShallow((state) => ({
    setView: state.setView,
    register: state.register,
    isBusy: state.isBusy,
    clearMessages: state.clearMessages,
  })));
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const formControls = useAnimation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;
    const parsedAge = Number(age);
    const validationErrors = [
      !acceptedTerms ? 'Read and accept the Terms of Service and Community Guidelines to continue.' : '',
      normalizedName.length < 2 ? 'Full name must be at least 2 characters.' : '',
      !Number.isFinite(parsedAge) || parsedAge < 18 ? 'Age must be 18 or older.' : '',
      gender !== 'female' && gender !== 'male' ? 'Select your gender.' : '',
      !location ? 'Select your town.' : '',
      normalizedEmail.length < 4 || !normalizedEmail.includes('@') ? 'Enter a valid email address.' : '',
      normalizedPassword.length < 6 ? 'Password must be at least 6 characters.' : '',
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      await formControls.start({
        x: [0, -10, 10, -8, 8, -4, 4, 0],
        transition: { duration: 0.4 },
      });
      return;
    }

    setErrors([]);
    clearMessages();
    await register({
      fullName: normalizedName,
      age: parsedAge,
      gender: gender as 'female' | 'male',
      location: location.trim(),
      email: normalizedEmail,
      password: normalizedPassword,
      acceptedTerms,
    });
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
        <h2 className="font-serif text-4xl text-midnight mb-2">Begin Journey</h2>
        <p className="text-midnight/80 mb-10 font-light">Tell us a little about yourself to begin.</p>

        <motion.form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="flex flex-col gap-6"
          animate={formControls}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="register-name" className="text-sm font-medium text-midnight/80">Full Name</label>
            <input
              type="text"
              id="register-name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.length) setErrors([]);
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="Your full name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-age" className="text-sm font-medium text-midnight/80">Age</label>
            <input
              type="number"
              inputMode="numeric"
              min={18}
              id="register-age"
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
                if (errors.length) setErrors([]);
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="18+"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-gender" className="text-sm font-medium text-midnight/80">Gender</label>
            <select
              id="register-gender"
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                if (errors.length) setErrors([]);
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
            >
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-town" className="text-sm font-medium text-midnight/80">Town</label>
            <select
              id="register-town"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                if (errors.length) setErrors([]);
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
            >
              <option value="">Select your town</option>
              {TOWN_OPTIONS.map((town) => (
                <option key={town} value={town}>
                  {town}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-email" className="text-sm font-medium text-midnight/80">Email</label>
            <input
              type="email"
              id="register-email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.length) setErrors([]);
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-password" className="text-sm font-medium text-midnight/80">Password</label>
            <input
              type="password"
              id="register-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.length) setErrors([]);
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="********"
            />
          </div>

          <div className="space-y-4 border-t border-midnight/15 pt-5 text-sm leading-6">
            <p id="privacy-notice" className="text-midnight/80">Read our <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-sageDeep">Privacy Policy (opens in a new tab)</a> to understand how your profile, Ritual answers, photos, and messages are used.</p>
            <div className="flex items-start gap-3">
              <input id="accept-terms" type="checkbox" required checked={acceptedTerms} onChange={(event) => { setAcceptedTerms(event.target.checked); if (errors.length) setErrors([]); }} aria-describedby="privacy-notice" className="mt-1 h-5 w-5 shrink-0 accent-sageDeep" />
              <label htmlFor="accept-terms">I am at least 18 and agree to the <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-sageDeep">Terms of Service</a> and <a href="/community-guidelines" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-sageDeep">Community Guidelines</a> (links open in new tabs).</label>
            </div>
          </div>

          {errors.length > 0 && (
            <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-red-800">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          <Button type="submit" className="mt-2" disabled={isBusy}>
            {isBusy ? 'Creating account...' : 'Continue to Rituals'}
          </Button>
        </motion.form>
      </div>
    </motion.div>
  );
};
