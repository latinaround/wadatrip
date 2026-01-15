import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import WadaAgent from './WadaAgent';

const HeroVisual = () => {
  const { t } = useTranslation();

  return (
    <section className="hero relative w-full min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-950 to-orange-950">
      <video
        className="hero-video absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster="/default.svg"
        aria-hidden="true"
      >
        <source src="/hero.webm" type="video/webm" />
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 flex min-h-screen items-center">
        <div className="container mx-auto px-6 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="text-center lg:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200/80">
                {t('hero.visual_brand', 'WadaTrip')}
              </p>
              <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
                {t('hero.visual_headline', 'Plan your next adventure')}
              </h1>
              <p className="mt-4 max-w-xl text-lg text-white/85 sm:text-xl">
                {t('hero.visual_tagline', 'Simplify your travel planning')}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <Button asChild size="lg" className="bg-emerald-500 text-white hover:bg-emerald-600">
                  <a href="/operator/register">
                    {t('hero.cta_become_guide', 'Become a guide')}
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/50 bg-white/10 text-white hover:bg-white/20">
                  <a href="/products">
                    {t('hero.cta_see_destinations', 'See destinations')}
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/15 bg-white/10 p-6 text-center text-white/90 shadow-2xl backdrop-blur-lg lg:items-start lg:text-left">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-100/70">WadaAgent</p>
              <p className="text-lg font-semibold">Your AI travel concierge</p>
              <p className="text-sm text-white/75">
                Chat with WadaAgent for curated itineraries, insider tips, and instant inspiration.
              </p>
              <div className="mt-2">
                <WadaAgent variant="embedded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroVisual;
