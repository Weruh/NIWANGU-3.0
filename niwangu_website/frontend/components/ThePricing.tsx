import { useState, type FC, type FormEvent } from "react";
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
import type { PricingPlan } from "../types";

interface PlanCardData {
  id: PricingPlan;
  name: string;
  priceKsh: number;
  period: string;
  description: string;
  features: string[];
  badge?: string;
  isPopular?: boolean;
  isDark?: boolean;
}

const CARDS: PlanCardData[] = [
  {
    id: "7_days",
    name: "7-Day Trial",
    priceKsh: 99,
    period: "/ 7 days",
    description: "Low-friction entry to test Premium features.",
    badge: "Trial",
    features: [
      "Unlimited profile views",
      "Full Parlor chat access",
      "Instant M-Pesa STK push",
      "No auto-renewal commitment",
    ],
  },
  {
    id: "30_days",
    name: "30-Day Pass",
    priceKsh: 199,
    period: "/ month",
    description: "Recommended impulse entry point for members.",
    badge: "Most Popular",
    isPopular: true,
    features: [
      "Everything in 7-Day Trial",
      "30 full days of Premium access",
      "Priority matching algorithm",
      "Unlimited Parlor messaging",
      "Direct profile messaging",
    ],
  },
  {
    id: "90_days",
    name: "90-Day Pass",
    priceKsh: 499,
    period: "/ 3 months",
    description: "Quarterly access for intentional matching.",
    features: [
      "Everything in 30-Day Pass",
      "Save 16% compared to monthly",
      "Exclusive intentional badge",
      "Continuous match updates",
      "Priority support",
    ],
  },
  {
    id: "365_days",
    name: "Annual Pass",
    priceKsh: 1799,
    period: "/ year",
    description: "Maximum savings & long-term connection.",
    badge: "Best Value",
    isDark: true,
    features: [
      "Everything in 90-Day Pass",
      "Full year of unlimited swiping",
      "Save over 25% annually",
      "VIP profile placement",
      "200+ priority connections",
    ],
  },
];

