import { Lock } from 'lucide-react';
import { type FC } from 'react';
import { Button } from './Button';

type PaymentWindowProps = {
  amountKsh: number;
  processing: boolean;
  lockedUntil?: string | null;
  onPay: () => void;
  onClose?: () => void;
};

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
  amountKsh,
  processing,
  lockedUntil,
  onPay,
  onClose,
}) => (
  <div className="bg-sandstone rounded-lg p-8 max-w-sm w-full text-center shadow-2xl">
    <Lock className="w-12 h-12 text-midnight mx-auto mb-4" />
    <h2 className="font-serif text-2xl text-midnight mb-2">Commitment Pass</h2>
    <p className="text-midnight/70 mb-6 text-sm">
      You have viewed your 5 free profiles for this 24-hour window. Pay {amountKsh} KSH to keep swiping and access your parlor now.
      {lockedUntil ? ` Free access resets around ${formatLockedUntil(lockedUntil)}.` : ''}
    </p>
    <Button
      onClick={onPay}
      fullWidth
      disabled={processing}
      className="bg-[#4CAF50] hover:bg-[#43a047] text-white"
    >
      {processing ? 'Processing STK Push...' : `Pay ${amountKsh} KSH via M-Pesa`}
    </Button>
    {onClose && (
      <button
        onClick={onClose}
        className="mt-4 text-xs text-midnight/50 hover:text-midnight underline"
      >
        Wait for reset
      </button>
    )}
  </div>
);
