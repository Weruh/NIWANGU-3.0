import { useEffect, useRef, useState, type FC, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import {
  CheckCircle2,
  Phone,
  ShieldCheck,
  Zap,
  Award,
  Flame,
  X,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useSanctuaryStore } from "../store";
import { Button } from "./Button";
import { Modal } from "./Modal";
import type { PricingPlanGroup, PricingPlanOption } from "../types";

export const ThePricing: FC = () => {
  const {
    continueWithFreePlan,
    startPremiumPayment,
    loadPricingPlans,
    plans,
    plansLoading,
    setView,
    isBusy,
    paymentPending,
  } = useSanctuaryStore(
    useShallow((state) => ({
      continueWithFreePlan: state.continueWithFreePlan,
      startPremiumPayment: state.startPremiumPayment,
      loadPricingPlans: state.loadPricingPlans,
      plans: state.plans,
      plansLoading: state.plansLoading,
      setView: state.setView,
      isBusy: state.isBusy,
      paymentPending: state.paymentPending,
    })),
  );

  const [activeGroup, setActiveGroup] = useState<PricingPlanGroup>("standard");
  const visiblePlans = plans.filter((plan) => plan.group === activeGroup);
  // Two or three cards stretched across a five-column grid look stranded, so the
  // track count and max width follow how many plans the tab actually has.
  const gridLayout =
    visiblePlans.length <= 2
      ? "max-w-3xl sm:grid-cols-2"
      : "max-w-5xl sm:grid-cols-2 lg:grid-cols-3";
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] =
    useState<PricingPlanOption | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadPricingPlans();
  }, [loadPricingPlans]);

  const handleMpesaCheckout = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCheckoutPlan) {
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length < 9) {
      setPaymentStatus(
        "Please enter a valid Safaricom number (e.g. 0712345678)",
      );
      return;
    }

    setPaymentStatus("Sending STK Push prompt to your phone...");
    try {
      // The store polls for the callback and reports the outcome globally, so
      // the modal can close as soon as the prompt is on its way.
      await startPremiumPayment(selectedCheckoutPlan.id, phoneNumber);
      setSelectedCheckoutPlan(null);
      setPaymentStatus(null);
    } catch (err) {
      setPaymentStatus(
        err instanceof Error ? err.message : "Payment failed. Please try again.",
      );
    }
  };

  return (
    <motion.div
      className="min-h-dvh bg-sandstone p-6 text-midnight"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-7xl flex-col justify-center py-6">
        {/* Back Button */}
        <div className="flex items-center justify-between w-full mb-6">
          <button
            onClick={() => setView("gallery")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 hover:bg-white text-xs font-semibold text-midnight border border-midnight/15 shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Gallery
          </button>
        </div>

        {/* Header Section */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-3">
            Simple Pricing
          </h1>
          <p className="text-midnight/70 text-sm sm:text-base mb-7">
            Choose the best plan for your needs
          </p>

          {/* Toggle Switch Pill */}
          <div
            role="tablist"
            aria-label="Plan length"
            className="inline-flex items-center rounded-full bg-white/70 border border-midnight/15 p-1 shadow-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === "standard"}
              onClick={() => setActiveGroup("standard")}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeGroup === "standard"
                  ? "bg-midnight text-sandstone shadow"
                  : "text-midnight/70 hover:text-midnight"
              }`}
            >
              Standard Passes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGroup === "long_term"}
              onClick={() => setActiveGroup("long_term")}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeGroup === "long_term"
                  ? "bg-midnight text-sandstone shadow"
                  : "text-midnight/70 hover:text-midnight"
              }`}
            >
              Long-Term
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  activeGroup === "long_term"
                    ? "bg-sandstone/20 text-sandstone"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {plansLoading && plans.length === 0 && (
          <p className="text-center text-sm text-midnight/80 mb-14">
            Loading plans...
          </p>
        )}

        {!plansLoading && plans.length === 0 && (
          <p className="text-center text-sm text-midnight/80 mb-14">
            Plans are unavailable right now. Please try again shortly.
          </p>
        )}

        {/* Plans come from the database, so a tab can legitimately end up empty
            if those rows are deactivated. Say so rather than render a blank. */}
        {!plansLoading && plans.length > 0 && visiblePlans.length === 0 && (
          <p className="text-center text-sm text-midnight/80 mb-14">
            No {activeGroup === "standard" ? "standard" : "long-term"} passes are
            available right now.
          </p>
        )}

        {/* Pricing cards.
            Every card runs the same vertical rhythm — badge slot, title, price,
            description, divider, features, CTA — so the rows line up across the
            grid regardless of how many features a plan lists. */}
        <div className={`mx-auto w-full grid gap-5 mb-14 items-stretch ${gridLayout}`}>
          {visiblePlans.map((card) => {
            const isPopular = card.isPopular;
            const isDark = card.isDark;
            const badgeText = isPopular ? "Most Popular" : card.badge;

            return (
              <div
                key={card.id}
                className={`flex flex-col rounded-2xl p-6 transition-shadow ${
                  isPopular
                    ? "bg-white border-2 border-midnight shadow-lg hover:shadow-xl"
                    : isDark
                      ? "bg-midnight text-sandstone border border-midnight shadow-md hover:shadow-lg"
                      : "bg-white/80 border border-midnight/15 text-midnight shadow-sm hover:shadow-md"
                }`}
              >
                {/* Fixed-height slot keeps titles aligned whether or not a card
                    carries a badge. Previously the popular pill was absolutely
                    positioned and collided with the title beneath it. */}
                <div className="h-6 mb-3 flex items-center">
                  {badgeText && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${
                        isPopular
                          ? "bg-midnight text-sandstone"
                          : isDark
                            ? "bg-sandstone/15 text-sandstone"
                            : "bg-midnight/10 text-midnight"
                      }`}
                    >
                      {isPopular && (
                        <Flame
                          className="w-3 h-3 text-amber-400 fill-amber-400"
                          aria-hidden="true"
                        />
                      )}
                      {badgeText}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold tracking-tight mb-4">
                  {card.label}
                </h3>

                {/* Price and period are stacked. Inline, "KSh 1,799 / year"
                    broke mid-unit at this column width. */}
                <div className="mb-4">
                  <div className="text-[2rem] font-bold leading-none tracking-tight tabular-nums">
                    KSh {card.priceKsh.toLocaleString()}
                  </div>
                  <div
                    className={`mt-2 text-xs font-medium ${isDark ? "text-sandstone/60" : "text-midnight/60"}`}
                  >
                    {card.period}
                  </div>
                </div>

                <p
                  className={`text-xs leading-relaxed ${isDark ? "text-sandstone/70" : "text-midnight/70"}`}
                >
                  {card.description}
                </p>

                <div
                  className={`my-5 border-t ${isDark ? "border-sandstone/15" : "border-midnight/10"}`}
                />

                {/* flex-1 pushes every CTA to the same baseline. */}
                <ul className="flex-1 space-y-2.5 mb-6">
                  {card.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-xs leading-relaxed">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 mt-[0.15rem] ${isDark ? "text-sandstone/70" : "text-midnight/50"}`}
                        aria-hidden="true"
                      />
                      <span className={isDark ? "text-sandstone/85" : "text-midnight/75"}>
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setSelectedCheckoutPlan(card)}
                  className={`group w-full rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    isDark
                      ? "bg-sandstone text-midnight hover:bg-white focus-visible:outline-sandstone"
                      : "bg-midnight text-sandstone hover:bg-midnight/90 focus-visible:outline-midnight"
                  }`}
                >
                  <span>Get started</span>
                  <ArrowRight
                    className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Free Plan Fallback button */}
        <div className="text-center mb-12">
          <button
            onClick={() => void continueWithFreePlan()}
            className="text-xs text-midnight/80 hover:text-midnight underline"
          >
            Or continue with the Free Plan (10 Like/Pass decisions per day)
          </button>
        </div>

        {/* Strategic Rationale Breakdown: Why KSh 199 is a good entry point */}
        <div className="mx-auto mb-10 max-w-3xl rounded-2xl border border-midnight/10 bg-white/60 p-6 text-midnight">
          <h3 className="font-serif text-2xl">More opportunities. Your choice.</h3>
          <p className="mt-3 text-sm leading-6 text-midnight/75">Every pass includes the same Premium tools. Choose the duration that suits you. Matching always requires mutual interest, and conversations with matches stay free.</p>
          <p className="mt-3 text-sm leading-6 text-midnight/75">Includes two 30-minute boosts per 30 purchased days, with at least one boost for shorter passes. No automatic renewal. Buying another pass adds time to your remaining access.</p>
        </div>

        {/* M-Pesa Checkout Modal when Get started is clicked */}
        <AnimatePresence>
          {selectedCheckoutPlan && (
            <Modal
              titleId="mpesa-checkout-title"
              closeLabel="Cancel this payment"
              initialFocusRef={phoneInputRef}
              className="max-w-md border border-midnight/20 p-6 text-midnight"
              onClose={() => {
                setSelectedCheckoutPlan(null);
                setPaymentStatus(null);
              }}
            >
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCheckoutPlan(null);
                    setPaymentStatus(null);
                  }}
                  aria-label="Cancel this payment"
                  className="absolute top-4 right-4 p-1.5 text-midnight/80 hover:text-midnight rounded-full hover:bg-midnight/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>

                <div className="mb-5">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-midnight/10 px-2 py-0.5 rounded-full text-midnight">
                    M-Pesa STK Push Unlock
                  </span>
                  <h3 id="mpesa-checkout-title" className="text-xl font-semibold tracking-tight mt-2">
                    {selectedCheckoutPlan.label}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-emerald-800">
                    KSh {selectedCheckoutPlan.priceKsh.toLocaleString()}{" "}
                    {selectedCheckoutPlan.period}
                  </p>
                </div>

                <form onSubmit={handleMpesaCheckout} className="space-y-4">
                  <div>
                    <label
                      htmlFor="mpesa-phone"
                      className="block text-xs font-semibold uppercase tracking-wider text-midnight/80 mb-1.5"
                    >
                      Safaricom M-Pesa Phone Number
                    </label>
                    <div className="relative">
                      <Phone
                        className="w-4 h-4 absolute left-3 top-3 text-midnight/80"
                        aria-hidden="true"
                      />
                      <input
                        id="mpesa-phone"
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
                    <p
                      role="status"
                      className={`text-xs font-medium ${paymentStatus.includes("Success") ? "text-emerald-700 font-bold" : "text-midnight/80"}`}
                    >
                      {paymentStatus}
                    </p>
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    disabled={isBusy || paymentPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
                  >
                    {isBusy
                      ? "Initiating STK Push..."
                      : paymentPending
                        ? "Waiting for M-Pesa confirmation..."
                        : `Pay KSh ${selectedCheckoutPlan.priceKsh.toLocaleString()} via M-Pesa`}
                  </Button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-midnight/80 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />{" "}
                    Secure M-Pesa STK Push via Paystack
                  </div>
                </form>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
