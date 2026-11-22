import { Fragment, useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Copy, Check, Trash2, Mail } from 'lucide-react';
import { ProfileMode } from '../types/portfolio';
import { parseJsonSafe } from '../utils/safeFetch';

interface Citation {
  source_type: string;
  source_id: string;
  title: string;
  score: number;
}

interface MessageDispatched {
  ok: boolean;
  threadToken: string;
  emailSent: boolean;
  senderName: string;
  contact: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  providerUsed?: string;
  messageDispatched?: MessageDispatched | null;
}

interface AbdullahAIChatProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  profileMode: ProfileMode;
  onNavigateCitation?: (sourceType: string, sourceId: string) => void;
  onJumpToContact: () => void;
}

const SUGGESTED_QUESTIONS = [
  'Tell me about Abdullah Naveed.',
  'List all of Abdullah’s GitHub repositories.',
  'Send a message to Abdullah for me.',
  'What RAG systems has Abdullah built?',
  'Which projects have verified live demos?',
  'Compare RAG vs fine-tuning for production systems.',
];

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-red-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <Fragment key={idx}>{part}</Fragment>;
  });
}

function FormattedMarkdown({ content }: { content: string }) {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const blocks: Array<
    | { type: 'code'; lang: string; code: string }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'text'; lines: string[] }
  > = [];

  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      i++;
      continue;
    }

    // Markdown table detection
    if (
      line.trim().startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|[\s:-]+\|/.test(lines[i + 1])
    ) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headers = parseRow(line);
      i += 2; // Skip separator row
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const textLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].trim().startsWith('```') &&
      !(
        lines[i].trim().startsWith('|') &&
        i + 1 < lines.length &&
        /^\s*\|[\s:-]+\|/.test(lines[i + 1])
      )
    ) {
      textLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'text', lines: textLines });
  }

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-slate-200">
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <div key={bIdx} className="overflow-hidden rounded-lg border border-zinc-800 bg-[#07080B]">
              <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-1.5 text-[10px] font-mono text-slate-400">
                <span>{block.lang || 'code'}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(block.code).catch(() => undefined);
                    setCopiedCodeIdx(bIdx);
                    setTimeout(() => setCopiedCodeIdx(null), 1500);
                  }}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  {copiedCodeIdx === bIdx ? (
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
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs text-slate-200">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={bIdx} className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#090B10]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60 text-slate-200">
                    {block.headers.map((h, hi) => (
                      <th key={hi} className="px-2.5 py-2 font-semibold">
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2.5 py-1.5 text-slate-300">
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <div key={bIdx} className="space-y-1.5">
            {block.lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;

              const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
              if (hMatch) {
                return (
                  <p key={lIdx} className="pt-1 font-display text-sm font-bold tracking-wide text-white uppercase">
                    {renderInlineMarkdown(hMatch[2])}
                  </p>
                );
              }

              const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
              if (ulMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e50914]" />
                    <span>{renderInlineMarkdown(ulMatch[1])}</span>
                  </div>
                );
              }

              const olMatch = trimmed.match(/^(\d+\.)\s+(.+)$/);
              if (olMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-1">
                    <span className="font-mono text-xs font-semibold text-[#e50914]">
                      {olMatch[1]}
                    </span>
                    <span>{renderInlineMarkdown(olMatch[2])}</span>
                  </div>
                );
              }

              return <p key={lIdx}>{renderInlineMarkdown(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

export function AbdullahAIChat({
  isOpen,
  onToggle,
  profileMode,
  onJumpToContact,
}: AbdullahAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello. I am **Abdullah AI**. Ask me anything about Abdullah Naveed’s verified projects, RAG & computer vision architectures, experience, or credentials — or ask general AI, ML, and software engineering questions.',
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
      const requestPayload = {
        message: trimmed,
        sessionId: sessionId || undefined,
        profileMode,
        stream: true,
      };

      const res = await fetch('/api/public/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (!res.ok) {
        const errData = await parseJsonSafe<{ error?: string }>(res);
        throw new Error(errData?.error || `AI service error (HTTP ${res.status}).`);
      }

      // If reverse proxy returned HTML or unexpected non-stream response, fall back cleanly once to non-streaming JSON
      if (contentType.includes('text/html') || contentType.includes('application/json') || !res.body) {
        if (contentType.includes('application/json')) {
          const data = await parseJsonSafe<{
            sessionId?: string;
            answer?: string;
            citations?: Citation[];
            providerUsed?: string;
            messageDispatched?: MessageDispatched | null;
            error?: string;
          }>(res);
          if (data.error) throw new Error(data.error);
          if (data.sessionId) setSessionId(data.sessionId);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: data.answer || '',
                    citations: data.citations || [],
                    providerUsed: data.providerUsed || '',
                    messageDispatched: data.messageDispatched || null,
                  }
                : m
            )
          );
          return;
        }

        // Retry non-streaming JSON once if HTML / missing body occurred on SSE
        const fallbackRes = await fetch('/api/public/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...requestPayload, stream: false }),
        });
        const fallbackData = await parseJsonSafe<{
          sessionId?: string;
          answer?: string;
          citations?: Citation[];
          providerUsed?: string;
          messageDispatched?: MessageDispatched | null;
          error?: string;
        }>(fallbackRes);
        if (!fallbackRes.ok || fallbackData.error) {
          throw new Error(fallbackData.error || `AI service error (HTTP ${fallbackRes.status}).`);
        }
        if (fallbackData.sessionId) setSessionId(fallbackData.sessionId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: fallbackData.answer || '',
                  citations: fallbackData.citations || [],
                  providerUsed: fallbackData.providerUsed || '',
                  messageDispatched: fallbackData.messageDispatched || null,
                }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) return; // Ignore empty lines & SSE ': ping' keepalives
        if (line.startsWith('<!doctype') || line.startsWith('<!DOCTYPE') || line.startsWith('<html')) {
          throw new Error('The AI gateway returned an HTML page instead of an event stream. Please try again.');
        }
        if (!line.startsWith('data:')) return;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') return;
        if (jsonStr.startsWith('<')) {
          throw new Error('Received invalid HTML fragment in AI response stream.');
        }

        let payload: any;
        try {
          payload = JSON.parse(jsonStr);
        } catch {
          return;
        }

        if (payload.type === 'chunk' && typeof payload.text === 'string') {
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
                    messageDispatched: payload.messageDispatched || null,
                  }
                : m
            )
          );
        } else if (payload.type === 'error') {
          throw new Error(payload.error || 'Provider returned an error.');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          processLine(line);
        }
      }
      if (buffer.trim()) {
        processLine(buffer);
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
                  'Abdullah AI could not complete that request right now. Please check the error notice below or contact Abdullah directly.',
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
        content:
          'Conversation cleared. Ask any question about Abdullah Naveed’s portfolio or general AI & software engineering.',
      },
    ]);
  };

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => onToggle(true)}
          aria-label="Open Abdullah AI Assistant"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-xl border border-red-600/60 bg-[#0D0F14] px-4 py-3 text-xs font-semibold text-white shadow-2xl transition-transform hover:-translate-y-0.5 hover:border-red-500 focus-visible:outline-2 focus-visible:outline-red-500"
        >
          <MessageSquare className="h-4 w-4 text-red-500" />
          <span>Ask Abdullah AI</span>
        </button>
      ) : null}

      {isOpen ? (
        <aside
          role="dialog"
          aria-label="Abdullah AI Assistant"
          className="fixed bottom-4 right-4 z-50 flex h-[min(660px,86vh)] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0B0D12] shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0F1219] px-4 py-3.5">
            <div>
              <h2 className="font-display text-sm font-bold tracking-wide text-white">
                ABDULLAH AI
              </h2>
              <p className="text-[11px] text-slate-400">
                Portfolio Grounded · General Technical Assistance
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

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[92%] rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-sm text-white'
                      : 'border border-zinc-800 bg-[#121620] text-slate-200'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.content ? (
                    <div className="space-y-2.5">
                      <FormattedMarkdown content={msg.content} />
                      {msg.messageDispatched?.ok ? (
                        <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/35 px-3 py-2 text-xs text-emerald-200">
                          <p className="font-semibold text-emerald-300">
                            Message delivered to Abdullah’s Admin Inbox
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-200/80">
                            Sender: {msg.messageDispatched.senderName} ({msg.messageDispatched.contact}) ·{' '}
                            {msg.messageDispatched.emailSent
                              ? 'Email alert dispatched via SMTP'
                              : 'Logged in Admin Recruiter Inbox'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {isStreaming ? 'Searching verified records…' : ''}
                    </p>
                  )}
                </div>

                {msg.role === 'assistant' && msg.content && msg.id !== 'welcome' ? (
                  <div className="mt-1.5 flex max-w-[92%] flex-wrap items-center gap-2">
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
                placeholder="Ask about projects, RAG, or engineering concepts..."
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
