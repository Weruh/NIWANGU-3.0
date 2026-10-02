import { useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Diamond,
  Eye,
  Heart,
  Phone,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { useSanctuaryStore } from "../store";
import { Button } from "./Button";
import { Modal } from "./Modal";

type Step = "promo" | "checkout";

const FEATURES = [
  { icon: Zap, label: "2 boosts", subtext: "for KSh 59" },
  { icon: Eye, label: "30 minutes", subtext: "of extra visibility each" },
  { icon: Heart, label: "Activate anytime", subtext: "credits never expire" },
];

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.5 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

/** A light streak that sweeps across its parent on a loop. Parent needs `relative overflow-hidden`. */
const Shimmer: FC<{ delay?: number }> = ({ delay = 0 }) => (
  <motion.span
    aria-hidden="true"
    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
    initial={{ x: "-120%" }}
    animate={{ x: "320%" }}
    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut", delay }}
  />
);

/**
 * Shown on every login/session-restore once the user reaches the swiping
 * gallery (gated in bootstrapAuthenticatedState) — not during ritual
 * onboarding, where a purchase pitch would interrupt profile setup.
 * Dismissing it is session-only, so it reappears next time by design.
 */
export const BoostPromoModal: FC = () => {
  const {
    boostPack,
    loadBoostPack,
    startBoostPayment,
    dismissBoostPromo,
    isBusy,
    boostPending,
  } = useSanctuaryStore(
    useShallow((state) => ({
      boostPack: state.boostPack,
      loadBoostPack: state.loadBoostPack,
      startBoostPayment: state.startBoostPayment,
      dismissBoostPromo: state.dismissBoostPromo,
      isBusy: state.isBusy,
      boostPending: state.boostPending,
    })),
  );

  const [step, setStep] = useState<Step>("promo");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadBoostPack();
  }, [loadBoostPack]);

  const priceKsh = boostPack?.priceKsh ?? 59;
  const credits = boostPack?.boostCredits ?? 2;

  const handleClose = () => {
    dismissBoostPromo();
  };

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length < 9) {
      setPaymentStatus("Please enter a valid Safaricom number (e.g. 0712345678)");
      return;
    }

    setPaymentStatus("Sending STK Push prompt to your phone...");
    try {
      await startBoostPayment(phoneNumber);
      dismissBoostPromo();
      setPaymentStatus(null);
    } catch (err) {
      setPaymentStatus(err instanceof Error ? err.message : "Payment failed. Please try again.");
    }
  };

  return (
    <Modal
      titleId="boost-promo-title"
      closeLabel="Maybe later"
      initialFocusRef={step === "checkout" ? phoneInputRef : undefined}
      className="max-w-md overflow-hidden border border-midnight/10 text-midnight"
      onClose={handleClose}
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Maybe later"
        className={`absolute top-4 right-4 z-20 p-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          step === "promo"
            ? "text-white hover:bg-black/20 focus-visible:outline-white"
            : "text-midnight/80 hover:text-midnight hover:bg-midnight/5 focus-visible:outline-midnight"
        }`}
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>

      <AnimatePresence mode="wait">
        {step === "promo" ? (
          <motion.div
            key="promo"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* Hero photo fills the top of the card; the content panel's
                elliptical top edge rides up over it to form the scalloped
                seam between photo and copy. */}
            <div className="relative h-60 w-full overflow-hidden">
              <img
                src="/boost-promo-hero.webp"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />

              <div className="absolute bottom-6 right-5 flex items-start gap-1 text-right text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
                <p className="font-serif text-lg italic leading-tight">
                  More
                  <br />
                  Meaningful
                  <br />
                  Connections
                </p>
                <Heart className="-ml-0.5 mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" fill="currentColor" aria-hidden="true" />
              </div>
            </div>

            <div
              className="relative -mt-7 flex flex-col items-center bg-sandstone px-6 pb-6 pt-7 text-center"
              style={{ borderRadius: "50% 50% 0 0 / 28px 28px 0 0" }}
            >
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="inline-flex items-center gap-1 rounded-full bg-sageLight px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sageDeep"
              >
                <Crown className="h-3 w-3" fill="currentColor" aria-hidden="true" />
                Special Offer
              </motion.span>

              <motion.h3
                id="boost-promo-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.3 }}
                className="mt-3 text-2xl font-extrabold tracking-tight text-midnight"
              >
                Get seen <span className="text-sageDeep">first</span>
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.3 }}
                className="mt-2 text-sm text-midnight/70"
              >
                Boost puts your profile in front of more people for 30 minutes
                at a time — no subscription required.
              </motion.p>

              <motion.ul
                className="mt-6 grid w-full grid-cols-3 divide-x divide-midnight/10"
                variants={listVariants}
                initial="hidden"
                animate="show"
              >
                {FEATURES.map(({ icon: Icon, label, subtext }) => (
                  <motion.li key={label} variants={itemVariants} className="flex flex-col items-center px-1.5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sageLight text-sageDeep">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="mt-2 text-sm font-bold text-midnight">{label}</span>
                    <span className="mt-0.5 text-xs leading-tight text-midnight/60">{subtext}</span>
                  </motion.li>
                ))}
              </motion.ul>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="mt-6 flex w-full items-center justify-between gap-3 rounded-2xl bg-sageLight/50 px-4 py-3"
              >
                <div className="text-left">
                  <span className="block text-xl font-extrabold text-sageDeep">
                    KSh {priceKsh.toLocaleString()}
                  </span>
                  <span className="text-xs text-midnight/60">
                    for {credits} boost{credits === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="h-9 w-px shrink-0 bg-midnight/10" aria-hidden="true" />
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-sageDeep shadow-sm">
                  <Diamond className="h-3 w-3" aria-hidden="true" />
                  One-time payment
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="mt-5 w-full space-y-2"
              >
                <Button
                  fullWidth
                  onClick={() => setStep("checkout")}
                  className="relative overflow-hidden !bg-gradient-to-r !from-sage !to-sageDeep py-3.5 font-bold shadow-[0_10px_30px_-8px_rgba(194,24,91,0.6)]"
                >
                  <Shimmer delay={2} />
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  Get Boosted
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full text-center text-xs font-medium text-midnight/60 hover:text-midnight py-1"
                >
                  Maybe later
                </button>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="checkout"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="p-6"
          >
            <button
              type="button"
              onClick={() => setStep("promo")}
              className="mb-4 flex items-center gap-1 text-xs font-medium text-midnight/80 hover:text-midnight"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back
            </button>

            <div className="mb-5">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-midnight/10 px-2 py-0.5 rounded-full text-midnight">
                M-Pesa STK Push Unlock
              </span>
              <h3 className="text-xl font-semibold tracking-tight mt-2">Boost Pack</h3>
              <p className="mt-1 text-sm font-semibold text-emerald-800">
                KSh {priceKsh.toLocaleString()} for {credits} boosts
              </p>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label
                  htmlFor="boost-phone"
                  className="block text-xs font-semibold uppercase tracking-wider text-midnight/80 mb-1.5"
                >
                  Safaricom M-Pesa Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-midnight/80" aria-hidden="true" />
                  <input
                    id="boost-phone"
                    ref={phoneInputRef}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-midnight/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-midnight text-midnight"
                    required
                  />
                </div>
              </div>

              {paymentStatus && (
                <p role="status" className="text-xs font-medium text-midnight/80">
                  {paymentStatus}
                </p>
              )}

              <Button
                type="submit"
                fullWidth
                disabled={isBusy || boostPending}
                className="!bg-emerald-600 hover:!bg-emerald-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
              >
                {isBusy
                  ? "Initiating STK Push..."
                  : boostPending
                    ? "Waiting for M-Pesa confirmation..."
                    : `Pay KSh ${priceKsh.toLocaleString()} via M-Pesa`}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-xs text-midnight/80 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                Secure M-Pesa STK Push via Paystack
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};
