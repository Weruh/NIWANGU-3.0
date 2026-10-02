import { useState } from "react";
import { Shield } from "lucide-react";
import { blockMember, reportMember } from "../lib/api";
import { useSanctuaryStore } from "../store";
import { Modal } from "./Modal";
import { Button } from "./Button";

export const MemberSafety = ({
  target,
  name,
  onBlocked,
}: {
  target: string;
  name: string;
  onBlocked?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reported, setReported] = useState(false);
  const act = async (block: boolean) => {
    setBusy(true);
    setError("");
    try {
      if (block) {
        await blockMember(target);
        useSanctuaryStore.setState((s) => ({
          galleryProfiles: s.galleryProfiles.filter((p) => p.id !== target),
          activeChats: s.activeChats.filter((c) => c.partnerId !== target),
        }));
        setOpen(false);
        onBlocked?.();
      } else {
        await reportMember(target, reason);
        setReported(true);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to complete this action. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        aria-label={`Safety options for ${name}`}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-midnight/70 hover:bg-midnight/5"
      >
        <Shield className="h-4 w-4" />
        Safety
      </button>
      {open && (
        <Modal
          titleId={`safety-${target}`}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          className="max-w-md p-6"
        >
          <h2 id={`safety-${target}`} className="font-serif text-2xl">
            Your safety comes first
          </h2>
          <p className="my-3 text-sm text-midnight/75">
            Blocking {name} ends your connection and prevents further contact.
            They won't be told who submitted a report.
          </p>
          {reported ? (
            <p role="status" className="my-4 rounded-xl bg-sage/10 p-4">
              Your report has been submitted for review.
            </p>
          ) : (
            <>
              <label className="block text-sm">
                What happened?
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                  className="mt-2 min-h-28 w-full rounded-xl border border-midnight/20 p-3"
                  placeholder="Tell us what happened so the team can review it."
                />
              </label>
              <Button
                className="mt-3"
                disabled={busy || reason.trim().length < 5}
                onClick={() => void act(false)}
              >
                Submit report
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void act(true)}
            >
              Block member
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};
