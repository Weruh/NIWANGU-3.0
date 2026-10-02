import {
  Compass,
  Layers,
  Heart,
  MessageCircle,
  UserRound,
  Bookmark,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useSanctuaryStore } from "../store";
import { BrandLogo } from "./BrandLogo";
import type { ViewState } from "../types";

export const AppNavigation = () => {
  const { view, setView, chats, premium } = useSanctuaryStore(
    useShallow((s) => ({
      view: s.view,
      setView: s.setView,
      chats: s.activeChats,
      premium: s.isPremium,
    })),
  );
  const unread = chats.reduce((sum, c) => sum + c.unreadCount, 0);
  const items: { view: ViewState; label: string; icon: typeof Compass }[] = [
    { view: "gallery", label: "Focus", icon: Layers },
    { view: "discover", label: "Discover", icon: Compass },
    ...(premium
      ? [{ view: "likes" as ViewState, label: "Likes", icon: Heart }]
      : [{ view: "saved" as ViewState, label: "Saved", icon: Bookmark }]),
    { view: "parlor", label: "Messages", icon: MessageCircle },
    { view: "profile", label: "Profile", icon: UserRound },
  ];
  return (
    <nav aria-label="Main navigation" className="app-navigation">
      <div className="hidden md:block px-5 pb-8">
        <BrandLogo className="h-16 w-16" />
        <p className="mt-2 text-xs text-midnight/65">Love, with intention.</p>
      </div>
      {items.map(({ view: destination, label, icon: Icon }) => (
        <button
          key={destination}
          type="button"
          aria-current={view === destination ? "page" : undefined}
          onClick={() => setView(destination)}
          className={`relative flex flex-1 flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 rounded-xl px-3 py-3 text-xs md:text-sm font-medium transition-colors ${view === destination ? "bg-sage/10 text-sageDeep" : "text-midnight/70 hover:bg-midnight/5"}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {label}
          {destination === "parlor" && unread > 0 && (
            <span className="rounded-full bg-sageDeep px-1.5 text-[10px] text-white">
              {unread}
            </span>
          )}
        </button>
      ))}
      {premium && (
        <button
          type="button"
          onClick={() => setView("saved")}
          aria-current={view === "saved" ? "page" : undefined}
          className="hidden md:flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-midnight/70 hover:bg-midnight/5"
        >
          <Bookmark className="h-5 w-5" />
          Saved
        </button>
      )}
    </nav>
  );
};
