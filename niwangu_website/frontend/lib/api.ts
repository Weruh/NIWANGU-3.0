import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  ChatSession,
  CurrentUserProfile,
  Gender,
  MatchMessageRow,
  Message,
  PaidPricingPlan,
  PaymentState,
  ProfileViewStatus,
  ProfilePhoto,
  ProfileUpdateInput,
  SignUpInput,
  SwipeDirection,
  SwipeResult,
  UserProfile,
} from '../types';
import { getProfileFieldsFromAnswers } from './ritual';
import { getSupabase } from './supabase';

type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  age: number | null;
  gender: Gender | null;
  seeking_gender: Gender | null;
  location: string | null;
  intent: string | null;
  core_value: string | null;
  why_niwangu: string | null;
  boundary: string | null;
  onboarding_completed: boolean | null;
  profile_ready: boolean | null;
  is_premium: boolean | null;
  premium_expires_at: string | null;
  daily_swipe_limit: number | null;
};

type PhotoRow = {
  id: string;
  public_url: string;
  sort_order: number;
  storage_path: string | null;
};

type RitualAnswerRow = {
  question_id: number;
  answer_text: string;
};

type GalleryRow = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  location: string;
  boundary: string;
  intent: string;
  core_value: string;
  why_niwangu: string;
  alignment_reasons: string[] | null;
  photo_url: string | null;
};

type MatchRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_photo: string | null;
  garden_level: number;
  values_overlap: string[] | null;
  is_closed: boolean;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  partner_boundary: string | null;
  boundary_acknowledged: boolean | null;
};

type SwipeRpcRow = {
  matched: boolean;
  match_id: string | null;
  remaining_swipes: number;
};

type ProfileViewStatusRow = {
  used_views: number;
  remaining_views: number;
  is_locked: boolean;
  locked_until: string | null;
  payment_amount_ksh: number;
};

type MpesaChargeResult = {
  reference: string;
  amount: number;
  message: string;
};

const PROFILE_PHOTO_BUCKET = 'profile-photos';

// is_premium stays true after a subscription lapses, so mirror the server's
// has_active_premium() rule here. Otherwise the UI shows "Active" while every
// gated RPC refuses.
const hasActivePremium = (row: ProfileRow) =>
  Boolean(row.is_premium) &&
  (!row.premium_expires_at || new Date(row.premium_expires_at).getTime() > Date.now());

const mapProfile = (row: ProfileRow): CurrentUserProfile => ({
  id: row.id,
  authUserId: row.auth_user_id,
  name: row.full_name ?? '',
  age: row.age ?? null,
  gender: row.gender ?? '',
  seekingGender: row.seeking_gender ?? '',
  location: row.location ?? '',
  intent: row.intent ?? '',
  coreValue: row.core_value ?? '',
  whyNiwangu: row.why_niwangu ?? '',
  boundary: row.boundary ?? '',
  onboardingCompleted: Boolean(row.onboarding_completed),
  profileReady: Boolean(row.profile_ready),
  isPremium: hasActivePremium(row),
  premiumExpiresAt: row.premium_expires_at,
  dailySwipeLimit: row.daily_swipe_limit ?? 5,
});

const mapPhoto = (row: PhotoRow): ProfilePhoto => ({
  id: row.id,
  url: row.public_url,
  sortOrder: row.sort_order,
  storagePath: row.storage_path,
});

const mapGalleryProfile = (row: GalleryRow): UserProfile => ({
  id: row.id,
  name: row.name,
  age: row.age,
  gender: row.gender,
  distance: row.location,
  photos: row.photo_url ? [row.photo_url] : [],
  boundary: row.boundary,
  ritualAnswers: {
    1: row.intent,
    6: row.core_value,
    10: row.why_niwangu,
  },
  alignmentReasons: row.alignment_reasons ?? [],
});

