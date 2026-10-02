import { useEffect, useRef, useState, type FC } from "react";
import { useShallow } from "zustand/react/shallow";
import { Edit3, LogOut, UserCircle, MessageSquare, Sparkles } from "lucide-react";
import { useSanctuaryStore } from "../store";

export const ProfileMenu: FC<{
  light?: boolean;
  onOpenPaywall?: () => void;
}> = ({ light = false, onOpenPaywall }) => {
  const {
    currentProfile,
    activeChats,
    isPremium,
    dailyProfileViews,
    profileViewsUsed,
    paymentRequired,
    setView,
    signOut,
  } = useSanctuaryStore(
    useShallow((state) => ({
      currentProfile: state.currentProfile,
      activeChats: state.activeChats,
      isPremium: state.isPremium,
      dailyProfileViews: state.dailyProfileViews,
      profileViewsUsed: state.profileViewsUsed,
      paymentRequired: state.paymentRequired,
      setView: state.setView,
      signOut: state.signOut,
    })),
  );
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleChatsClick = () => {
    setOpen(false);
    setView("parlor");
  };

  const handleSubscriptionClick = () => {
    setOpen(false);
    if (onOpenPaywall) {
      onOpenPaywall();
    } else {
      setView("pricing");
    }
  };

  const remainingViews = Math.max(0, dailyProfileViews - profileViewsUsed);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
          light
            ? "border-white/20 bg-sandstone/10 text-white backdrop-blur-md hover:bg-sandstone/20"
            : "border-midnight/10 bg-white/45 text-midnight hover:bg-white/70"
        }`}
        aria-label="Open profile menu"
      >
        <UserCircle className="h-6 w-6" />
        {activeChats.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sandstone text-[10px] font-bold text-midnight shadow border border-midnight/20">
            {activeChats.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[70] mt-3 w-64 rounded-lg border border-midnight/10 bg-sandstone p-3 text-midnight shadow-xl">
          <div className="border-b border-midnight/10 px-2 pb-3">
            <p className="font-serif text-lg leading-tight">
              {currentProfile?.name || "Your Profile"}
            </p>
            <p className="text-xs text-midnight/80">
              {currentProfile?.location || "Niwangu account"}
            </p>
          </div>

          <div className="py-1 border-b border-midnight/10">
            <button
              onClick={handleChatsClick}
              className="flex w-full items-center justify-between rounded-md px-2 py-2.5 text-left text-sm hover:bg-midnight/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-midnight/80" />
                <span>Chats</span>
              </div>
              <span className="rounded-full bg-midnight/10 px-2 py-0.5 text-xs font-semibold text-midnight">
                {activeChats.length}
              </span>
            </button>

            <button
              onClick={handleSubscriptionClick}
              className="flex w-full items-center justify-between rounded-md px-2 py-2.5 text-left text-sm hover:bg-midnight/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-midnight/80" />
                <span>Subscription</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPremium ? 'bg-emerald-100 text-emerald-800' : 'bg-midnight/10 text-midnight/80'}`}>
                {isPremium ? 'Active' : `${remainingViews} decisions left`}
              </span>
            </button>
          </div>

          <div className="pt-1">
            <button
              onClick={() => {
                setOpen(false);
                setView("profile");
              }}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm hover:bg-midnight/5 transition-colors"
            >
              <Edit3 className="h-4 w-4 text-midnight/80" />
              <span>View and edit profile</span>
            </button>

            <button
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm text-red-900 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
