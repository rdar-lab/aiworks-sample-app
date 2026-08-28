import React, { useRef, useEffect, useState } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, SquarePen } from 'lucide-react';
import { helpChat, HelpChatMessage } from '../services/backendService';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useUI } from '../contexts/UIContext';

let cachedManual: string | null = null;

interface HelpChatBotProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function HelpChatBot({ isOpen, onToggle }: HelpChatBotProps) {
  const [messages, setMessages] = useState<HelpChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingManual, setIsFetchingManual] = useState(false);
  const { showError, lightMode } = useUI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const helpTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset textarea height when input is cleared after sending
  useEffect(() => {
    if (!input && helpTextareaRef.current) {
      helpTextareaRef.current.style.height = 'auto';
    }
  }, [input]);

  // Restore focus when the LLM response arrives and the textarea becomes enabled again
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading) {
      helpTextareaRef.current?.focus();
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading]);

  // Auto-focus the textarea when the help chat panel opens
  useEffect(() => {
    if (isOpen) {
      helpTextareaRef.current?.focus();
    }
  }, [isOpen]);

  const greeting: HelpChatMessage = { role: 'assistant', content: 'Hi! 👋 How can I help you use AiWorks today?' };

  // Fetch manual before opening the panel; open is only visible once cachedManual is ready
  useEffect(() => {
    if (!isOpen || cachedManual !== null) return;
    setIsFetchingManual(true);
    fetch(`${import.meta.env.BASE_URL}user-manual.md`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.text();
      })
      .then(text => {
        cachedManual = text;
        setIsFetchingManual(false);
      })
      .catch(() => {
        setIsFetchingManual(false);
        showError('Could not load the help documentation. Please try again later.');
        onToggle();
      });
  }, [isOpen]);

  // Show greeting when panel becomes visible for the first time
  useEffect(() => {
    if (isOpen && cachedManual !== null && messages.length === 0) {
      setMessages([greeting]);
    }
  }, [isOpen, isFetchingManual]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: HelpChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await helpChat(newMessages, cachedManual!);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I ran into an issue. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Action Button — desktop only */}
      <button
        data-analytics="toggle_help_chat"
        data-testid="btn-help-fab"
        onClick={onToggle}
        disabled={isFetchingManual}
        className="hidden sm:flex fixed bottom-6 right-6 z-[150] w-14 h-14 rounded-full
                   bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl
                   items-center justify-center transition-all duration-200
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                   disabled:opacity-70 disabled:cursor-wait no-print"
        aria-label={isOpen ? 'Close help chat' : 'Open help chat'}
      >
        {isFetchingManual
          ? <Loader2 className="w-6 h-6 animate-spin" />
          : isOpen
            ? <X className="w-6 h-6" />
            : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat Panel Overlay — only shown once manual is ready */}
      {isOpen && !isFetchingManual && cachedManual !== null && (
        <div
          data-testid="help-panel"
          className={`fixed z-[140] no-print
                     inset-x-0 top-16 bottom-0
                     sm:inset-x-auto sm:top-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[500px] sm:rounded-3xl sm:shadow-2xl
                     flex flex-col overflow-hidden border animate-slide-up
                     ${lightMode ? 'bg-white border-gray-200' : 'bg-gray-900 border-gray-700'}`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white sm:rounded-t-3xl">
            <Bot className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">AiWorks Help</p>
              <p className="text-xs text-indigo-200">Powered by AI</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                data-analytics="new_help_conversation"
                onClick={() => setMessages([greeting])}
                className="p-1 rounded-lg hover:bg-indigo-700 transition-colors"
                aria-label="New conversation"
                title="New conversation"
              >
                <SquarePen className="w-4 h-4" />
              </button>
            {/* Close button — mobile only (desktop uses the FAB) */}
              <button
                data-analytics="close_help_chat"
                onClick={onToggle}
                className="sm:hidden p-1 rounded-lg hover:bg-indigo-700 transition-colors"
                aria-label="Close help chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : `${lightMode ? 'bg-gray-100 text-gray-900' : 'bg-gray-800 text-gray-100'} rounded-bl-sm`
                    }`}
                >
                  {msg.role === 'user'
                    ? msg.content
                    : <MarkdownRenderer content={msg.content} variant="inline" compact lightMode={lightMode} />
                  }
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className={`rounded-2xl rounded-bl-sm px-3 py-2 ${lightMode ? 'bg-gray-100' : 'bg-gray-800'}`}>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`px-3 pb-3 pt-2 border-t ${lightMode ? 'border-gray-200' : 'border-gray-700'}`} style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-end gap-2">
              <textarea
                data-testid="input-help-message"
                ref={helpTextareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)}
                placeholder="Ask me anything…"
                rows={1}
                disabled={isLoading}
                dir="auto"
                className={`flex-1 resize-none rounded-2xl border px-3 py-2 focus:outline-none
                           focus:ring-2 focus:ring-indigo-400 disabled:opacity-50
                           max-h-24 overflow-y-auto
                           ${lightMode
                             ? 'border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-400'
                             : 'border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-400'
                           }`}
              />
              <button
                data-testid="btn-help-send"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700
                           text-white flex items-center justify-center shrink-0
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors focus:outline-none focus:ring-2
                           focus:ring-indigo-400"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className={`text-[10px] text-center mt-1 ${lightMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Chat history is not saved • Press Enter to send
            </p>
          </div>
        </div>
      )}
    </>
  );
}
