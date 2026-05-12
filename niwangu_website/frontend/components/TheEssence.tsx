import type { ChangeEvent, FC } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { Plus, X } from 'lucide-react';
import { ProfilePhoto } from '../types';
import { OptimizedImage } from './OptimizedImage';

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

  return (
    <motion.div className="min-h-screen bg-sandstone flex flex-col p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col justify-center">
        <h2 className="font-serif text-4xl text-midnight mb-2">The Essence</h2>
        <p className="text-midnight/70 mb-8 font-light">
          Upload exactly 3 images from your device.
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
                    <OptimizedImage src={photo.url} alt="Essence" srcWidth={480} srcSetWidths={[320, 480, 640]} sizes="(min-width: 768px) 33vw, 100vw" className="w-full h-full object-cover" />
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
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center text-center">
                    <div className="flex max-w-[11rem] flex-col items-center">
                      <div className="p-4 bg-white/50 rounded-full mb-2 group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-midnight" />
                      </div>
                      <span className="text-sm font-medium text-midnight/60">Upload Photo</span>
                      <span className="mt-1 text-xs text-midnight/40">Choose from your device</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(event) => {
                          void handleFileUpload(event, index);
                        }}
                      />
                    </div>
                  </label>
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
