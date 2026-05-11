import { useEffect, useRef, useState, type FC } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Edit3, LogOut, UserCircle } from 'lucide-react';
import { useSanctuaryStore } from '../store';

export const ProfileMenu: FC<{ light?: boolean }> = ({ light = false }) => {
  const { currentProfile, setView, signOut } = useSanctuaryStore(useShallow((state) => ({
    currentProfile: state.currentProfile,
    setView: state.setView,
    signOut: state.signOut,
  })));
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
          light
            ? 'border-white/20 bg-sandstone/10 text-white backdrop-blur-md hover:bg-sandstone/20'
            : 'border-midnight/10 bg-white/45 text-midnight hover:bg-white/70'
        }`}
        aria-label="Open profile menu"
      >
        <UserCircle className="h-6 w-6" />
      </button>

      {open && (
        <div className="absolute right-0 z-[70] mt-3 w-64 rounded-lg border border-midnight/10 bg-sandstone p-3 text-midnight shadow-xl">
          <div className="border-b border-midnight/10 px-2 pb-3">
            <p className="font-serif text-lg leading-tight">{currentProfile?.name || 'Your Profile'}</p>
            <p className="text-xs text-midnight/55">{currentProfile?.location || 'Niwangu account'}</p>
          </div>

          <button
            onClick={() => {
              setOpen(false);
              setView('profile');
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-md px-2 py-3 text-left text-sm hover:bg-midnight/5"
          >
            <Edit3 className="h-4 w-4" />
            View and edit profile
          </button>

          <button
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left text-sm text-red-900 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};