export const ThePricing: FC = () => {
  const { choosePricingPlan, unlockPremium, setView, isBusy } =
    useSanctuaryStore(
      useShallow((state) => ({
        choosePricingPlan: state.choosePricingPlan,
        unlockPremium: state.unlockPremium,
        setView: state.setView,
        isBusy: state.isBusy,
      })),
    );

  const [activeTab, setActiveTab] = useState<"monthly" | "yearly">("monthly");
  const [selectedCheckoutPlan, setSelectedCheckoutPlan] =
    useState<PlanCardData | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

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
      await unlockPremium(selectedCheckoutPlan.id, phoneNumber);
      setPaymentStatus(
        "STK push sent. Complete the payment in M-Pesa to unlock premium access.",
      );
      setTimeout(() => {
        setSelectedCheckoutPlan(null);
        setPaymentStatus(null);
      }, 2500);
    } catch (err: any) {
      setPaymentStatus(err?.message || "Payment failed. Please try again.");
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-sandstone p-6 text-midnight"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col justify-center py-6">
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
        <div className="text-center max-w-xl mx-auto mb-8">
          <h1 className="font-serif text-5xl font-bold tracking-tight mb-3">
            Simple Pricing
          </h1>
          <p className="text-midnight/60 text-base mb-6">
            Choose the best plan for your needs
          </p>

          {/* Toggle Switch Pill */}
          <div className="inline-flex items-center rounded-full bg-white/70 border border-midnight/15 p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("monthly")}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTab === "monthly"
                  ? "bg-midnight text-sandstone shadow"
                  : "text-midnight/70 hover:text-midnight"
              }`}
            >
              Standard Passes
            </button>
            <button
              onClick={() => setActiveTab("yearly")}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === "yearly"
                  ? "bg-midnight text-sandstone shadow"
                  : "text-midnight/70 hover:text-midnight"
              }`}
            >
              Long-Term{" "}
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid (Matching screenshot layout) */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-14 items-stretch">
          {CARDS.map((card) => {
            const isPopular = card.isPopular;
            const isDark = card.isDark;

            return (
              <div
                key={card.id}
                className={`rounded-2xl p-6 transition-all flex flex-col justify-between relative shadow-sm hover:shadow-lg ${
                  isPopular
                    ? "border-2 border-midnight bg-white ring-1 ring-midnight/10 shadow-xl scale-[1.02] z-10"
                    : isDark
                      ? "bg-midnight text-sandstone border border-midnight shadow-xl"
                      : "bg-white/80 border border-midnight/15 text-midnight"
                }`}
              >
                {/* Popular Pill Badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white border border-midnight/20 px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1 text-[11px] font-semibold text-midnight">
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Most Popular</span>
                  </div>
                )}

                <div>
                  {/* Card Title */}
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className={`font-serif text-lg font-bold ${isDark ? "text-sandstone" : "text-midnight"}`}
                    >
                      {card.name}
                    </h3>
                    {!isPopular && card.badge && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isDark
                            ? "bg-sandstone/15 text-sandstone"
                            : "bg-midnight/10 text-midnight"
                        }`}
                      >
                        {card.badge}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="font-serif text-4xl font-extrabold tracking-tight">
                      KSh {card.priceKsh.toLocaleString()}
                    </span>
                    <span
                      className={`text-xs ml-1 font-medium ${isDark ? "text-sandstone/60" : "text-midnight/55"}`}
                    >
                      {card.period}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    className={`text-xs mb-6 ${isDark ? "text-sandstone/70" : "text-midnight/65"}`}
                  >
                    {card.description}
                  </p>

                  {/* Feature Checklist */}
                  <div className="space-y-3 mb-8">
                    {card.features.map((feat) => (
                      <div
                        key={feat}
                        className="flex items-start gap-2.5 text-xs"
                      >
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? "text-sandstone/80" : "text-midnight/70"}`}
                        />
                        <span
                          className={
                            isDark ? "text-sandstone/85" : "text-midnight/80"
                          }
                        >
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom CTA Button matching screenshot style */}
                <button
                  onClick={() => setSelectedCheckoutPlan(card)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 group ${
                    isDark
                      ? "bg-sandstone text-midnight hover:bg-white"
                      : isPopular
                        ? "bg-midnight text-sandstone hover:bg-midnight/90 shadow"
                        : "bg-midnight text-sandstone hover:bg-midnight/85"
                  }`}
                >
                  <span>Get started</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Free Plan Fallback button */}
        <div className="text-center mb-12">
          <button
            onClick={() => void choosePricingPlan("free")}
            className="text-xs text-midnight/60 hover:text-midnight underline"
          >
            Or continue with the Free Plan (5 free profile views / 24 hrs)
          </button>
        </div>

        {/* Strategic Rationale Breakdown: Why KSh 199 is a good entry point */}
        <div className="bg-midnight text-sandstone rounded-2xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-4 text-emerald-400">
            <Zap className="w-5 h-5" />
            <h3 className="font-serif text-2xl font-semibold text-sandstone">
              Why KSh 199 is a good entry point
            </h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <div className="space-y-3 text-sm text-sandstone/80">
              <p className="font-medium text-sandstone">
                For a new platform like Niwangu:
              </p>
              <ul className="space-y-2 list-disc list-inside text-sandstone/70">
                <li>
                  <strong className="text-sandstone">Impulse Purchase:</strong>{" "}
                  KSh 199 feels lightweight and low-risk for users.
                </li>
                <li>
                  <strong className="text-sandstone">
                    Customer Acquisition:
                  </strong>{" "}
                  Accelerates acquiring your first paying members.
                </li>
                <li>
                  <strong className="text-sandstone">
                    High Renewal Conversion:
                  </strong>{" "}
                  Once members experience Premium matches, they are far more
                  likely to renew or choose a 90/180/365 day plan.
                </li>
              </ul>
            </div>

            <div className="bg-sandstone/10 rounded-xl p-4 text-xs space-y-3 text-sandstone/85 border border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-sandstone text-sm">
                <Award className="w-4 h-4 text-amber-400" /> 7-Day Trial (KSh
                99) Low-Friction Entry
              </div>
              <p>
                Many users hesitate to commit to a full month right away. The{" "}
                <strong>7-Day Trial (KSh 99)</strong> plan acts as a
                low-friction entry point and can significantly increase the
                number of users willing to try Premium.
              </p>
              <p className="text-sandstone/60">
                You can track conversions from the trial to longer subscriptions
                and adjust your pricing strategy over time based on user
                feedback.
              </p>
            </div>
          </div>
        </div>

        {/* M-Pesa Checkout Modal when Get started is clicked */}
        <AnimatePresence>
          {selectedCheckoutPlan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-midnight/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-sandstone border border-midnight/20 rounded-2xl p-6 max-w-md w-full text-midnight shadow-2xl relative"
              >
                <button
                  onClick={() => {
                    setSelectedCheckoutPlan(null);
                    setPaymentStatus(null);
                  }}
                  className="absolute top-4 right-4 p-1.5 text-midnight/50 hover:text-midnight rounded-full hover:bg-midnight/5"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="mb-5">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-midnight/10 px-2 py-0.5 rounded-full text-midnight">
                    M-Pesa STK Push Unlock
                  </span>
                  <h3 className="font-serif text-2xl font-bold mt-2">
                    {selectedCheckoutPlan.name}
                  </h3>
                  <p className="text-sm font-serif font-bold text-emerald-800">
                    KSh {selectedCheckoutPlan.priceKsh.toLocaleString()}{" "}
                    {selectedCheckoutPlan.period}
                  </p>
                </div>

                <form onSubmit={handleMpesaCheckout} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-midnight/70 mb-1.5">
                      Safaricom M-Pesa Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-midnight/40" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g. 0712345678"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-midnight/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-midnight text-midnight"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {paymentStatus && (
                    <p
                      className={`text-xs font-medium ${paymentStatus.includes("Success") ? "text-emerald-700 font-bold" : "text-midnight/80"}`}
                    >
                      {paymentStatus}
                    </p>
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    disabled={isBusy}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
                  >
                    {isBusy
                      ? "Initiating STK Push..."
                      : `Pay KSh ${selectedCheckoutPlan.priceKsh} via M-Pesa`}
                  </Button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-midnight/50 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />{" "}
                    Secure Daraja M-Pesa STK Push
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
