import { useEffect, useState } from "react";
import { getPreferences, savePreferences } from "../lib/api";
import { TOWN_OPTIONS } from "../lib/towns";
import { RITUAL_QUESTIONS } from "../lib/ritual";
import type { MemberPreferences } from "../types";
import { Modal } from "./Modal";
import { Button } from "./Button";

export const DiscoveryFilters = ({
  profileId,
  premium,
  onClose,
  onSaved,
}: {
  profileId: string;
  premium: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [prefs, setPrefs] = useState<MemberPreferences | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void getPreferences(profileId)
      .then((p) => {
        if (active) setPrefs(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [profileId]);
  const save = async () => {
    if (!prefs) return;
    if (
      prefs.min_age < 18 ||
      prefs.max_age < prefs.min_age ||
      prefs.max_age > 120
    ) {
      setError("Choose an age range between 18 and 120.");
      return;
    }
    setBusy(true);
    try {
      await savePreferences(prefs);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save preferences.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      titleId="discovery-filters"
      onClose={onClose}
      className="max-w-lg p-6"
    >
      <h2 id="discovery-filters" className="font-serif text-3xl">
        Your preferences
      </h2>
      <p className="mt-2 text-sm text-midnight/70">
        Choose who you'd like to discover. Your Ritual still shapes
        compatibility.
      </p>
      {prefs ? (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {(["min_age", "max_age"] as const).map((key) => (
              <label key={key} className="text-sm">
                {key === "min_age" ? "Minimum age" : "Maximum age"}
                <input
                  type="number"
                  min={18}
                  max={120}
                  value={prefs[key]}
                  onChange={(e) =>
                    setPrefs({ ...prefs, [key]: Number(e.target.value) })
                  }
                  className="mt-2 w-full rounded-xl border border-midnight/15 p-3"
                />
              </label>
            ))}
          </div>
          <label className="block text-sm">
            Town
            <select
              value={prefs.town}
              onChange={(e) => setPrefs({ ...prefs, town: e.target.value })}
              className="mt-2 w-full rounded-xl border border-midnight/15 p-3"
            >
              <option value="">Any town</option>
              {TOWN_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          {(
            [
              { key: "intent", question: 1, label: "Relationship intention" },
              { key: "core_value", question: 6, label: "Core value" },
            ] as const
          ).map(({ key, question, label }) => (
            <label key={key} className="block text-sm">
              {label} {!premium && "· Premium"}
              <select
                disabled={!premium}
                value={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.value })}
                className="mt-2 w-full rounded-xl border border-midnight/15 p-3 disabled:opacity-50"
              >
                <option value="">Any</option>
                {RITUAL_QUESTIONS.find((q) => q.id === question)?.options?.map(
                  (o) => (
                    <option key={o}>{o}</option>
                  ),
                )}
              </select>
            </label>
          ))}
          <Button disabled={busy} fullWidth onClick={() => void save()}>
            {busy ? "Saving…" : "Apply preferences"}
          </Button>
        </div>
      ) : (
        <p className="mt-4">
          {error ? "Preferences unavailable." : "Loading preferences…"}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </Modal>
  );
};
