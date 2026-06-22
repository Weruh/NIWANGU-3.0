import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { ArrowLeft, Send, Sprout, Flower, XCircle } from 'lucide-react';
import { ChatSession, Message } from '../types';
import { listMatchMessages, subscribeToMatchChanges, subscribeToMatchMessages } from '../lib/api';
import { ProfileMenu } from './ProfileMenu';
import { OptimizedImage } from './OptimizedImage';
import { PaymentWindow } from './PaymentWindow';

export const TheParlor: FC = () => {
  const {
    activeChats,
    chatsLoading,
    currentProfile,
    paymentRequired,
    paymentAmountKsh,
    profileViewLockUntil,
    isPremium,
    loadChats,
    unlockPremium,
    sendMessage,
    closeConnection,
    setView,
  } = useSanctuaryStore(useShallow((state) => ({
    activeChats: state.activeChats,
    chatsLoading: state.chatsLoading,
    currentProfile: state.currentProfile,
    paymentRequired: state.paymentRequired,
    paymentAmountKsh: state.paymentAmountKsh,
    profileViewLockUntil: state.profileViewLockUntil,
    isPremium: state.isPremium,
    loadChats: state.loadChats,
    unlockPremium: state.unlockPremium,
    sendMessage: state.sendMessage,
    closeConnection: state.closeConnection,
    setView: state.setView,
  })));
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    if (paymentRequired && !isPremium) {
      return;
    }

    void loadChats();
  }, [isPremium, loadChats, paymentRequired]);

  useEffect(() => {
    if (paymentRequired && !isPremium) {
      return undefined;
    }

    const unsubscribe = subscribeToMatchChanges(() => {
      void loadChats();
    });

    return unsubscribe;
  }, [isPremium, loadChats, paymentRequired]);

  const selectedChat = activeChats.find((chat) => chat.id === selectedChatId) ?? null;

  const handlePayment = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
      void unlockPremium().finally(() => {
        setPaymentProcessing(false);
      });
    }, 1800);
  };

  if (paymentRequired && !isPremium) {
    return (
      <div className="h-screen bg-midnight flex flex-col items-center justify-center p-6">
        <PaymentWindow
          amountKsh={paymentAmountKsh}
          lockedUntil={profileViewLockUntil}
          processing={paymentProcessing}
          onPay={handlePayment}
        />
        <button
          onClick={() => setView('gallery')}
          className="mt-5 text-xs text-sandstone/60 hover:text-sandstone underline"
        >
          Back to gallery
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-sandstone flex flex-col">
      <AnimatePresence mode="wait">
        {!selectedChatId ? (
          <ChatList
            chats={activeChats}
            loading={chatsLoading}
            onSelect={setSelectedChatId}
            onBack={() => setView('gallery')}
          />
        ) : selectedChat && currentProfile ? (
          <ChatWindow
            key={selectedChat.id}
            chat={selectedChat}
            currentProfileId={currentProfile.id}
            onBack={() => setSelectedChatId(null)}
            onSend={(text) => sendMessage(selectedChat.id, text)}
            onClose={(reason) => closeConnection(selectedChat.id, reason)}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center text-midnight/50"
          >
            Loading conversation...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ChatList: FC<{
  chats: ChatSession[];
  loading: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
}> = ({ chats, loading, onSelect, onBack }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 p-6"
    >
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-black/5 rounded-full">
            <ArrowLeft className="text-midnight" />
          </button>
          <h2 className="font-serif text-3xl text-midnight">The Parlor</h2>
        </div>
        <ProfileMenu />
      </div>

      {loading && chats.length === 0 ? (
        <div className="text-center text-midnight/40 mt-20">
          <p>Loading intentional conversations...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => !chat.isClosed && onSelect(chat.id)}
              className={`p-4 rounded-xl border ${chat.isClosed ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed' : 'bg-white/50 border-white/40 hover:border-sage cursor-pointer'} transition-all flex items-center gap-4`}
            >
              <OptimizedImage src={chat.partnerPhoto} alt={chat.partnerName} srcWidth={96} srcSetWidths={[64, 96, 128]} sizes="48px" className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-serif text-lg text-midnight">{chat.partnerName}</h3>
                  {chat.isClosed && (
                    <span className="text-[10px] uppercase bg-gray-200 px-2 py-0.5 rounded text-gray-500">Closed</span>
                  )}
                </div>
                <p className="text-sm text-midnight/60 line-clamp-1">
                  {chat.lastMessage || 'Start the conversation...'}
                </p>
              </div>
              <div className="text-sage">
                {chat.gardenLevel > 4 ? <Flower className="w-5 h-5" /> : <Sprout className="w-5 h-5" />}
              </div>
            </div>
          ))}

          {chats.length === 0 && !loading && (
            <div className="text-center text-midnight/40 mt-20">
              <p>The parlor is quiet.</p>
              <p className="text-sm">Return to the gallery to find connection.</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const ChatWindow: FC<{
  chat: ChatSession;
  currentProfileId: string;
  onBack: () => void;
  onSend: (text: string) => Promise<void>;
  onClose: (reason: string) => Promise<void>;
}> = ({ chat, currentProfileId, onBack, onSend, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    setLoadingMessages(true);

    try {
      const nextMessages = await listMatchMessages(chat.id, currentProfileId);
      setMessages(nextMessages);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    void loadMessages();
  }, [chat.id]);

  useEffect(() => {
    const unsubscribe = subscribeToMatchMessages(chat.id, () => {
      void loadMessages();
    });

    return unsubscribe;
  }, [chat.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) {
      return;
    }

    await onSend(inputText.trim());
    setInputText('');
    await loadMessages();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full"
    >
      <div className="bg-sandstone border-b border-midnight/10 p-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-black/5 rounded-full">
            <ArrowLeft className="w-5 h-5 text-midnight" />
          </button>
          <OptimizedImage src={chat.partnerPhoto} alt={chat.partnerName} srcWidth={64} srcSetWidths={[48, 64, 96]} sizes="32px" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h3 className="font-serif text-midnight leading-none">{chat.partnerName}</h3>
            <div className="flex items-center gap-1 text-[10px] text-midnight/50 uppercase tracking-wider mt-0.5">
              <Sprout className="w-3 h-3 text-sage" />
              <span>Level {Math.floor(chat.gardenLevel)} Connection</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowCloseDialog(true)}
          className="text-midnight/40 hover:text-red-800 transition-colors p-2"
          title="Respectful Exit"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-sage/10 py-2 px-4 text-center border-b border-sage/20">
        <p className="text-xs text-midnight/70">
          <span className="font-bold">Shared Ground:</span> {chat.valuesOverlap.join(' • ') || 'Intentional connection'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/30">
        {loadingMessages ? (
          <div className="text-center py-12 text-sm text-midnight/40">Loading messages...</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  msg.sender === 'me'
                    ? 'bg-sage text-white rounded-br-none'
                    : msg.sender === 'system'
                      ? 'bg-midnight/10 text-midnight/60 italic'
                      : 'bg-white text-midnight border border-midnight/10 rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
        {chat.isClosed && (
          <div className="text-center py-4 text-xs text-midnight/40 italic">This connection has been closed respectfully.</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!chat.isClosed && (
        <form
          onSubmit={(event) => {
            void handleSend(event);
          }}
          className="p-4 bg-sandstone border-t border-midnight/10 flex gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message with intention..."
            className="flex-1 bg-white/50 border border-midnight/10 rounded-full px-4 py-2 focus:outline-none focus:border-sage text-sm"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-midnight text-sandstone p-2 rounded-full disabled:opacity-50 hover:bg-midnight/90 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      )}

      <AnimatePresence>
        {showCloseDialog && (
          <div className="absolute inset-0 z-50 bg-midnight/80 flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-sandstone rounded-xl p-6 w-full max-w-sm"
            >
              <h3 className="font-serif text-xl mb-2">Respectful Exit</h3>
              <p className="text-sm text-midnight/70 mb-4">
                Ghosting is not permitted here. Please select a reason to close this connection politely.
              </p>
              <div className="space-y-2 mb-4">
                {[
                  'I feel our values do not align.',
                  'I have found a connection elsewhere.',
                  'I need to focus on myself right now.',
                  'I did not feel a spark.',
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => {
                      void onClose(reason);
                      setShowCloseDialog(false);
                    }}
                    className="w-full text-left p-3 text-sm border border-midnight/20 rounded hover:bg-midnight hover:text-sandstone transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCloseDialog(false)}
                className="w-full text-center text-xs text-midnight/50 hover:text-midnight"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
