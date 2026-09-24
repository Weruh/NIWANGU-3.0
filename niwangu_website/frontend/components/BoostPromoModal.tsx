import { useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, Check, Phone, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { useSanctuaryStore } from "../store";
import { Button } from "./Button";
import { Modal } from "./Modal";

type Step = "promo" | "checkout";

const FEATURES = [
  "2 boosts for KSh 59",
  "30 minutes of extra visibility each",
  "Activate whenever you want — credits never expire",
];

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.5 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: "easeOut" } },
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
      className="max-w-md overflow-hidden border border-midnight/10 p-6 text-midnight"
      onClose={handleClose}
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Maybe later"
        className="absolute top-4 right-4 z-10 p-1.5 text-midnight/80 hover:text-midnight rounded-full hover:bg-midnight/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
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
            <div className="flex flex-col items-center text-center">
              {/* Icon badge: spring pop-in, radiating pulse rings, a gentle
                  wiggle once settled, and two small sparkles drifting nearby
                  — reads as a special offer arriving, not a static icon. */}
              <div className="relative flex h-14 w-14 items-center justify-center">
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-sageDeep/50"
                  initial={{ scale: 1, opacity: 0 }}
                  animate={{ scale: [1, 1.9], opacity: [0.55, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
                />
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-sageDeep/50"
                  initial={{ scale: 1, opacity: 0 }}
                  animate={{ scale: [1, 1.9], opacity: [0.55, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 1.5 }}
                />

                <motion.div
                  className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sageDeep to-sage shadow-md"
                  initial={{ scale: 0, rotate: -35 }}
                  animate={{
                    scale: 1,
                    rotate: [0, -8, 8, -4, 0],
                  }}
                  transition={{
                    scale: { type: "spring", stiffness: 260, damping: 14 },
                    rotate: { duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut", delay: 0.6 },
                  }}
                >
                  <Zap className="h-7 w-7 text-white" fill="currentColor" aria-hidden="true" />
                </motion.div>

                <motion.span
                  aria-hidden="true"
                  className="absolute -top-1 -right-2 text-sage"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], y: [0, -4, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut", delay: 0.9 }}
                >
                  <Sparkles className="h-3.5 w-3.5" fill="currentColor" />
                </motion.span>
                <motion.span
                  aria-hidden="true"
                  className="absolute -bottom-1 -left-2 text-sageDeep"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], y: [0, 4, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut", delay: 1.6 }}
                >
                  <Sparkles className="h-3 w-3" fill="currentColor" />
                </motion.span>
              </div>

              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                className="relative mt-4 overflow-hidden rounded-full bg-midnight/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-midnight"
              >
                Special Offer
                <Shimmer delay={0.3} />
              </motion.span>

              <motion.h3
                id="boost-promo-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.3 }}
                className="mt-2 font-serif text-2xl tracking-tight"
              >
                Get seen first
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.3 }}
                className="mt-2 text-sm text-midnight/80"
              >
                Boost puts your profile in front of more people for 30 minutes
                at a time — no subscription required.
              </motion.p>
            </div>

            <motion.ul
              className="mt-5 space-y-2.5"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {FEATURES.map((feature) => (
                <motion.li
                  key={feature}
                  variants={itemVariants}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sageDeep" aria-hidden="true" />
                  <span>{feature}</span>
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                boxShadow: [
                  "0 0 0px rgba(194,24,91,0)",
                  "0 0 16px rgba(194,24,91,0.3)",
                  "0 0 0px rgba(194,24,91,0)",
                ],
              }}
              transition={{
                opacity: { delay: 0.85, duration: 0.3 },
                scale: { delay: 0.85, duration: 0.3 },
                boxShadow: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
              }}
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-midnight/5 px-4 py-3"
            >
              <span className="text-lg font-semibold text-emerald-800">
                KSh {priceKsh.toLocaleString()}
              </span>
              <span className="text-xs text-midnight/80">
                for {credits} boost{credits === 1 ? "" : "s"}
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95, duration: 0.3 }}
              className="mt-5 space-y-2"
            >
              <Button
                fullWidth
                onClick={() => setStep("checkout")}
                className="relative overflow-hidden py-3"
              >
                <Shimmer delay={2} />
                <Zap className="h-4 w-4" aria-hidden="true" />
                Get Boosted
              </Button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full text-center text-xs font-medium text-midnight/80 hover:text-midnight py-1"
              >
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="checkout"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
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