const mapChatSession = (row: MatchRow): ChatSession => ({
  id: row.id,
  partnerId: row.partner_id,
  partnerName: row.partner_name,
  partnerPhoto: row.partner_photo ?? 'https://picsum.photos/200/200?grayscale',
  messages: [],
  gardenLevel: row.garden_level,
  valuesOverlap: row.values_overlap ?? [],
  isClosed: row.is_closed,
  lastMessage: row.last_message ?? '',
  lastMessageAt: row.last_message_at,
  unreadCount: row.unread_count ?? 0,
  partnerBoundary: row.partner_boundary,
  // Default to acknowledged so a transport hiccup can never wrongly gate the
  // composer; the server rejects the send regardless if it truly isn't.
  boundaryAcknowledged: row.boundary_acknowledged ?? true,
});

const mapProfileViewStatus = (row: ProfileViewStatusRow | null | undefined): ProfileViewStatus => ({
  usedViews: row?.used_views ?? 0,
  remainingViews: row?.remaining_views ?? 5,
  isLocked: Boolean(row?.is_locked),
  lockedUntil: row?.locked_until ?? null,
  // get_profile_view_status() returns the cheapest live plan; this only covers
  // the row-missing case.
  paymentAmountKsh: row?.payment_amount_ksh ?? 99,
});

export const getSession = async (): Promise<Session | null> => {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
};

export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) => {
  const supabase = getSupabase();
  return supabase.auth.onAuthStateChange(callback);
};

export const signOut = async () => {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
};

export const signUpWithEmail = async (input: SignUpInput) => {
  const supabase = getSupabase();
  const seekingGender = input.gender === 'female' ? 'male' : 'female';

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        age: input.age,
        gender: input.gender,
        seeking_gender: seekingGender,
        location: input.location,
      },
    },
  });

  if (error) {
    throw error;
  }

  return {
    session: data.session,
    needsEmailConfirmation: !data.session,
  };
};

export const signInWithEmail = async (email: string, password: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.session;
};

export const getMyProfile = async (): Promise<CurrentUserProfile | null> => {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, auth_user_id, full_name, age, gender, seeking_gender, location, intent, core_value, why_niwangu, boundary, onboarding_completed, profile_ready, is_premium, premium_expires_at, daily_swipe_limit',
    )
    .eq('auth_user_id', user.id)
    .single();

  if (error) {
    throw error;
  }

  return mapProfile(data as ProfileRow);
};

export const updateMyProfile = async (profileId: string, input: ProfileUpdateInput) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.name,
      age: input.age,
      gender: input.gender,
      seeking_gender: input.seekingGender,
      location: input.location,
      intent: input.intent,
      core_value: input.coreValue,
      why_niwangu: input.whyNiwangu,
      boundary: input.boundary,
    })
    .eq('id', profileId);

  if (error) {
    throw error;
  }
};

export const getMyRitualAnswers = async (profileId: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ritual_answers')
    .select('question_id, answer_text')
    .eq('profile_id', profileId);

  if (error) {
    throw error;
  }

  return (data as RitualAnswerRow[]).reduce<Record<number, string>>((acc, item) => {
    acc[item.question_id] = item.answer_text;
    return acc;
  }, {});
};

export const saveRitualAnswer = async (
  profileId: string,
  questionId: number,
  answer: string,
  currentAnswers: Record<number, string>,
) => {
  const supabase = getSupabase();
  const nextAnswers = { ...currentAnswers, [questionId]: answer };

  const { error: answerError } = await supabase.from('ritual_answers').upsert(
    {
      profile_id: profileId,
      question_id: questionId,
      answer_text: answer,
    },
    { onConflict: 'profile_id,question_id' },
  );

  if (answerError) {
    throw answerError;
  }

  const profileFields = getProfileFieldsFromAnswers(nextAnswers);
  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileFields)
    .eq('id', profileId);

  if (profileError) {
    throw profileError;
  }

  return nextAnswers;
};

export const listProfilePhotos = async (profileId: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profile_photos')
    .select('id, public_url, sort_order, storage_path')
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as PhotoRow[]).map(mapPhoto);
};

const getCurrentUser = async () => {
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('You must be signed in to do that.');
  }

  return user;
};

const fileExtension = (fileName: string) => {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop() : 'jpg';
};

const prepareProfilePhoto = async (file: File) => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
};

