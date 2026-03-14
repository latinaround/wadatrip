import { MapPin } from 'lucide-react';

const sizeMap = {
  sm: {
    icon: 'h-10 w-10 rounded-2xl',
    handle: 'h-2 w-4 -top-1 border-[3px]',
    mark: 'h-5 w-5',
    swoosh: 'h-3 w-10 -right-2 bottom-2',
    word: 'text-2xl',
    tagline: 'text-[11px]',
    gap: 'gap-2.5',
  },
  md: {
    icon: 'h-14 w-14 rounded-[20px]',
    handle: 'h-2.5 w-5 -top-1.5 border-4',
    mark: 'h-7 w-7',
    swoosh: 'h-4 w-14 -right-3 bottom-3',
    word: 'text-3xl',
    tagline: 'text-xs',
    gap: 'gap-3',
  },
  lg: {
    icon: 'h-20 w-20 rounded-[28px]',
    handle: 'h-3 w-7 -top-2 border-[5px]',
    mark: 'h-9 w-9',
    swoosh: 'h-5 w-20 -right-4 bottom-4',
    word: 'text-4xl',
    tagline: 'text-sm',
    gap: 'gap-4',
  },
};

export default function BrandLogo({ size = 'md', showTagline = false, light = false, className = '' }) {
  const config = sizeMap[size] || sizeMap.md;
  const taglineTone = light ? 'text-white/90' : 'text-[#526173]';

  return (
    <div className={`inline-flex items-center ${config.gap} ${className}`.trim()}>
      <div className="relative">
        <div className={`relative overflow-hidden bg-[linear-gradient(140deg,#bb27b8_0%,#ef1ec8_46%,#ff7d28_100%)] shadow-[0_16px_36px_rgba(194,46,163,0.26)] ${config.icon}`}>
          <div className={`absolute left-1/2 z-20 -translate-x-1/2 rounded-t-full border-b-0 border-[#c334b5] ${config.handle}`} />
          <div className={`absolute rotate-[-26deg] rounded-full bg-[#ffad25] ${config.swoosh}`} />
          <div className={`absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#17d0d0] shadow-[0_10px_24px_rgba(16,185,189,0.32)] ${config.mark}`}>
            <MapPin className="absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className={`font-['Poppins'] font-semibold leading-none tracking-[-0.05em] ${config.word}`}>
          <span className="text-[#16d7d0]">wada</span>
          <span className="text-[#ff9822]">trip</span>
        </div>
        {showTagline ? (
          <div className={`mt-1 font-['Inter'] font-medium ${config.tagline} ${taglineTone}`}>
            Book better tours. Meet trusted hosts.
          </div>
        ) : null}
      </div>
    </div>
  );
}
