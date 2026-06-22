import { type FC } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Check, CreditCard, HeartHandshake } from 'lucide-react';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import type { PricingPlan } from '../types';

const plans: Array<{
  id: PricingPlan;
  name: string;
  price: string;
  summary: string;
  points: string[];
  cta: string;
}> = [
  {
    id: 'free',
    name: 'Free',
    price: '0 KSH',
    summary: 'Start with a small daily set of profiles.',
    points: ['5 profile views every 24 hours', 'Standard matching gallery', 'No payment needed'],
    cta: 'Choose Free',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '2000 KSH',
    summary: 'Unlock a focused set of partner matches.',
    points: ['Keep swiping after the free limit', 'Parlor access while the free window is locked', 'One-time simulated M-Pesa unlock'],
    cta: 'Choose Premium',
  },
];

export const ThePricing: FC = () => {
  const { choosePricingPlan, isBusy } = useSanctuaryStore(useShallow((state) => ({
    choosePricingPlan: state.choosePricingPlan,
    isBusy: state.isBusy,
  })));

  return (
    <motion.div
      className="min-h-screen bg-sandstone p-6 text-midnight"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col justify-center">
        <div className="mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-sage">Images uploaded</p>
          <h2 className="mb-3 font-serif text-4xl">Choose Your Access</h2>
          <p className="text-midnight/70">
            Pick how you want to enter the gallery. Your choice is saved before your profile becomes visible.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => {
            const isPremium = plan.id === 'premium';
            const Icon = isPremium ? CreditCard : HeartHandshake;

            return (
              <section
                key={plan.id}
                className={`rounded-lg border p-6 shadow-sm ${
                  isPremium
                    ? 'border-sage bg-midnight text-sandstone'
                    : 'border-midnight/15 bg-white/45 text-midnight'
                }`}
              >
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-3xl">{plan.name}</h3>
                    <p className={isPremium ? 'text-sandstone/70' : 'text-midnight/65'}>{plan.summary}</p>
                  </div>
                  <div className={isPremium ? 'rounded-full bg-sage p-3 text-white' : 'rounded-full bg-midnight/10 p-3 text-midnight'}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>

                <p className="mb-6 font-serif text-5xl">{plan.price}</p>

                <div className="mb-8 space-y-3">
                  {plan.points.map((point) => (
                    <div key={point} className="flex items-center gap-3 text-sm">
                      <Check className={`h-4 w-4 ${isPremium ? 'text-sage' : 'text-midnight'}`} />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>

                <Button
                  fullWidth
                  disabled={isBusy}
                  onClick={() => {
                    void choosePricingPlan(plan.id);
                  }}
                  className={isPremium ? 'bg-sage text-white hover:bg-[#D81B60]' : ''}
                  variant={isPremium ? 'primary' : 'outline'}
                >
                  {isBusy ? 'Saving choice...' : plan.cta}
                </Button>
              </section>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
