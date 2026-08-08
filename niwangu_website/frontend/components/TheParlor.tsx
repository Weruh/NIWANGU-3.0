import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useSanctuaryStore } from '../store';
import { ArrowLeft, Send, Sprout, Flower, XCircle, RotateCw } from 'lucide-react';
import { ChatSession, Message } from '../types';
import {
  MESSAGE_PAGE_SIZE,
  listMatchMessages,
  subscribeToMatchChanges,
  subscribeToMatchMessages,
} from '../lib/api';
import { ProfileMenu } from './ProfileMenu';
import { OptimizedImage } from './OptimizedImage';
import { Modal } from './Modal';

const MAX_MESSAGE_LENGTH = 2000;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const startOfDay = (timestamp: number) => new Date(timestamp).setHours(0, 0, 0, 0);

const formatDayLabel = (timestamp: number) => {
  const today = startOfDay(Date.now());
  const day = startOfDay(timestamp);
  const dayInMs = 86_400_000;

  if (day === today) {
    return 'Today';
  }

  if (day === today - dayInMs) {
    return 'Yesterday';
  }

  return dayFormatter.format(timestamp);
};

const formatListTimestamp = (isoDate?: string | null) => {
  if (!isoDate) {
    return '';
  }

  const timestamp = new Date(isoDate).getTime();

  if (Number.isNaN(timestamp)) {
    return '';
  }

  return startOfDay(timestamp) === startOfDay(Date.now())
    ? timeFormatter.format(timestamp)
    : formatDayLabel(timestamp);
};

/** Merges by id so a realtime echo cannot duplicate a message already shown. */
const mergeMessages = (existing: Message[], incoming: Message[]) => {
  const byId = new Map(existing.map((message) => [message.id, message]));

  incoming.forEach((message) => {
    byId.set(message.id, message);
  });

  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
};

