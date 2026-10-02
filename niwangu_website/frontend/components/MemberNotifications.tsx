import { useEffect } from "react";
import { getSupabase } from "../lib/supabase";
import { getPreferences, getMyProfile, getProfileViewStatus } from "../lib/api";
import { useSanctuaryStore } from "../store";

export const MemberNotifications = () => {
  const profileId = useSanctuaryStore((s) => s.currentProfile?.id);
  useEffect(() => {
    if (!profileId) return;
    let active = true;
    const client = getSupabase();
    const announce = async (kind: "match" | "message", text: string) => {
      try {
        const prefs = await getPreferences(profileId);
        if (
          !active ||
          !(kind === "match" ? prefs.notify_matches : prefs.notify_messages)
        )
          return;
        useSanctuaryStore.setState({ infoMessage: text });
        if (
          document.hidden &&
          "Notification" in window &&
          Notification.permission === "granted"
        )
          new Notification("Niwangu", { body: text });
      } catch {
        /* Preferences unavailable: do not send unsolicited alerts. */
      }
    };
    const refresh = async () => {
      try {
        const [profile, status] = await Promise.all([
          getMyProfile(),
          getProfileViewStatus(),
        ]);
        if (active && profile?.id === profileId)
          useSanctuaryStore.setState({
            currentProfile: profile,
            isPremium: profile.isPremium,
            paymentRequired: status.isLocked && !profile.isPremium,
            profileViewsUsed: status.usedViews,
            profileViewLockUntil: status.lockedUntil,
            boostCredits: profile.boostCredits,
            boostActiveUntil: profile.boostActiveUntil,
          });
      } catch {
        /* A later refresh retries transient failures. */
      }
    };
    const onVisibility = () => {
      if (!document.hidden) {
        void refresh();
        void useSanctuaryStore.getState().loadChats();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const refreshTimer = setInterval(() => void refresh(), 60000);
    const channels = [
      ...["profile_low_id", "profile_high_id"].map((column) =>
        client
          .channel(`match-alert-${column}-${profileId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "matches",
              filter: `${column}=eq.${profileId}`,
            },
            () => {
              void useSanctuaryStore.getState().loadChats();
              void announce(
                "match",
                "You have a new mutual match. Open Messages to say hello.",
              );
            },
          )
          .subscribe(),
      ),
      client
        .channel(`message-alert-${profileId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            if (payload.new.sender_profile_id === profileId) return;
            void useSanctuaryStore.getState().loadChats();
            if (
              useSanctuaryStore.getState().selectedChatId !==
                payload.new.match_id ||
              useSanctuaryStore.getState().view !== "parlor"
            )
              void announce(
                "message",
                "You have a new message. Open Messages to read it.",
              );
          },
        )
        .subscribe(),
    ];
    return () => {
      active = false;
      clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      channels.forEach((c) => void client.removeChannel(c));
    };
  }, [profileId]);
  return null;
};
