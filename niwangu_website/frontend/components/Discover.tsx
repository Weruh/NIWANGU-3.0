import { LockKeyhole, UserRound } from "lucide-react";
import { useSanctuaryStore } from "../store";
import { BrandLogo } from "./BrandLogo";
import { Button } from "./Button";
import { TheGallery } from "./TheGallery";

export const Discover = () => {
  const premium = useSanctuaryStore((s) => s.isPremium);
  const setView = useSanctuaryStore((s) => s.setView);
  if (premium) return <TheGallery viewMode="discover" />;
  // Decorative silhouettes only: no member data is requested for the free preview.
  return (
    <section className="luxury-gallery flex h-full min-h-0 flex-col">
      <header className="glass-toolbar px-5 py-4 sm:px-8 sm:py-5">
        <BrandLogo className="mb-2 h-9 w-9" />
        <h1 className="font-serif text-2xl sm:text-4xl">Discover</h1>
        <p className="text-sm text-midnight/65">Made for Premium.</p>
      </header>
      <div className="discover-preview">
        <div className="preview-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`preview-card preview-tone-${i % 3}`}>
              <div className="preview-portrait">
                <UserRound strokeWidth={0.7} />
              </div>
              <div className="preview-lines">
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
        <div className="discover-unlock luxury-panel">
          <span className="unlock-icon">
            <LockKeyhole size={24} />
          </span>
          <h2 className="font-serif text-3xl">More possibilities.</h2>
          <p>Browse freely with Premium.</p>
          <Button onClick={() => setView("pricing")}>Unlock Discover</Button>
          <button
            className="mt-4 min-h-11 text-sm text-midnight/65"
            onClick={() => setView("gallery")}
          >
            Back to Focus
          </button>
        </div>
      </div>
    </section>
  );
};
