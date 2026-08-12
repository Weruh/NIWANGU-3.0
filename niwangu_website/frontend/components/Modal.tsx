import { useEffect, useRef, type FC, type ReactNode, type RefObject } from 'react';
import { motion } from 'framer-motion';

type ModalProps = {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  /** Label for the backdrop's close affordance; also used by screen readers. */
  closeLabel?: string;
  className?: string;
  /**
   * Element to focus on open. Point this at the field the dialog exists to
   * collect; otherwise focus lands on the first focusable element, which is
   * usually the close button.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * A real dialog: labelled, modal to assistive tech, closable with Escape,
 * keeps Tab inside itself, and returns focus where it came from.
 */
export const Modal: FC<ModalProps> = ({
  titleId,
  onClose,
  children,
  closeLabel = 'Close dialog',
  className = '',
  initialFocusRef,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Callers pass onClose as an inline arrow, so its identity changes on every
  // parent render. Reading it through a ref keeps the effect below mount-only —
  // otherwise each keystroke in a form inside the modal tore the effect down,
  // and the cleanup's focus restore stole focus back out of the field.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (initialFocusRef?.current ?? firstFocusable ?? panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panel) {
        return;
      }

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-midnight/80 backdrop-blur-sm"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className={`relative max-h-[90dvh] w-full overflow-y-auto rounded-2xl bg-sandstone shadow-2xl focus:outline-none ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
};
