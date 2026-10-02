import { useEffect, useState } from "react";
import {
  getPreferences,
  savePreferences,
  setDiscoveryPaused,
  deleteMyAccount,
} from "../lib/api";
import { useSanctuaryStore } from "../store";
import type { MemberPreferences } from "../types";
import { Button } from "./Button";
import { Modal } from "./Modal";

export const AccountSettings = () => {
  const profile = useSanctuaryStore((s) => s.currentProfile);
  const [prefs, setPrefs] = useState<MemberPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    let active = true;
    if (profile)
      void getPreferences(profile.id)
        .then((p) => {
          if (active) setPrefs(p);
        })
        .catch(() => {
          if (active)
            setMessage("Settings could not load. Reload and try again.");
        });
    return () => {
      active = false;
    };
  }, [profile?.id]);
  if (!profile) return null;
  const save = async (next: MemberPreferences) => {
    setBusy(true);
    try {
      await savePreferences(next);
      setPrefs(next);
      setMessage("Settings saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  };
  const pause = async () => {
    setBusy(true);
    try {
      await setDiscoveryPaused(profile.id, !profile.discoveryPaused);
      useSanctuaryStore.setState({
        currentProfile: {
          ...profile,
          discoveryPaused: !profile.discoveryPaused,
        },
        galleryLoaded: false,
      });
      setMessage(
        profile.discoveryPaused
          ? "Your profile is visible again."
          : "Discovery paused. Your chats remain available.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await deleteMyAccount();
      await useSanctuaryStore.getState().signOut();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to delete account.");
      setDeleting(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="luxury-panel mt-6 space-y-5 p-6">
      <h2 className="font-serif text-2xl">Settings</h2>
      <div>
        <p className="text-sm">
          {profile.isPremium
            ? `Premium active${profile.premiumExpiresAt ? ` until ${new Date(profile.premiumExpiresAt).toLocaleDateString()}` : ""}`
            : "Free · 10 decisions per day"}
        </p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => useSanctuaryStore.getState().setView("pricing")}
        >
          Manage pass
        </Button>
      </div>
      {prefs && (
        <div className="space-y-3">
          {(
            [
              { key: "notify_matches", label: "Notify me about new matches" },
              { key: "notify_messages", label: "Notify me about messages" },
              {
                key: "incognito",
                label: "Incognito · only people I like can see me (Premium)",
              },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                disabled={busy || (key === "incognito" && !profile.isPremium)}
                checked={prefs[key]}
                onChange={(e) =>
                  void save({ ...prefs, [key]: e.target.checked })
                }
                className="h-5 w-5 accent-pink-700"
              />
              {label}
            </label>
          ))}
          <p className="text-xs text-midnight/60">
            Notifications appear while Niwangu is open. Browser alerts require
            your permission.
          </p>
          {"Notification" in window && (
            <Button
              variant="outline"
              onClick={() =>
                void Notification.requestPermission().then((permission) =>
                  setMessage(
                    permission === "granted"
                      ? "Browser alerts enabled."
                      : "Browser alerts were not enabled.",
                  ),
                )
              }
            >
              Enable browser alerts
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={busy} onClick={() => void pause()}>
          {profile.discoveryPaused ? "Resume discovery" : "Pause discovery"}
        </Button>
        <Button
          variant="outline"
          onClick={() => useSanctuaryStore.getState().setView("ritual")}
        >
          Edit compatibility answers
        </Button>
        <Button
          variant="outline"
          onClick={() => void useSanctuaryStore.getState().signOut()}
        >
          Sign out
        </Button>
      </div>
      <p className="text-sm text-midnight/70">
        Need help?{" "}
        <a className="underline" href="mailto:support@niwangu.com">
          Contact support
        </a>
        .
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={() => setDeleting(true)}
        className="min-h-11 text-sm text-red-800 underline"
      >
        Delete my account
      </button>
      {deleting && (
        <Modal
          titleId="delete-account"
          onClose={() => {
            if (!busy) setDeleting(false);
          }}
          className="max-w-md p-6"
        >
          <h2 id="delete-account" className="font-serif text-2xl">
            Delete your account?
          </h2>
          <p className="my-4 text-sm leading-6">
            This permanently removes your profile, photos, matches, and
            messages. It cannot be undone. Type DELETE to confirm.
          </p>
          <label className="text-sm">
            Confirmation
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="my-3 w-full rounded-xl border p-3"
              autoComplete="off"
            />
          </label>
          <Button
            disabled={busy || confirmation !== "DELETE"}
            onClick={() => void remove()}
          >
            {busy ? "Deleting…" : "Permanently delete account"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            className="mt-3"
            onClick={() => setDeleting(false)}
          >
            Keep account
          </Button>
        </Modal>
      )}
    </section>
  );
};
