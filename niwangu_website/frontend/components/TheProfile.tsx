import { useEffect, useState, type FC, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, Camera } from "lucide-react";
import { useSanctuaryStore } from "../store";
import { Button } from "./Button";
import type { Gender } from "../types";
import { TOWN_OPTIONS, normalizeTown } from "../lib/towns";
import { RITUAL_QUESTIONS } from "../lib/ritual";
import { ModeratorPanel } from "./ModeratorPanel";
import { AccountSettings } from "./AccountSettings";
import { OptimizedImage } from "./OptimizedImage";

export const TheProfile: FC = () => {
  const {
    currentProfile,
    photos,
    isBusy,
    updateProfile,
    refreshPhotos,
    setView,
  } = useSanctuaryStore(
    useShallow((state) => ({
      currentProfile: state.currentProfile,
      photos: state.photos,
      isBusy: state.isBusy,
      updateProfile: state.updateProfile,
      refreshPhotos: state.refreshPhotos,
      setView: state.setView,
    })),
  );

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("female");
  const [seekingGender, setSeekingGender] = useState<Gender>("male");
  const [location, setLocation] = useState("");
  const [intent, setIntent] = useState("");
  const [coreValue, setCoreValue] = useState("");
  const [whyNiwangu, setWhyNiwangu] = useState("");
  const [boundary, setBoundary] = useState("");
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  useEffect(() => {
    void refreshPhotos();
  }, [refreshPhotos]);

  useEffect(() => {
    if (!currentProfile) {
      return;
    }

    setName(currentProfile.name);
    setAge(currentProfile.age ? String(currentProfile.age) : "");
    setGender(currentProfile.gender || "female");
    setSeekingGender(currentProfile.seekingGender || "male");
    setLocation(normalizeTown(currentProfile.location));
    setIntent(currentProfile.intent);
    setCoreValue(currentProfile.coreValue);
    setWhyNiwangu(currentProfile.whyNiwangu);
    setBoundary(currentProfile.boundary);
  }, [currentProfile]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedAge = Number(age);
    const validationErrors = [
      name.trim().length < 2 ? "Full name must be at least 2 characters." : "",
      !Number.isFinite(parsedAge) || parsedAge < 18
        ? "Age must be 18 or older."
        : "",
      !location ? "Select your town." : "",
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      setLocalErrors(validationErrors);
      return;
    }

    setLocalErrors([]);
    await updateProfile({
      name: name.trim(),
      age: parsedAge,
      gender,
      seekingGender,
      location: location.trim(),
      intent: intent.trim(),
      coreValue: coreValue.trim(),
      whyNiwangu: whyNiwangu.trim(),
      boundary: boundary.trim(),
    });
  };

  if (!currentProfile) {
    return (
      <div className="min-h-dvh bg-sandstone p-6 text-midnight">
        <p className="text-midnight/80">Loading profile...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-dvh bg-sandstone p-6 text-midnight"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                setView(currentProfile.profileReady ? "gallery" : "essence")
              }
              aria-label="Go back"
              className="rounded-full p-2 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <div>
              <h2 className="font-serif text-4xl">Profile</h2>
              <p className="text-sm text-midnight/80">
                Your details. Your story.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="luxury-panel p-5">
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((slot) => {
                const photo = photos.find((item) => item.sortOrder === slot);

                return (
                  <div
                    key={slot}
                    className="aspect-[3/4] overflow-hidden rounded-md bg-midnight/10"
                  >
                    {photo ? (
                      <OptimizedImage
                        src={photo.url}
                        alt="Profile"
                        srcWidth={320}
                        srcSetWidths={[240, 320, 480]}
                        sizes="110px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-midnight/35">
                        <Camera className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              fullWidth
              variant="outline"
              onClick={() => setView("essence")}
            >
              Edit Photos
            </Button>
            <p className="mt-4 text-sm leading-6 text-midnight/70">
              Choose a clear recent face photo, add something you enjoy doing,
              and let your answers show what matters to you.
            </p>
          </aside>

          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="luxury-panel p-6"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Full Name" value={name} onChange={setName} />
              <Field label="Age" value={age} onChange={setAge} type="number" />

              <label className="flex flex-col gap-2 text-sm font-medium text-midnight/80">
                Gender
                <select
                  value={gender}
                  onChange={(event) => setGender(event.target.value as Gender)}
                  className="rounded-md border border-midnight/15 bg-white/60 px-3 py-3 text-midnight focus:outline-none focus:border-sage"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-midnight/80">
                Looking For
                <select
                  value={seekingGender}
                  onChange={(event) =>
                    setSeekingGender(event.target.value as Gender)
                  }
                  className="rounded-md border border-midnight/15 bg-white/60 px-3 py-3 text-midnight focus:outline-none focus:border-sage"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>

              <div className="md:col-span-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-midnight/80">
                  Town
                  <select
                    value={location}
                    onChange={(event) => {
                      setLocation(event.target.value);
                      if (localErrors.length) setLocalErrors([]);
                    }}
                    className="rounded-md border border-midnight/15 bg-white/60 px-3 py-3 text-midnight focus:outline-none focus:border-sage"
                  >
                    <option value="">Select your town</option>
                    {location && !TOWN_OPTIONS.includes(location) && (
                      <option value={location}>{location}</option>
                    )}
                    {TOWN_OPTIONS.map((town) => (
                      <option key={town} value={town}>
                        {town}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ChoiceField
                label="Intention"
                question={1}
                value={intent}
                onChange={setIntent}
              />
              <ChoiceField
                label="Core value"
                question={6}
                value={coreValue}
                onChange={setCoreValue}
              />

              <ChoiceField
                label="Why Niwangu"
                question={10}
                value={whyNiwangu}
                onChange={setWhyNiwangu}
              />

              <label className="flex flex-col gap-2 text-sm font-medium text-midnight/80 md:col-span-2">
                Boundary
                <textarea
                  maxLength={200}
                  value={boundary}
                  onChange={(event) => setBoundary(event.target.value)}
                  className="min-h-28 rounded-md border border-midnight/15 bg-white/60 px-3 py-3 text-midnight focus:outline-none focus:border-sage"
                />
              </label>
            </div>

            {localErrors.length > 0 && (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-red-900">
                {localErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={isBusy}>
                {isBusy ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
        <AccountSettings />
        <ModeratorPanel />
      </div>
    </motion.div>
  );
};

const Field: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}> = ({ label, value, onChange, type = "text" }) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-midnight/80">
    {label}
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-md border border-midnight/15 bg-white/60 px-3 py-3 text-midnight focus:outline-none focus:border-sage"
    />
  </label>
);

const ChoiceField = ({
  label,
  question,
  value,
  onChange,
}: {
  label: string;
  question: number;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-midnight/80">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-midnight/15 bg-white/60 px-3 py-3"
    >
      <option value="">Select an answer</option>
      {RITUAL_QUESTIONS.find((q) => q.id === question)?.options?.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  </label>
);
