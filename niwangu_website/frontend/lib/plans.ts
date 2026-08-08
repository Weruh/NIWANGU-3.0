import type { PaidPricingPlan, PricingPlanOption } from '../types';
import { getSupabase } from './supabase';

/**
 * Prices are NOT defined here. They live in public.pricing_plans and are the
 * same numbers the paystack-charge function charges, so the UI can never quote a
 * figure the server disagrees with. This file holds presentation copy only.
 *
 * Adding a plan means inserting a pricing_plans row and adding its copy below;
 * a plan the frontend has no copy for is skipped rather than shown bare.
 */
const PLAN_PRESENTATION: Record<PaidPricingPlan, Omit<PricingPlanOption, 'id' | 'label' | 'priceKsh' | 'durationDays'>> = {
  '7_days': {
    group: 'standard',
    period: '/ 7 days',
    description: 'Low-friction entry to test Premium features.',
    badge: 'Trial',
    features: [
      'Unlimited profile views',
      'Full Parlor chat access',
      'Instant M-Pesa STK push',
      'No auto-renewal commitment',
    ],
  },
  '30_days': {
    group: 'standard',
    period: '/ month',
    description: 'Recommended impulse entry point for members.',
    badge: 'Most Popular',
    isPopular: true,
    features: [
      'Everything in the 7-Day Trial',
      '30 full days of Premium access',
      'Priority matching algorithm',
      'Unlimited Parlor messaging',
      'Direct profile messaging',
    ],
  },
  '90_days': {
    group: 'long_term',
    period: '/ 3 months',
    description: 'Quarterly access for intentional matching.',
    features: [
      'Everything in the 30-Day Pass',
      'Better value than paying monthly',
      'Exclusive intentional badge',
      'Continuous match updates',
      'Priority support',
    ],
  },
  '180_days': {
    group: 'long_term',
    period: '/ 6 months',
    description: 'Half a year of uninterrupted access.',
    features: [
      'Everything in the 90-Day Pass',
      'Six months of unlimited swiping',
      'Exclusive intentional badge',
      'Priority support',
    ],
  },
  '365_days': {
    group: 'long_term',
    period: '/ year',
    description: 'Maximum savings & long-term connection.',
    badge: 'Best Value',
    isDark: true,
    features: [
      'Everything in the 180-Day Pass',
      'Full year of unlimited swiping',
      'Best value per month',
      'VIP profile placement',
      'Priority support',
    ],
  },
};

type PricingPlanRow = {
  plan_id: string;
  label: string;
  price_ksh: number;
  duration_days: number;
};

const isPaidPlanId = (planId: string): planId is PaidPricingPlan => planId in PLAN_PRESENTATION;

export const fetchPricingPlans = async (): Promise<PricingPlanOption[]> => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pricing_plans')
    .select('plan_id, label, price_ksh, duration_days')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as PricingPlanRow[])
    .filter((row) => isPaidPlanId(row.plan_id))
    .map((row) => {
      const planId = row.plan_id as PaidPricingPlan;

      return {
        id: planId,
        label: row.label,
        priceKsh: row.price_ksh,
        durationDays: row.duration_days,
        ...PLAN_PRESENTATION[planId],
      };
    });
};