export const TheParlor: FC = () => {
  const {
    activeChats,
    chatsLoading,
    currentProfile,
    paymentRequired,
    isPremium,
    loadChats,
    markChatRead,
    sendMessage,
    closeConnection,
    setView,
  } = useSanctuaryStore(useShallow((state) => ({
    activeChats: state.activeChats,
    chatsLoading: state.chatsLoading,
    currentProfile: state.currentProfile,
    paymentRequired: state.paymentRequired,
    isPremium: state.isPremium,
    loadChats: state.loadChats,
    markChatRead: state.markChatRead,
    sendMessage: state.sendMessage,
    closeConnection: state.closeConnection,
    setView: state.setView,
  })));
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const paywalled = paymentRequired && !isPremium;
  const profileId = currentProfile?.id ?? null;

  useEffect(() => {
    if (paywalled) {
      return;
    }

    void loadChats();
  }, [loadChats, paywalled]);

  useEffect(() => {
    if (paywalled || !profileId) {
      return undefined;
    }

    return subscribeToMatchChanges(profileId, () => {
      void loadChats();
    });
  }, [loadChats, paywalled, profileId]);

  // Redirecting during render warned about updating another component mid-render.
  useEffect(() => {
    if (paywalled) {
      setView('pricing');
    }
  }, [paywalled, setView]);

  const selectedChat = activeChats.find((chat) => chat.id === selectedChatId) ?? null;

  // Stable identity, so the "mark as read" effect in ChatWindow does not refire
  // on every parent render.
  const handleRead = useCallback(() => {
    if (selectedChatId) {
      void markChatRead(selectedChatId);
    }
  }, [markChatRead, selectedChatId]);

  if (paywalled) {
    return null;
  }

  return (
    <div className="flex h-dvh flex-col bg-sandstone">
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
            onRead={handleRead}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 items-center justify-center text-midnight/80"
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
      className="flex-1 overflow-y-auto p-6"
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to gallery"
            className="-ml-2 rounded-full p-2 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
          >
            <ArrowLeft className="text-midnight" aria-hidden="true" />
          </button>
          <h2 className="font-serif text-3xl text-midnight">Chats</h2>
        </div>
        <ProfileMenu />
      </div>

      {loading && chats.length === 0 ? (
        <div className="mt-20 text-center text-midnight/80">
          <p>Loading intentional conversations...</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {chats.map((chat) => {
            const timestamp = formatListTimestamp(chat.lastMessageAt);

            return (
              <li key={chat.id}>
                <button
                  type="button"
                  disabled={chat.isClosed}
                  onClick={() => onSelect(chat.id)}
                  aria-label={
                    chat.unreadCount > 0
                      ? `${chat.partnerName}, ${chat.unreadCount} unread messages`
                      : chat.partnerName
                  }
                  className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight ${
                    chat.isClosed
                      ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-70'
                      : 'border-white/40 bg-white/50 hover:border-sage'
                  }`}
                >
                  <OptimizedImage
                    src={chat.partnerPhoto}
                    alt=""
                    width={48}
                    height={48}
                    srcWidth={96}
                    srcSetWidths={[64, 96, 128]}
                    sizes="48px"
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="truncate font-serif text-lg text-midnight">{chat.partnerName}</h3>
                      <div className="flex shrink-0 items-center gap-2">
                        {timestamp && (
                          <span className="text-[11px] text-midnight/80">{timestamp}</span>
                        )}
                        {chat.isClosed && (
                          <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] uppercase text-gray-700">
                            Closed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`line-clamp-1 text-sm ${
                          chat.unreadCount > 0 ? 'font-semibold text-midnight' : 'text-midnight/80'
                        }`}
                      >
                        {chat.lastMessage || 'Start the conversation...'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="min-w-5 shrink-0 rounded-full bg-sageDeep px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-sageDeep" aria-hidden="true">
                    {chat.gardenLevel > 4 ? <Flower className="h-5 w-5" /> : <Sprout className="h-5 w-5" />}
                  </div>
                </button>
              </li>
            );
          })}

          {chats.length === 0 && !loading && (
            <li className="mt-20 text-center text-midnight/80">
              <p>Chat is quiet.</p>
              <p className="text-sm">Return to the gallery to find connection.</p>
            </li>
          )}
        </ul>
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
  onRead: () => void;
}> = ({ chat, currentProfileId, onBack, onSend, onClose, onRead }) => {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const pendingScrollRestore = useRef<number | null>(null);
  // Only follow new messages when the reader is already at the bottom, so
  // scrolling back through history is not interrupted.
  const pinnedToBottom = useRef(true);

  const handleScroll = () => {
    const container = scrollRef.current;

    if (container) {
      pinnedToBottom.current =
        container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    }
  };

  // Read from a ref inside subscriptions so reconnect catch-up always uses the
  // newest cursor without resubscribing on every message.
  const latestTimestamp = useRef(0);
  latestTimestamp.current = messages.reduce(
    (newest, message) => (message.status === 'sent' ? Math.max(newest, message.timestamp) : newest),
    0,
  );

  const appendMessages = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) {
      return;
    }

    setMessages((current) => mergeMessages(current, incoming));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingMessages(true);
    didInitialScroll.current = false;

    listMatchMessages(chat.id, currentProfileId, { limit: MESSAGE_PAGE_SIZE })
      .then((initial) => {
        if (cancelled) {
          return;
        }

        setMessages(initial);
        setHasMore(initial.length === MESSAGE_PAGE_SIZE);
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chat.id, currentProfileId]);

  useEffect(() => {
    return subscribeToMatchMessages(
      chat.id,
      currentProfileId,
      (message) => {
        setMessages((current) => {
          // The stored row may echo back before the send resolves; drop the
          // matching placeholder so the bubble does not appear twice.
          const withoutPlaceholder =
            message.sender === 'me'
              ? current.filter(
                  (item) => !(item.status === 'sending' && item.text === message.text),
                )
              : current;

          return mergeMessages(withoutPlaceholder, [message]);
        });
      },
      () => {
        // Reconnected: pull anything that arrived while the socket was down.
        if (latestTimestamp.current === 0) {
          return;
        }

        void listMatchMessages(chat.id, currentProfileId, { after: latestTimestamp.current })
          .then(appendMessages)
          .catch(() => undefined);
      },
    );
  }, [appendMessages, chat.id, currentProfileId]);

  // Opening the thread, and anything arriving while it is open, counts as read.
  useEffect(() => {
    if (!loadingMessages) {
      onRead();
    }
  }, [loadingMessages, messages.length, onRead]);

  useLayoutEffect(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    // Prepending history would otherwise yank the viewport to the top.
    if (pendingScrollRestore.current !== null) {
      container.scrollTop = container.scrollHeight - pendingScrollRestore.current;
      pendingScrollRestore.current = null;
      return;
    }

    if (loadingMessages) {
      return;
    }

    if (!didInitialScroll.current) {
      container.scrollTop = container.scrollHeight;
      didInitialScroll.current = true;
      return;
    }

    if (pinnedToBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [loadingMessages, messages]);

  const loadOlderMessages = async () => {
    const oldest = messages.find((message) => message.status === 'sent');

    if (!oldest || loadingOlder) {
      return;
    }

    setLoadingOlder(true);
    pendingScrollRestore.current = scrollRef.current?.scrollHeight ?? null;

    try {
      const older = await listMatchMessages(chat.id, currentProfileId, {
        before: oldest.timestamp,
        limit: MESSAGE_PAGE_SIZE,
      });

      setHasMore(older.length === MESSAGE_PAGE_SIZE);
      appendMessages(older);
    } catch {
      pendingScrollRestore.current = null;
    } finally {
      setLoadingOlder(false);
    }
  };

  const deliver = async (text: string, optimisticId: string) => {
    setSending(true);

    try {
      await onSend(text);
      // The realtime insert delivers the stored row; drop the placeholder.
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticId ? { ...message, status: 'failed' } : message,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = inputText.trim();

    if (!text || sending) {
      return;
    }

    const optimisticId = `pending-${crypto.randomUUID()}`;
    pinnedToBottom.current = true;

    // Show the bubble immediately, and only clear the box once it is queued.
    setMessages((current) => [
      ...current,
      { id: optimisticId, sender: 'me', text, timestamp: Date.now(), status: 'sending' },
    ]);
    setInputText('');

    await deliver(text, optimisticId);
  };

  const retryMessage = async (message: Message) => {
    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, status: 'sending' } : item)),
    );

    await deliver(message.text, message.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter starts a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  let lastRenderedDay: number | null = null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="z-10 flex items-center justify-between border-b border-midnight/10 bg-sandstone p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="rounded-full p-1 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
          >
            <ArrowLeft className="h-5 w-5 text-midnight" aria-hidden="true" />
          </button>
          <OptimizedImage
            src={chat.partnerPhoto}
            alt=""
            width={32}
            height={32}
            srcWidth={64}
            srcSetWidths={[48, 64, 96]}
            sizes="32px"
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <h3 className="truncate font-serif leading-none text-midnight">{chat.partnerName}</h3>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-midnight/80">
              <Sprout className="h-3 w-3 text-sageDeep" aria-hidden="true" />
              <span>Level {Math.floor(chat.gardenLevel)} Connection</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCloseDialog(true)}
          aria-label="Close this connection respectfully"
          className="rounded-full p-2 text-midnight/80 transition-colors hover:text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
        >
          <XCircle className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="border-b border-sage/20 bg-sage/10 px-4 py-2 text-center">
        <p className="text-xs text-midnight/80">
          <span className="font-bold">Shared Ground:</span>{' '}
          {chat.valuesOverlap.join(' • ') || 'Intentional connection'}
        </p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${chat.partnerName}`}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white/30 p-4"
      >
        {loadingMessages ? (
          <p className="py-12 text-center text-sm text-midnight/80">Loading messages...</p>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadOlderMessages()}
                  disabled={loadingOlder}
                  className="rounded-full border border-midnight/20 px-4 py-1.5 text-xs text-midnight/80 transition-colors hover:bg-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
                >
                  {loadingOlder ? 'Loading...' : 'Load earlier messages'}
                </button>
              </div>
            )}

            {messages.length === 0 && (
              <p className="py-12 text-center text-sm text-midnight/80">
                No messages yet. Say something with intention.
              </p>
            )}

            {messages.map((message) => {
              const day = startOfDay(message.timestamp);
              const showDaySeparator = day !== lastRenderedDay;
              lastRenderedDay = day;

              return (
                <div key={message.id}>
                  {showDaySeparator && (
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-midnight/10" />
                      <span className="text-[11px] uppercase tracking-wider text-midnight/80">
                        {formatDayLabel(message.timestamp)}
                      </span>
                      <span className="h-px flex-1 bg-midnight/10" />
                    </div>
                  )}

                  <div
                    className={`flex ${
                      message.sender === 'me'
                        ? 'justify-end'
                        : message.sender === 'system'
                          ? 'justify-center'
                          : 'justify-start'
                    }`}
                  >
                    <div className="max-w-[80%]">
                      <div
                        className={`rounded-2xl px-4 py-2 text-sm ${
                          message.sender === 'me'
                            ? `rounded-br-none bg-sageDeep text-white ${message.status !== 'sent' ? 'opacity-70' : ''}`
                            : message.sender === 'system'
                              ? 'bg-midnight/10 italic text-midnight/80'
                              : 'rounded-bl-none border border-midnight/10 bg-white text-midnight'
                        }`}
                      >
                        <span className="whitespace-pre-wrap break-words">{message.text}</span>
                      </div>

                      {message.sender !== 'system' && (
                        <div
                          className={`mt-1 flex items-center gap-2 px-1 text-[10px] text-midnight/80 ${
                            message.sender === 'me' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.status === 'failed' ? (
                            <>
                              <span className="text-red-800">Not sent</span>
                              <button
                                type="button"
                                onClick={() => void retryMessage(message)}
                                className="inline-flex items-center gap-1 text-midnight underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
                              >
                                <RotateCw className="h-3 w-3" aria-hidden="true" />
                                Retry
                              </button>
                            </>
                          ) : (
                            <time dateTime={new Date(message.timestamp).toISOString()}>
                              {message.status === 'sending'
                                ? 'Sending...'
                                : timeFormatter.format(message.timestamp)}
                            </time>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {chat.isClosed && (
          <p className="py-4 text-center text-xs italic text-midnight/80">
            This connection has been closed respectfully.
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!chat.isClosed && (
        <form
          onSubmit={(event) => {
            void handleSend(event);
          }}
          className="flex items-end gap-2 border-t border-midnight/10 bg-sandstone p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <label htmlFor="message-input" className="sr-only">
            Message {chat.partnerName}
          </label>
          <textarea
            id="message-input"
            rows={1}
            value={inputText}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={handleKeyDown}
            enterKeyHint="send"
            placeholder="Message with intention..."
            className="max-h-32 flex-1 resize-none rounded-2xl border border-midnight/10 bg-white/50 px-4 py-2 text-sm text-midnight focus:border-sage focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            aria-label="Send message"
            className="rounded-full bg-midnight p-2 text-sandstone transition-colors hover:bg-midnight/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      )}

      <AnimatePresence>
        {showCloseDialog && (
          <Modal
            titleId="respectful-exit-title"
            onClose={() => setShowCloseDialog(false)}
            closeLabel="Cancel closing this connection"
            className="max-w-sm p-6"
          >
            <h3 id="respectful-exit-title" className="mb-2 font-serif text-xl">
              Respectful Exit
            </h3>
            <p className="mb-4 text-sm text-midnight/80">
              Ghosting is not permitted here. Please select a reason to close this connection politely.
            </p>
            <div className="mb-4 space-y-2">
              {[
                'I feel our values do not align.',
                'I have found a connection elsewhere.',
                'I need to focus on myself right now.',
                'I did not feel a spark.',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    void onClose(reason);
                    setShowCloseDialog(false);
                  }}
                  className="w-full rounded border border-midnight/20 p-3 text-left text-sm transition-colors hover:bg-midnight hover:text-sandstone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCloseDialog(false)}
              className="w-full text-center text-xs text-midnight/80 hover:text-midnight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-midnight"
            >
              Cancel
            </button>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
