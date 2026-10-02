import { useState } from "react";
import { updatePassword } from "../lib/api";
import { useSanctuaryStore } from "../store";
import { Button } from "./Button";
export const PasswordRecovery = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) {
      setError("Use at least 8 characters and matching passwords.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      window.history.replaceState(null, "", "/");
      await useSanctuaryStore.getState().bootstrapAuthenticatedState();
      useSanctuaryStore.setState({ infoMessage: "Password updated." });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to update password. Request a new recovery link.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sandstone p-6">
      <form
        onSubmit={(e) => void save(e)}
        className="w-full max-w-md rounded-2xl border border-midnight/10 bg-white p-7"
      >
        <h1 className="font-serif text-3xl">Choose a new password</h1>
        <p className="mt-3 text-sm text-midnight/70">
          Use at least 8 characters.
        </p>
        <label className="mt-6 block text-sm">
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border p-3"
          />
        </label>
        <label className="mt-4 block text-sm">
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-2 w-full rounded-xl border p-3"
          />
        </label>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-6" fullWidth disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
};
