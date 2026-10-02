import { useState, type ChangeEvent, type FC } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { Plus, X } from 'lucide-react';
import { ProfilePhoto } from '../types';
import { Modal } from './Modal';
import { OptimizedImage } from './OptimizedImage';

export const TheEssence: FC = () => {
  const { photos, uploadPhoto, removePhoto, completePhotoStep, isBusy } = useSanctuaryStore(useShallow((state) => ({
    photos: state.photos,
    uploadPhoto: state.uploadPhoto,
    removePhoto: state.removePhoto,
    completePhotoStep: state.completePhotoStep,
    isBusy: state.isBusy,
  })));

  const [preview,setPreview]=useState(false);
  const profile=useSanctuaryStore(s=>s.currentProfile);
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
    <motion.div className="min-h-dvh bg-sandstone flex flex-col p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col justify-center">
        <h2 className="font-serif text-4xl text-midnight mb-2">Add your photos</h2>
        <p className="text-midnight/80 mb-8 font-light">
          Choose three recent photos that help people get to know you.
        </p>

        <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-10">
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
                      type="button"
                      onClick={() => {
                        void handleRemove(photo);
                      }}
                      aria-label="Remove this photo"
                      // Also reveal on keyboard focus; hover-only hid it from keyboard users.
                      className="absolute top-2 right-2 bg-midnight/80 text-white p-1 rounded-full opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center text-center">
                    <div className="flex max-w-[11rem] flex-col items-center">
                      <div className="p-4 bg-white/50 rounded-full mb-2 group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-midnight" />
                      </div>
                      <span className="text-sm font-medium text-midnight/80">Add photo</span>
                      <span className="mt-1 text-xs text-midnight/80">Select an image</span>
                      <input
                        disabled={isBusy} type="file"
                        className="sr-only"
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

        {isBusy&&<p role="status" className="mb-4 text-sm text-sageDeep">Saving your photo…</p>}
        <div className="flex justify-end">
          <Button
            disabled={photos.length !== 3 || isBusy}
            onClick={() => {
              setPreview(true);
            }}
            className="w-full md:w-auto"
          >
            {isBusy ? 'Saving...' : 'Preview your profile'}
          </Button>
        </div>
      </div>
      {preview&&profile&&<Modal titleId="your-profile-preview" onClose={()=>setPreview(false)} className="max-w-lg p-6"><h2 id="your-profile-preview" className="font-serif text-2xl">Your profile preview</h2><div className="my-5 grid grid-cols-3 gap-2">{photos.map(p=><OptimizedImage key={p.id} src={p.url} alt="Your profile photo" srcWidth={320} className="aspect-[3/4] w-full rounded-xl object-cover"/>)}</div><h3 className="font-serif text-3xl">{profile.name}, {profile.age}</h3><p className="mt-2 text-sm text-midnight/65">{profile.location}</p><p className="mt-4 font-medium">{profile.intent}</p><p className="mt-2 text-sm">Core value: {profile.coreValue}</p><p className="my-5 rounded-xl bg-sage/10 p-4 text-sm leading-6">{profile.boundary}</p><Button fullWidth onClick={()=>{setPreview(false);void completePhotoStep();}}>Continue</Button><Button variant="outline" fullWidth className="mt-3" onClick={()=>setPreview(false)}>Edit photos</Button></Modal>}
    </motion.div>
  );
};
