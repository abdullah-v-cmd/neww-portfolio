import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Copy, Check, Trash2, ArrowUpRight, Mail } from 'lucide-react';
import { ProfileMode } from '../types/portfolio';

interface Citation {
  source_type: string;
  source_id: string;
  title: string;
  score: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  providerUsed?: string;
}

interface AbdullahAIChatProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  profileMode: ProfileMode;
  onNavigateCitation: (sourceType: string, sourceId: string) => void;
  onJumpToContact: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Tell me about Abdullah Naveed.',
  'What is his experience with RAG?',
  'Tell me about OmniSynth.',
  'Explain V-Watch.',
  'What certificates does he have?',
  'Does he have Docker and FastAPI experience?',
];

export function AbdullahAIChat({
  isOpen,
  onToggle,
  profileMode,
  onNavigateCitation,
  onJumpToContact,
}: AbdullahAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello. I am Abdullah AI, grounded in Abdullah Naveed’s verified portfolio, GitHub repositories, work history, and Coursera credentials. Ask me about his RAG systems, computer vision architectures, experience, or engineering stack.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const sendQuestion = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isStreaming) return;

    setErrorMsg('');
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    const assistantId = `a_${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setIsStreaming(true);

    try {
      const res = await fetch('/api/public/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionId || undefined,
          profileMode,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'AI service unavailable.' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming unavailable.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          const dataLine = chunk.replace(/^data:\s*/, '').trim();
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine);
          if (payload.type === 'chunk') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + payload.text } : m
              )
            );
          } else if (payload.type === 'done') {
            if (payload.sessionId) setSessionId(payload.sessionId);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      citations: payload.citations || [],
                      providerUsed: payload.providerUsed || '',
                    }
                  : m
              )
            );
          } else if (payload.type === 'error') {
            throw new Error(payload.error || 'Provider returned an error.');
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to reach Abdullah AI right now.';
      setErrorMsg(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? {
                ...m,
                content:
                  'Abdullah AI could not complete that request right now. Please verify the AI provider configuration or contact Abdullah directly below.',
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClear = () => {
    setSessionId('');
    setErrorMsg('');
    setMessages([
      {
        id: 'welcome_reset',
        role: 'assistant',
        content: 'Conversation cleared. Ask any question about Abdullah Naveed’s verified background or projects.',
      },
    ]);
  };

  return (
    <>
      {/* Floating Launch Button */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => onToggle(true)}
          aria-label="Open Abdullah AI Recruiter Assistant"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-xl border border-red-600/60 bg-[#0D0F14] px-4 py-3 text-xs font-semibold text-white shadow-2xl transition-transform hover:-translate-y-0.5 hover:border-red-500 focus-visible:outline-2 focus-visible:outline-red-500"
        >
          <MessageSquare className="h-4 w-4 text-red-500" />
          <span>Ask Abdullah AI</span>
        </button>
      ) : null}

      {/* Expanded Chat Window */}
      {isOpen ? (
        <aside
          role="dialog"
          aria-label="Abdullah AI Recruiter Assistant"
          className="fixed bottom-4 right-4 z-50 flex h-[min(640px,85vh)] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B0D12] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0F1219] px-4 py-3.5">
            <div>
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                ABDULLAH AI
              </h2>
              <p className="text-[11px] text-slate-400">
                Grounded Recruiter Assistant · Verified Records Only
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClear}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-slate-400 hover:border-zinc-600 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onToggle(false)}
                aria-label="Close Abdullah AI"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-slate-400 hover:border-zinc-600 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white'
                      : 'border border-zinc-800 bg-[#121620] text-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">
                    {msg.content || (isStreaming && msg.role === 'assistant' ? 'Retrieving verified records…' : '')}
                  </p>
                </div>

                {msg.role === 'assistant' && msg.content && msg.id !== 'welcome' ? (
                  <div className="mt-1.5 flex max-w-[90%] flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {msg.citations && msg.citations.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                        <span>Sources:</span>
                        {msg.citations.slice(0, 3).map((c, idx) => (
                          <button
                            key={`${c.source_type}-${c.source_id}-${idx}`}
                            type="button"
                            onClick={() => onNavigateCitation(c.source_type, c.source_id)}
                            className="inline-flex items-center gap-0.5 text-blue-400 hover:underline"
                          >
                            <span>{c.title}</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}

            {messages.length <= 2 ? (
              <div className="space-y-2 pt-2">
                <p className="text-[11px] font-medium text-slate-400">Suggested Questions</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendQuestion(q)}
                      className="rounded-lg border border-zinc-800 bg-[#11141C] px-2.5 py-1.5 text-left text-xs text-slate-300 transition-colors hover:border-zinc-600 hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {errorMsg ? (
              <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                {errorMsg}
              </p>
            ) : null}
          </div>

          {/* Escalate to Human + Composer */}
          <div className="border-t border-zinc-800 bg-[#0F1219] p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => {
                  onToggle(false);
                  onJumpToContact();
                }}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-white"
              >
                <Mail className="h-3 w-3 text-red-400" />
                <span>Send direct message to Abdullah</span>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuestion(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about projects, RAG, experience..."
                disabled={isStreaming}
                className="h-10 flex-1 rounded-lg border border-zinc-800 bg-[#07080B] px-3 text-sm text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                aria-label="Send question"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white transition-colors hover:bg-red-500 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </aside>
      ) : null}
    </>
  );
}