export const uploadProfilePhoto = async (profileId: string, file: File, sortOrder: number) => {
  const user = await getCurrentUser();
  const supabase = getSupabase();
  const uploadFile = await prepareProfilePhoto(file);
  const ext = fileExtension(uploadFile.name || 'photo.jpg');
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(storagePath, uploadFile, {
      cacheControl: '31536000',
      upsert: false,
      contentType: uploadFile.type || 'image/jpeg',
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .getPublicUrl(storagePath);

  const { error: insertError } = await supabase.from('profile_photos').insert({
    profile_id: profileId,
    sort_order: sortOrder,
    public_url: publicData.publicUrl,
    storage_path: storagePath,
  });

  if (insertError) {
    throw insertError;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ profile_ready: false })
    .eq('id', profileId);

  if (updateError) {
    throw updateError;
  }
};

export const deleteProfilePhoto = async (photo: ProfilePhoto) => {
  const supabase = getSupabase();

  if (photo.storagePath) {
    const { error: storageError } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .remove([photo.storagePath]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase.from('profile_photos').delete().eq('id', photo.id);

  if (error) {
    throw error;
  }
};

export const finalizeProfileReadiness = async (profileId: string) => {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ profile_ready: true })
    .eq('id', profileId);

  if (error) {
    throw error;
  }
};


export const getProfileViewStatus = async (): Promise<ProfileViewStatus> => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_profile_view_status');

  if (error) {
    throw error;
  }

  const row = Array.isArray(data)
    ? (data[0] as ProfileViewStatusRow | undefined)
    : (data as ProfileViewStatusRow | null);

  return mapProfileViewStatus(row);
};

export const listGalleryProfiles = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_gallery_profiles', {
    limit_count: 1,
  });

  if (error) {
    throw error;
  }

  const status = await getProfileViewStatus();

  return {
    profiles: (data as GalleryRow[]).map(mapGalleryProfile),
    status,
  };
};

export const handleSwipe = async (
  targetProfileId: string,
  direction: SwipeDirection,
): Promise<SwipeResult> => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('handle_swipe', {
    p_target_profile_id: targetProfileId,
    p_direction: direction,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? (data[0] as SwipeRpcRow) : (data as SwipeRpcRow);
  return {
    matched: Boolean(row?.matched),
    matchId: row?.match_id ?? null,
    remainingSwipes: row?.remaining_swipes ?? 0,
  };
};

/**
 * Starts an M-Pesa payment through Paystack. Only the plan and phone number are
 * sent: the amount comes from pricing_plans and the profile (and the billing
 * email Paystack needs) come from the caller's JWT, all resolved inside the
 * edge function.
 */
export const requestMpesaCharge = async (
  planId: PaidPricingPlan,
  phoneNumber: string,
): Promise<MpesaChargeResult> => {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase.functions.invoke('paystack-charge', {
      body: {
        phoneNumber,
        planId,
      },
    });

    if (error) {
      // supabase-js swallows the response body on non-2xx and reports a generic
      // "Edge Function returned a non-2xx status code". Read the body so the
      // user sees what actually went wrong.
      let detail = '';
      const response = (error as { context?: Response }).context;
      if (response && typeof response.text === 'function') {
        const raw = await response.text().catch(() => '');
        try {
          const parsed = JSON.parse(raw);
          detail = parsed?.error || parsed?.message || raw;
        } catch {
          detail = raw;
        }
      }
      console.error('Paystack charge function invocation failed:', error, detail);
      throw new Error(detail || error.message || 'Unable to start the M-Pesa payment request.');
    }

    if (!data?.success || !data?.reference) {
      throw new Error(data?.error || 'M-Pesa STK Push request failed.');
    }

    return {
      reference: data.reference as string,
      amount: Number(data.amount),
      message: (data.message as string) ?? '',
    };
  } catch (err) {
    console.error('Paystack charge request failed:', err);
    throw err instanceof Error
      ? err
      : new Error('Unable to start M-Pesa payment. Please try again.');
  }
};

/**
 * Reads the payment row the webhook writes to. Premium itself is only ever
 * granted server-side by complete_payment(); this is a read-only poll.
 */
