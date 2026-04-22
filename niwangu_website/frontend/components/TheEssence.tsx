import type { ChangeEvent, FC } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { Plus, X } from 'lucide-react';
import { ProfilePhoto } from '../types';

const createDemoPhotoFile = (slot: number) => {
  const hue = 340 + slot * 12;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(${hue}, 75%, 78%)" />
          <stop offset="100%" stop-color="hsl(${hue - 18}, 40%, 28%)" />
        </linearGradient>
      </defs>
      <rect width="1200" height="1600" fill="url(#bg)" />
      <circle cx="600" cy="520" r="210" fill="rgba(255,255,255,0.2)" />
      <rect x="250" y="910" width="700" height="320" rx="64" fill="rgba(255,255,255,0.12)" />
      <text x="600" y="1040" text-anchor="middle" fill="white" font-family="Georgia, serif" font-size="72">
        Niwangu
      </text>
      <text x="600" y="1120" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="Inter, sans-serif" font-size="32">
        Demo Essence ${slot + 1}
      </text>
    </svg>
  `;

  return new File([svg], `niwangu-demo-${slot + 1}.svg`, {
    type: 'image/svg+xml',
  });
};

export const TheEssence: FC = () => {
  const { photos, uploadPhoto, removePhoto, completePhotoStep, isBusy } = useSanctuaryStore(useShallow((state) => ({
    photos: state.photos,
    uploadPhoto: state.uploadPhoto,
    removePhoto: state.removePhoto,
    completePhotoStep: state.completePhotoStep,
    isBusy: state.isBusy,
  })));

  const photoBySlot = (index: number) => photos.find((photo) => photo.sortOrder === index) ?? null;

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, slot: number) => {
    if (!e.target.files?.[0]) {
      return;
    }

    await uploadPhoto(e.target.files[0], slot);
    e.target.value = '';
  };

  const handleRemove = async (photo: ProfilePhoto) => {
    await removePhoto(photo);
  };

  const addDemoPhoto = async (slot: number) => {
    await uploadPhoto(createDemoPhotoFile(slot), slot);
  };

  return (
    <motion.div className="min-h-screen bg-sandstone flex flex-col p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col justify-center">
        <h2 className="font-serif text-4xl text-midnight mb-2">The Essence</h2>
        <p className="text-midnight/70 mb-8 font-light">
          Upload exactly 3 images and store them in Supabase Storage.
          <br />
          <span className="text-xs opacity-60">Demo photos now upload generated placeholder artwork into your bucket.</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[0, 1, 2].map((index) => {
            const photo = photoBySlot(index);

            return (
              <div
                key={index}
                className="aspect-[3/4] relative rounded-xl overflow-hidden bg-midnight/5 border-2 border-dashed border-midnight/20 hover:border-sage transition-colors group"
              >
                {photo ? (
                  <>
                    <img src={photo.url} alt="Essence" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        void handleRemove(photo);
                      }}
                      className="absolute top-2 right-2 bg-midnight/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <label className="cursor-pointer flex flex-col items-center">
                      <div className="p-4 bg-white/50 rounded-full mb-2 group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-midnight" />
                      </div>
                      <span className="text-sm font-medium text-midnight/60">Upload Photo</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(event) => {
                          void handleFileUpload(event, index);
                        }}
                      />
                    </label>
                    <button
                      onClick={() => {
                        void addDemoPhoto(index);
                      }}
                      className="text-xs text-sage underline"
                    >
                      Use Demo Photo
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button
            disabled={photos.length !== 3 || isBusy}
            onClick={() => {
              void completePhotoStep();
            }}
            className="w-full md:w-auto"
          >
            {isBusy ? 'Saving...' : 'Enter The Gallery'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
