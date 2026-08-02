import { useState, type FC, type FormEvent } from 'react';
import { Lock, Phone, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from './Button';
import type { PricingPlan } from '../types';

type PaymentWindowProps = {
  amountKsh?: number;
  processing: boolean;
  lockedUntil?: string | null;
  onPay: (planId: PricingPlan, phoneNumber: string) => void;
  onClose?: () => void;
};

const PLAN_OPTIONS: Array<{
  id: PricingPlan;
  duration: string;
  priceKsh: number;
  badge?: string;
}> = [
  { id: '7_days', duration: '7 Days', priceKsh: 99, badge: 'Trial' },
  { id: '30_days', duration: '30 Days', priceKsh: 199, badge: 'Recommended' },
  { id: '90_days', duration: '90 Days', priceKsh: 499 },
  { id: '180_days', duration: '180 Days', priceKsh: 999 },
  { id: '365_days', duration: '365 Days', priceKsh: 1799, badge: 'Best Value' },
];

const formatLockedUntil = (lockedUntil?: string | null) => {
  if (!lockedUntil) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(lockedUntil));
};

export const PaymentWindow: FC<PaymentWindowProps> = ({
  processing,
  lockedUntil,
  onPay,
  onClose,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>('30_days');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const currentPlan = PLAN_OPTIONS.find((p) => p.id === selectedPlan) || PLAN_OPTIONS[1];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setPhoneError('Please enter a valid Safaricom phone number (e.g. 0712345678)');
      return;
    }
    setPhoneError('');
    onPay(selectedPlan, phoneNumber);
  };

  return (
    <div className="bg-sandstone border border-midnight/10 rounded-xl p-6 max-w-md w-full text-midnight shadow-2xl relative overflow-hidden">
      <div className="text-center mb-5">
        <div className="inline-flex p-3 rounded-full bg-midnight/5 text-midnight mb-3">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="font-serif text-2xl font-semibold mb-1">Commitment Pass</h2>
        <p className="text-midnight/70 text-xs max-w-xs mx-auto">
          You have viewed your free profiles for this 24-hour window. Choose a pass to keep swiping and unlock Parlor chats.
          {lockedUntil ? ` Free reset: ${formatLockedUntil(lockedUntil)}.` : ''}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-midnight/60 mb-2">
            Select Pass Duration
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PLAN_OPTIONS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-midnight bg-midnight text-sandstone shadow-md scale-[1.02]'
                      : 'border-midnight/15 bg-white/50 text-midnight hover:border-midnight/40'
                  }`}
                >
                  {plan.badge && (
                    <span className={`absolute -top-2 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-sandstone text-midnight' : 'bg-midnight text-sandstone'
                    }`}>
                      {plan.badge}
                    </span>
                  )}
                  <p className="text-xs font-medium opacity-80">{plan.duration}</p>
                  <p className="font-serif text-base font-bold">KSh {plan.priceKsh.toLocaleString()}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-midnight/60 mb-1.5">
            M-Pesa Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-midnight/40">
              <Phone className="w-4 h-4" />
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 0712345678"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-midnight/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-midnight text-midnight"
              required
            />
          </div>
          {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>M-Pesa STK Push:</strong> Clicking below sends an instant payment prompt directly to your phone.
          </span>
        </div>

        <Button
          type="submit"
          fullWidth
          disabled={processing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2"
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending STK Push Prompt...
            </span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Pay KSh {currentPlan.priceKsh.toLocaleString()} via M-Pesa
            </>
          )}
        </Button>
      </form>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-midnight/50 hover:text-midnight underline"
        >
          Wait for free daily reset
        </button>
      )}
    </div>
  );
};
