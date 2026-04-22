import { useEffect, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { RITUAL_QUESTIONS } from '../lib/ritual';

export const AlignmentRitual: FC = () => {
  const {
    ritualStep,
    formData,
    isBusy,
    setRitualStep,
    saveRitualAnswer,
    setView,
  } = useSanctuaryStore(useShallow((state) => ({
    ritualStep: state.ritualStep,
    formData: state.formData,
    isBusy: state.isBusy,
    setRitualStep: state.setRitualStep,
    saveRitualAnswer: state.saveRitualAnswer,
    setView: state.setView,
  })));
  const [textInput, setTextInput] = useState('');
  const [introFinished, setIntroFinished] = useState(false);

  const currentQ = RITUAL_QUESTIONS[ritualStep];
  const progress = ((ritualStep + 1) / RITUAL_QUESTIONS.length) * 100;

  useEffect(() => {
    setTextInput(formData[currentQ.id] ?? '');
  }, [currentQ.id, formData]);

  const handleOptionClick = async (option: string) => {
    await saveRitualAnswer(currentQ.id, option);

    if (ritualStep < RITUAL_QUESTIONS.length - 1) {
      setTimeout(() => setRitualStep(ritualStep + 1), 250);
    } else {
      setView('essence');
    }
  };

  const handleTextSubmit = async () => {
    if (textInput.length < 50) {
      return;
    }

    await saveRitualAnswer(currentQ.id, textInput);
    setView('essence');
  };

  if (!introFinished) {
    return (
      <motion.div
        className="h-screen bg-midnight flex flex-col items-center justify-center p-8 text-center text-sandstone"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h2 className="font-serif text-3xl mb-4">Clarity First. Then Connection.</h2>
        <p className="font-sans font-light opacity-80 mb-8 max-w-md">
          Niwangu is built on alignment. We ask the hard questions now so you do not have to guess later.
          <br />
          <br />
          This takes 3-4 minutes.
        </p>
        <Button onClick={() => setIntroFinished(true)} variant="primary">
          Begin Ritual
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-sandstone flex flex-col">
      <div className="w-full h-1 bg-midnight/10">
        <motion.div
          className="h-full bg-sage"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={ritualStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-8"
          >
            <span className="text-sage font-medium tracking-widest text-xs uppercase">
              Step {ritualStep + 1} of {RITUAL_QUESTIONS.length} - {currentQ.category}
            </span>

            <h2 className="font-serif text-3xl md:text-4xl text-midnight leading-tight">
              {currentQ.question}
            </h2>

            {currentQ.type === 'choice' && (
              <div className="grid gap-3">
                {currentQ.options?.map((opt, idx) => (
                  <motion.button
                    key={opt}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => {
                      void handleOptionClick(opt);
                    }}
                    disabled={isBusy}
                    className="text-left p-4 border border-midnight/20 rounded-lg hover:bg-midnight hover:text-sandstone hover:border-midnight transition-all duration-300 font-medium disabled:opacity-60"
                  >
                    {opt}
                  </motion.button>
                ))}
              </div>
            )}

            {currentQ.type === 'text' && (
              <div className="flex flex-col gap-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="I am no longer willing to entertain..."
                  maxLength={currentQ.maxLength}
                  className="w-full h-40 bg-white/50 border border-midnight/20 rounded-lg p-4 focus:outline-none focus:border-sage text-midnight resize-none"
                />
                <div className="flex justify-between items-center text-xs text-midnight/50">
                  <span>
                    {textInput.length}/{currentQ.maxLength} characters
                  </span>
                  <span>Minimum 50 characters</span>
                </div>
                <Button onClick={() => void handleTextSubmit()} disabled={textInput.length < 50 || isBusy}>
                  {isBusy ? 'Saving...' : 'Complete Ritual'}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
