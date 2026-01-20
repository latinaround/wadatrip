import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Search } from 'lucide-react';
import ItineraryCard from './ItineraryCard';

const ResultsSection = ({ searchData, itinerary, isLoading, error, notice, onStartNewSearch, onSelectScenario }) => {
  const { t } = useTranslation();
  const scenarios = itinerary?.scenarios || [];

  if (isLoading) {
    return (
      <section className="py-20 bg-[#0a0e27]">
        <div className="container mx-auto px-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D9FF] mx-auto mb-4"></div>
          <p className="text-[#a0a0a0]">Buscando itinerarios reales</p>
        </div>
      </section>
    );
  }

  if (!searchData || !itinerary) {
    return (
      <section className="py-20 bg-[#0a0e27]">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 bg-gradient-to-br from-[#00D9FF]/20 to-[#FF006E]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-[#00D9FF]" />
            </div>
            <h2 className="text-2xl font-bold neon-title mb-4">{t('results.empty_title')}</h2>
            <p className="text-[#a0a0a0] mb-6">{t('results.empty_desc')}</p>
            <Button onClick={onStartNewSearch} className="neon-cta font-black hover:scale-105 transition-all">
              {t('results.start_button')}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-[#0a0e27]">
      <div className="container mx-auto px-4 space-y-10">
        <div className="text-center">
          <h2 className="text-4xl font-bold neon-title mb-4">{t('results.title')}</h2>
          <p className="text-xl text-[#a0a0a0]">
            {t('results.description', { count: scenarios.length })}
          </p>
          <p className="mt-4 text-sm text-[#a0a0a0]">
            This is an AI-generated travel plan. Real tours and experiences are available in the Tours section.
          </p>
          <div className="mt-6">
            <Button asChild variant="secondary" className="border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white">
              <Link to="/tours">Explore real tours from local operators</Link>
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="max-w-2xl mx-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert className="max-w-2xl mx-auto bg-[#1a1f3a] border-[#00D9FF]/40 text-[#00D9FF]">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {scenarios.length === 0 ? (
          <div className="text-center text-[#a0a0a0]">
            {t('results.no_real_data') ?? 'No encontramos itinerarios para los filtros seleccionados. Ajusta tu bsqueda e intenta nuevamente.'}
            <div className="mt-4">
              <Button asChild variant="secondary" className="border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white">
                <Link to="/tours">Explore real tours from local operators</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {scenarios.map((scenario) => (
              <ItineraryCard
                key={`${itinerary.itineraryId || itinerary.id}-${scenario.type}`}
                scenario={scenario}
                itineraryId={itinerary.itineraryId || itinerary.id}
                itineraryMeta={itinerary.meta}
                onSelect={onSelectScenario}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ResultsSection;

