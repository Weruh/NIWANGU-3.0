import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimation,
  useReducedMotion,
} from "framer-motion";
import { errorMessage } from "../lib/errors";
import {
  Heart,
  X,
  Bookmark,
  SlidersHorizontal,
  Undo2,
  Sparkles,
  MapPin,
  Zap,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useSanctuaryStore } from "../store";
import type { DiscoverySection, UserProfile } from "../types";
import { listSavedIds, saveProfileForLater, undoLastPass } from "../lib/api";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { OptimizedImage } from "./OptimizedImage";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { BrandLogo } from "./BrandLogo";
import { MemberSafety } from "./MemberSafety";

export const TheGallery = ({
  section = "discover",
  viewMode = "focus",
}: {
  section?: DiscoverySection;
  viewMode?: "discover" | "focus";
}) => {
  const state = useSanctuaryStore(
    useShallow((s) => ({
      profiles: s.galleryProfiles,
      loading: s.galleryLoading,
      used: s.profileViewsUsed,
      locked: s.paymentRequired,
      premium: s.isPremium,
      profile: s.currentProfile,
      mode: s.discoveryMode,
      focus: s.focusedProfileId,
      load: s.loadGallery,
      swipe: s.swipeProfile,
      setView: s.setView,
      hasMore: s.discoveryHasMore,
      credits: s.boostCredits,
      activate: s.activateBoost,
      activeUntil: s.boostActiveUntil,
      error: s.errorMessage,
      reset: s.profileViewLockUntil,
    })),
  );
  const controls = useAnimation();
  const reduceMotion = useReducedMotion();
  const [held, setHeld] = useState<UserProfile | null>(null);
  const [exitDirection, setExitDirection] = useState<"like" | "pass">("like");
  const [reaction, setReaction] = useState<"like" | "pass" | null>(null);
  const mode =
    section === "discover" ? (state.premium ? viewMode : "focus") : "discover";
  const [detail, setDetail] = useState<UserProfile | null>(null);
  const [filters, setFilters] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [match, setMatch] = useState<{ name: string; id: string } | null>(null);
  const [localError, setLocalError] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef(0);
  const actionInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (section === "likes" && !state.premium) return;
    void state.load(section);
  }, [section, state.premium, state.load]);
  useEffect(() => {
    if (!state.profile) return;
    void listSavedIds(state.profile.id)
      .then(setSaved)
      .catch(() => undefined);
  }, [state.profile?.id]);
  useEffect(() => {
    if (!state.focus && state.profiles.length)
      useSanctuaryStore.setState({ focusedProfileId: state.profiles[0].id });
  }, [state.focus, state.profiles]);
  useEffect(() => {
    if (mode === "discover" && scrollRef.current)
      scrollRef.current.scrollTop = scrollPosition.current;
  }, [mode]);
  // Once the limit resets, refresh both the allowance and profiles.
  useEffect(() => {
    if (!state.reset) return;
    const delay = new Date(state.reset).getTime() - Date.now();
    if (delay < 0) return;
    const timer = setTimeout(
      () => void state.load(section),
      Math.min(delay + 500, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [state.reset, state.load, section]);
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (
      !sentinel ||
      !state.hasMore ||
      state.loading ||
      (state.locked && !state.premium) ||
      (section === "likes" && !state.premium)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void state.load(section, true);
      },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    state.hasMore,
    state.loading,
    state.locked,
    state.premium,
    state.load,
    section,
  ]);
  const current =
    held ??
    state.profiles.find((p) => p.id === state.focus) ??
    state.profiles[0];
  useEffect(() => {
    void controls.start({
      x: 0,
      y: 0,
      rotate: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: reduceMotion ? 0 : 0.35 },
    });
  }, [current?.id, controls, reduceMotion]);
  const decide = async (p: UserProfile, direction: "like" | "pass") => {
    if (actionInFlight.current || (state.locked && !state.premium)) return;
    actionInFlight.current = true;
    setExitDirection(direction);
    setBusy(p.id);
    if (mode === "focus") setHeld(p);
    setLocalError("");
    try {
      const result = await state.swipe(p.id, direction);
      if (!mounted.current) return;
      if (result.saved) {
        setReaction(direction);
        if (mode === "focus")
          await controls.start({
            x: reduceMotion ? 0 : direction === "like" ? 160 : -160,
            rotate: reduceMotion ? 0 : direction === "like" ? 7 : -7,
            opacity: 0,
            scale: 0.96,
            transition: { duration: reduceMotion ? 0 : 0.32 },
          });
        setDetail(null);
        setSaved((ids) => ids.filter((id) => id !== p.id));
        useSanctuaryStore.setState({
          focusedProfileId:
            useSanctuaryStore.getState().galleryProfiles[0]?.id ?? null,
        });
      }
      if (result.matched) {
        const chat = useSanctuaryStore
          .getState()
          .activeChats.find((c) => c.partnerId === p.id);
        if (chat) setMatch({ name: p.name, id: chat.id });
      }
    } finally {
      if (mounted.current)
        controls.set({ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 });
      setHeld(null);
      setReaction(null);
      setBusy(null);
      actionInFlight.current = false;
    }
  };
  const toggleSave = async (p: UserProfile) => {
    if (!state.profile || actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(p.id);
    try {
      const next = !saved.includes(p.id);
      await saveProfileForLater(state.profile.id, p.id, next);
      setSaved((ids) =>
        next ? [...ids, p.id] : ids.filter((id) => id !== p.id),
      );
      if (section === "saved" && !next) await state.load(section);
    } catch (e) {
      setLocalError(errorMessage(e, "Couldn’t save. Try again."));
    } finally {
      setBusy(null);
      actionInFlight.current = false;
    }
  };
  const undo = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy("undo");
    try {
      await undoLastPass();
      await state.load(section);
    } catch (e) {
      setLocalError(errorMessage(e, "Couldn’t undo. Try again."));
    } finally {
      setBusy(null);
      actionInFlight.current = false;
    }
  };
  const changeMode = (mode: "discover" | "focus") => {
    if (busy || (mode === "discover" && !state.premium)) return;
    if (scrollRef.current) scrollPosition.current = scrollRef.current.scrollTop;
    useSanctuaryStore.setState({ discoveryMode: mode });
    state.setView(mode === "discover" ? "discover" : "gallery");
  };
  const actions = (p: UserProfile, floating = false) => (
    <div className={floating ? "focus-actions" : "flex items-center gap-3"}>
      <button
        type="button"
        disabled={!!busy || (state.locked && !state.premium)}
        aria-label={`Pass on ${p.name}`}
        onClick={() => void decide(p, "pass")}
        className={
          floating
            ? "glass-decision pass"
            : "decision-button bg-white text-midnight border border-midnight/15"
        }
      >
        <X className="h-5 w-5" />
        <span className={floating ? "sr-only" : ""}>Pass</span>
      </button>
      <button
        type="button"
        disabled={!!busy || (state.locked && !state.premium)}
        aria-label={`Like ${p.name}`}
        onClick={() => void decide(p, "like")}
        className={
          floating
            ? "glass-decision like"
            : "decision-button bg-sageDeep text-white"
        }
      >
        <Heart className="h-5 w-5" />
        <span className={floating ? "sr-only" : ""}>
          {busy === p.id ? "Saving…" : "Like"}
        </span>
      </button>
      <button
        type="button"
        disabled={!!busy}
        aria-label={`${saved.includes(p.id) ? "Unsave" : "Save"} ${p.name}`}
        aria-pressed={saved.includes(p.id)}
        onClick={() => void toggleSave(p)}
        className={
          floating
            ? "glass-save"
            : "min-h-12 rounded-xl border border-midnight/15 px-3 text-sageDeep"
        }
      >
        <Bookmark
          className="h-5 w-5"
          fill={saved.includes(p.id) ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
  const fullProfile = (p: UserProfile, showActions = true, focus = false) => (
    <div>
      <div
        className={
          focus
            ? "focus-photo"
            : "relative aspect-[4/3] sm:aspect-[4/5] overflow-hidden rounded-2xl bg-midnight/10"
        }
      >
        {p.photos[0] ? (
          <OptimizedImage
            src={p.photos[0]}
            alt={p.name}
            srcWidth={960}
            sizes="(min-width: 768px) 600px, 100vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            Photo unavailable
          </div>
        )}
        {focus && (
          <div className="focus-identity">
            <BrandLogo className="mb-3 h-8 w-8 rounded-full" />
            <h2>
              {p.name}
              <span>, {p.age}</span>
            </h2>
            <p>
              <MapPin size={13} />
              {p.distance}
            </p>
          </div>
        )}
      </div>
      <div className="p-5 sm:p-7">
        {!focus && (
          <>
            <h2 className="font-serif text-3xl">
              {p.name}, {p.age}
            </h2>
            <p className="mt-2 flex items-center gap-1 text-sm text-midnight/65">
              <MapPin className="h-4 w-4" />
              {p.distance}
            </p>
          </>
        )}
        <p className="mt-4 text-lg">{p.ritualAnswers[1]}</p>
        <Alignment profile={p} />
        {p.photos.length > 1 && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {p.photos.slice(1).map((photo, i) => (
              <OptimizedImage
                key={photo}
                src={photo}
                alt={`${p.name}, photo ${i + 2}`}
                srcWidth={480}
                className="aspect-[3/4] w-full rounded-xl object-cover"
              />
            ))}
          </div>
        )}
        <div className="mt-6 rounded-xl bg-sandstone p-4">
          <h3 className="font-semibold">Boundary</h3>
          <p className="mt-2 text-sm leading-6">
            {p.boundary || "No boundary shared yet."}
          </p>
        </div>
        <dl className="my-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-midnight/60">Value</dt>
            <dd className="mt-1 font-medium">
              {p.ritualAnswers[6] || "Not shared"}
            </dd>
          </div>
          <div>
            <dt className="text-midnight/60">Here for</dt>
            <dd className="mt-1 font-medium">
              {p.ritualAnswers[10] || "Not shared"}
            </dd>
          </div>
        </dl>
        {showActions && actions(p)}
        <div className="mt-4">
          <MemberSafety
            target={p.id}
            name={p.name}
            onBlocked={() => setDetail(null)}
          />
        </div>
      </div>
    </div>
  );
  return (
    <div
      className={`luxury-gallery flex h-full min-h-0 flex-col text-midnight ${mode === "focus" && section === "discover" ? "is-focus" : ""}`}
    >
      <header className="glass-toolbar shrink-0 px-5 py-4 sm:px-8 sm:py-5">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
          <div>
            <BrandLogo className="mb-2 h-9 w-9" />
            <h1 className="mt-2 font-serif text-2xl sm:text-4xl">
              {section === "likes"
                ? "Likes"
                : section === "saved"
                  ? "Saved"
                  : mode === "focus"
                    ? "Focus"
                    : "Discover"}
            </h1>
            <p className="mt-2 text-sm text-midnight/65">
              {state.premium
                ? "Premium · Unlimited"
                : `${Math.max(0, 10 - state.used)} left today`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Open discovery preferences"
            onClick={() => setFilters(true)}
            className="mt-2 min-h-11 rounded-xl border border-midnight/15 p-3"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto mt-5 flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Discovery mode"
            className="inline-flex rounded-xl bg-midnight/5 p-1"
          >
            {(state.premium && section === "discover"
              ? (["discover", "focus"] as const)
              : []
            ).map((mode) => (
              <button
                type="button"
                key={mode}
                aria-pressed={viewMode === mode}
                disabled={!!busy}
                onClick={() => changeMode(mode)}
                className={`min-h-10 rounded-lg px-4 text-sm font-medium ${viewMode === mode ? "bg-white text-sageDeep shadow-sm" : "text-midnight/65"}`}
              >
                {mode === "discover" ? "Discover" : "Focus"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => state.setView("saved")}
              aria-label="Saved profiles"
              className="min-h-11 px-2 sm:px-3 text-sm"
            >
              <Bookmark className="mr-1 inline h-4 w-4" />
              <span className="hidden sm:inline">Saved</span>
            </button>
            {state.premium && mode !== "focus" && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void undo()}
                className="min-h-11 px-3 text-sm"
              >
                <Undo2 className="mr-1 inline h-4 w-4" />
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (state.credits > 0) void state.activate();
                else useSanctuaryStore.setState({ showBoostPromo: true });
              }}
              className="min-h-11 rounded-xl bg-sage/10 px-3 text-sm text-sageDeep"
            >
              <Zap className="mr-1 inline h-4 w-4" />
              {state.activeUntil && new Date(state.activeUntil) > new Date()
                ? "Boost active"
                : state.credits
                  ? `Boost ×${state.credits}`
                  : "Boost"}
            </button>
          </div>
        </div>
      </header>
      <div
        ref={scrollRef}
        className="gallery-stage min-h-0 flex-1 overflow-y-auto p-5 sm:p-8"
      >
        {localError && (
          <p
            role="alert"
            className="mx-auto mb-4 max-w-6xl rounded-xl bg-red-50 p-3 text-sm text-red-800"
          >
            {localError}
          </p>
        )}
        {section === "likes" && !state.premium ? (
          <Empty
            title="Likes, unlocked"
            text="Premium gives you a dedicated Likes You section. Like someone back to create a mutual match."
          >
            <Button onClick={() => state.setView("pricing")}>
              Explore Premium
            </Button>
          </Empty>
        ) : state.profile?.discoveryPaused ? (
          <Empty
            title="Paused"
            text="Your existing conversations remain available. Resume discovery from your profile."
          >
            <Button onClick={() => state.setView("profile")}>
              Manage profile
            </Button>
          </Empty>
        ) : !held &&
          state.locked &&
          !state.premium &&
          section === "discover" ? (
          <Empty
            title="See you tomorrow"
            text={`You can keep chatting with your matches. Your decisions reset at ${state.reset ? new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", hour: "numeric", minute: "2-digit" }).format(new Date(state.reset)) : "midnight"} Kenya time.`}
          >
            <Button onClick={() => state.setView("parlor")}>Messages</Button>
            <Button variant="outline" onClick={() => state.setView("pricing")}>
              Premium
            </Button>
          </Empty>
        ) : !held && state.loading && !held && !state.profiles.length ? (
          <div
            aria-label="Loading profiles"
            className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white p-4">
                <div className="aspect-[4/5] rounded-xl bg-midnight/10" />
                <div className="mt-4 h-5 w-2/3 rounded bg-midnight/10" />
              </div>
            ))}
          </div>
        ) : !held && !state.profiles.length ? (
          <Empty
            title={
              state.error
                ? "Profiles couldn’t load"
                : section === "saved"
                  ? "Nothing saved yet"
                  : section === "likes"
                    ? "No likes yet"
                    : "You're caught up"
            }
            text={
              state.error
                ? "Check your connection and try again."
                : section === "saved"
                  ? "Save someone from Discover to consider them later."
                  : section === "likes"
                    ? "Keep meeting people and sharing thoughtful interests."
                    : "Try another town or a wider age range, or return as new members join."
            }
          >
            <Button onClick={() => void state.load(section)}>Refresh</Button>
            <Button variant="outline" onClick={() => setFilters(true)}>
              Filters
            </Button>
          </Empty>
        ) : mode === "focus" && current ? (
          <div className="focus-deck">
            <div className="glass-echo" aria-hidden="true" />
            <motion.article
              key={current.id}
              initial={false}
              animate={controls}
              className={`focus-glass ${reaction ? `react-${reaction}` : ""}`}
              aria-label={`${current.name}'s profile`}
              aria-busy={!!busy}
            >
              <div className="focus-scroll" key={current.id}>
                {fullProfile(current, false, true)}
              </div>
              {reaction && (
                <div className="reaction-seal" aria-hidden="true">
                  {reaction === "like" ? <Heart fill="currentColor" /> : <X />}
                </div>
              )}
              {actions(current, true)}
            </motion.article>
            <p className="focus-caption">One connection at a time.</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false} custom={exitDirection}>
              {state.profiles.map((p) => (
                <motion.article
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  custom={exitDirection}
                  exit="exit"
                  variants={{
                    exit: (direction: "like" | "pass") => ({
                      opacity: 0,
                      x: reduceMotion ? 0 : direction === "like" ? 70 : -70,
                      rotate: reduceMotion ? 0 : direction === "like" ? 3 : -3,
                      transition: { duration: reduceMotion ? 0 : 0.25 },
                    }),
                  }}
                  key={p.id}
                  className="discover-glass overflow-hidden rounded-3xl"
                >
                  <button
                    type="button"
                    aria-label={`View ${p.name}'s profile`}
                    onClick={() => {
                      if (state.premium && section === "discover")
                        useSanctuaryStore.setState({ focusedProfileId: p.id });
                      setDetail(p);
                    }}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[4/5] overflow-hidden bg-midnight/10">
                      {p.photos[0] && (
                        <OptimizedImage
                          src={p.photos[0]}
                          alt={p.name}
                          srcWidth={640}
                          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="px-5 pt-5">
                      <h2 className="font-serif text-2xl">
                        {p.name}, {p.age}
                      </h2>
                      <p className="mt-1 text-sm text-midnight/60">
                        {p.distance}
                      </p>
                      <p className="mt-3 text-sm font-medium">
                        {p.ritualAnswers[1]}
                      </p>
                    </div>
                  </button>
                  <div className="p-5 pt-2">
                    <Alignment profile={p} />
                    <div className="mt-4">
                      {state.premium ? (
                        actions(p)
                      ) : (
                        <button
                          onClick={() => void toggleSave(p)}
                          className="glass-pill"
                        >
                          Unsave
                        </button>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        )}
        {mode !== "focus" &&
          state.hasMore &&
          state.profiles.length > 0 &&
          !(section === "likes" && !state.premium) &&
          !(state.locked && !state.premium) && (
            <div ref={loadMoreRef} className="mt-8 text-center">
              <Button
                variant="outline"
                disabled={state.loading}
                onClick={() => void state.load(section, true)}
              >
                {state.loading ? "Loading…" : "More"}
              </Button>
            </div>
          )}
      </div>

      {detail && (
        <Modal
          titleId="profile-details"
          onClose={() => setDetail(null)}
          className="max-w-xl"
        >
          <div className="flex items-center justify-between p-4">
            <h2 id="profile-details" className="text-sm font-medium">
              {detail.name}
            </h2>
            <button
              type="button"
              aria-label="Close profile"
              onClick={() => setDetail(null)}
              className="min-h-11 p-3"
            >
              <X />
            </button>
          </div>
          {fullProfile(detail, state.premium)}
        </Modal>
      )}
      {filters && state.profile && (
        <DiscoveryFilters
          profileId={state.profile.id}
          premium={state.premium}
          onClose={() => setFilters(false)}
          onSaved={() => void state.load(section)}
        />
      )}
      {match && (
        <Modal
          titleId="new-match"
          onClose={() => setMatch(null)}
          className="max-w-md p-8 text-center"
        >
          <Heart className="mx-auto h-12 w-12 text-sageDeep" />
          <h2 id="new-match" className="mt-5 font-serif text-3xl">
            A match
          </h2>
          <p className="my-4 text-midnight/75">
            You and {match.name} liked each other. Start with something
            meaningful.
          </p>
          <Button
            fullWidth
            onClick={() => {
              useSanctuaryStore.setState({
                selectedChatId: match.id,
                view: "parlor",
              });
              setMatch(null);
            }}
          >
            Say hello
          </Button>
          <Button
            fullWidth
            variant="outline"
            className="mt-3"
            onClick={() => setMatch(null)}
          >
            Continue
          </Button>
        </Modal>
      )}
    </div>
  );
};
const Alignment = ({ profile }: { profile: UserProfile }) => (
  <div className="mt-4">
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sageDeep">
      <Sparkles className="h-3.5 w-3.5" />
      In common
    </h3>
    <div className="mt-2 flex flex-wrap gap-2">
      {profile.alignmentReasons.length ? (
        profile.alignmentReasons.map((reason) => (
          <span
            key={reason}
            className="rounded-lg bg-sage/10 px-2.5 py-1.5 text-xs text-midnight"
          >
            {reason}
          </span>
        ))
      ) : (
        <p className="text-xs text-midnight/60">
          Explore their answers and decide what matters to you.
        </p>
      )}
    </div>
  </div>
);
const Empty = ({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) => (
  <div className="mx-auto flex min-h-[45vh] max-w-lg flex-col items-center justify-center text-center">
    <Sparkles className="mb-5 h-8 w-8 text-sageDeep" />
    <h2 className="font-serif text-3xl">{title}</h2>
    <p className="mt-4 leading-7 text-midnight/70">{text}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
  </div>
);
