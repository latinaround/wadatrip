import { useMemo, useState } from 'react';

const DEFAULT_CTA_URL = 'https://wa.me/0000000000';

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/$/, '');
}

export default function WadaAgent() {
  const enabled = String(import.meta.env.VITE_WADAAGENT_ENABLED || '').toLowerCase() === 'true';
  const [open, setOpen] = useState(false);
  const agentUrl = useMemo(
    () => normalizeUrl(import.meta.env.VITE_WADAAGENT_URL),
    [],
  );
  const ctaUrl = normalizeUrl(import.meta.env.VITE_WADAAGENT_CTA_URL) || DEFAULT_CTA_URL;

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        data-wadagent
        onClick={() => setOpen(true)}
        className="animate-wadapulse rounded-full bg-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-teal-600"
        aria-label="Open WadaAgent"
      >
        WadaAgent
      </button>

      {open && (
        <div className="fixed inset-0 z-[99999] flex items-end justify-end p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            role="button"
            tabIndex={0}
            aria-label="Close WadaAgent"
          />
          <div className="wadagent-fade-slide relative w-full max-w-md overflow-hidden rounded-2xl bg-[#1a1f3a] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2d3548] px-4 py-3">
              <div>
                <p className="text-sm font-semibold">WadaAgent</p>
                <p className="text-xs text-[#a0a0a0]">AI travel concierge</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-[#2d3548] px-2 py-1 text-xs font-semibold text-[#a0a0a0] hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {agentUrl ? (
              <iframe
                title="WadaAgent"
                src={agentUrl}
                className="h-[70vh] w-full border-0"
                allow="microphone; camera; clipboard-read; clipboard-write"
              />
            ) : (
              <div className="space-y-4 px-5 py-6">
                <p className="text-base font-semibold">WadaAgent is being trained.</p>
                <p className="text-sm text-[#a0a0a0]">
                  Our AI concierge is warming up. In the meantime, reach us directly for a custom trip plan.
                </p>
                <a
                  href={ctaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Talk to an agent
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

