import { useState, type FC, type FormEvent } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { ArrowLeft } from 'lucide-react';

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
  const [error, setError] = useState('');
  const formControls = useAnimation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const parsedAge = Number(age);

    const locationParts = location.split(',').map((part) => part.trim()).filter(Boolean);
    const hasTownAndCountry = locationParts.length >= 2;

    const isValid =
      normalizedName.length > 1 &&
      normalizedEmail.length > 3 &&
      normalizedPassword.length >= 6 &&
      (gender === 'female' || gender === 'male') &&
      hasTownAndCountry &&
      Number.isFinite(parsedAge) &&
      parsedAge >= 18;

    if (!isValid) {
      setError(
        'Please complete all fields. Use "Town, Country" for location. Age must be 18+ and password at least 6 characters.',
      );
      await formControls.start({
        x: [0, -10, 10, -8, 8, -4, 4, 0],
        transition: { duration: 0.4 },
      });
      return;
    }

    setError('');
    clearMessages();
    await register({
      fullName: normalizedName,
      age: parsedAge,
      gender: gender as 'female' | 'male',
      location: location.trim(),
      email: normalizedEmail,
      password: normalizedPassword,
    });
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
        <h2 className="font-serif text-4xl text-midnight mb-2">Begin Journey</h2>
        <p className="text-midnight/70 mb-10 font-light">Create your sanctuary profile with Supabase Auth.</p>

        <motion.form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="flex flex-col gap-6"
          animate={formControls}
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-midnight/80">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (error) setError('');
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="Your full name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-midnight/80">Age</label>
            <input
              type="number"
              inputMode="numeric"
              min={18}
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
                if (error) setError('');
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="18+"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-midnight/80">Gender</label>
            <select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                if (error) setError('');
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
            >
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-midnight/80">Location (Town, Country)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                if (error) setError('');
              }}
              className="bg-transparent border-b border-midnight/30 py-2 focus:outline-none focus:border-sage text-midnight transition-colors"
              placeholder="Town, Country"
            />
          </div>

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

          {error && <p className="text-sm text-red-800">{error}</p>}

          <Button type="submit" className="mt-2" disabled={isBusy}>
            {isBusy ? 'Creating account...' : 'Continue to Rituals'}
          </Button>
        </motion.form>
      </div>
    </motion.div>
  );
};