export const getPaymentState = async (reference: string): Promise<PaymentState | null> => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('payments')
    .select('status')
    .eq('reference', reference)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.status as PaymentState | undefined) ?? null;
};

export const listMatches = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_matches');

  if (error) {
    throw error;
  }

  return (data as MatchRow[]).map(mapChatSession);
};

export const MESSAGE_PAGE_SIZE = 40;

const toMessage = (row: MatchMessageRow, currentProfileId: string): Message => ({
  id: row.id,
  sender: row.is_system
    ? 'system'
    : row.sender_profile_id === currentProfileId
      ? 'me'
      : 'partner',
  text: row.body,
  timestamp: new Date(row.created_at).getTime(),
  isSystem: row.is_system,
  status: 'sent',
});

/**
 * Returns a page of messages oldest-first. `before` pages backwards through
 * history; `after` catches up from a cursor, which is how a reconnecting client
 * fills the gap it missed.
 */
export const listMatchMessages = async (
  matchId: string,
  currentProfileId: string,
  options: { limit?: number; before?: number; after?: number } = {},
) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_match_messages', {
    p_match_id: matchId,
    p_limit: options.limit ?? MESSAGE_PAGE_SIZE,
    p_before: options.before ? new Date(options.before).toISOString() : null,
    p_after: options.after ? new Date(options.after).toISOString() : null,
  });

  if (error) {
    throw error;
  }

  return (data as MatchMessageRow[]).map((row) => toMessage(row, currentProfileId));
};

export const markMatchRead = async (matchId: string) => {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('mark_match_read', { p_match_id: matchId });

  if (error) {
    throw error;
  }
};

/**
 * Records that you have read the partner's stated boundary. send_match_message
 * rejects your first message until this has been called, so the acknowledgement
 * is enforced server-side rather than by the UI alone.
 */
export const acknowledgeBoundary = async (matchId: string) => {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('acknowledge_boundary', { p_match_id: matchId });

  if (error) {
    throw error;
  }
};

export const sendMatchMessage = async (matchId: string, body: string) => {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('send_match_message', {
    p_match_id: matchId,
    p_body: body,
  });

  if (error) {
    throw error;
  }
};

export const closeMatch = async (matchId: string, reason: string) => {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('close_match', {
    p_match_id: matchId,
    p_reason: reason,
  });

  if (error) {
    throw error;
  }
};

/**
 * Watches the signed-in member's own matches. The match subscriptions are
 * filtered to their participant columns; the message stream cannot be filtered
 * by "matches I belong to" in postgres_changes, so RLS does that server-side and
 * the burst of events it produces is debounced into a single refresh here.
 */
export const subscribeToMatchChanges = (profileId: string, onChange: () => void) => {
  const supabase = getSupabase();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleRefresh = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(onChange, 300);
  };

  const channel = supabase
    .channel(`matches-feed-${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `profile_low_id=eq.${profileId}` },
      scheduleRefresh,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `profile_high_id=eq.${profileId}` },
      scheduleRefresh,
    )
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, scheduleRefresh)
    .subscribe();

  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    void supabase.removeChannel(channel);
  };
};

/**
 * Delivers each new message directly from the realtime payload, so an open
 * conversation never refetches its history just to show one new bubble.
 */
export const subscribeToMatchMessages = (
  matchId: string,
  currentProfileId: string,
  onMessage: (message: Message) => void,
  onResubscribe: () => void,
) => {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`match-${matchId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => {
        const row = payload.new as Partial<MatchMessageRow> & { match_id?: string };

        if (!row?.id || !row.created_at || typeof row.body !== 'string') {
          return;
        }

        onMessage(
          toMessage(
            {
              id: row.id,
              sender_profile_id: row.sender_profile_id ?? '',
              body: row.body,
              created_at: row.created_at,
              is_system: Boolean(row.is_system),
            },
            currentProfileId,
          ),
        );
      },
    )
    .subscribe((status) => {
      // A dropped socket can lose messages, so fill the gap on reconnect.
      if (status === 'SUBSCRIBED') {
        onResubscribe();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
};
