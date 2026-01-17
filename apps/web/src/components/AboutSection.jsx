import { Card, CardContent } from './ui/card';
import { Brain, CalendarDays, Users } from 'lucide-react';

const AboutSection = () => {
  return (
    <div className="section-soft">
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-2">
            <p className="page-kicker text-[#00D9FF]">How Wadatrip works</p>
            <h3 className="text-3xl font-bold neon-title">Simple, local, and powered by AI</h3>
            <p className="text-lg text-[#e0e0e0] max-w-2xl mx-auto">
              Plan smarter trips with curated local experiences and flexible planning controls.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 text-center">
            {[
              {
                icon: Brain,
                label: 'AI Trip Agent',
                desc: 'Personalized itineraries shaped by your dates, budget, and interests.',
              },
              {
                icon: Users,
                label: 'Real local experiences',
                desc: 'Verified operators publish authentic tours and activities you can book instantly.',
              },
              {
                icon: CalendarDays,
                label: 'Flexible planning',
                desc: 'Adjust your plan any time and keep total control over cost and schedule.',
              },
            ].map(({ icon: Icon, label, desc }) => (
              <Card
                key={label}
                className="page-card text-white flex flex-col items-center gap-4"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#00D9FF] to-[#FF006E] rounded-full shadow-lg shadow-[#00D9FF]/30 mb-4 shrink-0">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <CardContent className="p-0 text-center">
                  <h4 className="text-lg font-semibold mb-2">{label}</h4>
                  <p className="text-sm text-[#a0a0a0] leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12 neon-title">Why choose Wadatrip</h3>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2 text-white">10K+</div>
              <div className="text-xl text-[#a0a0a0]">Satisfied travelers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2 text-white">150+</div>
              <div className="text-xl text-[#a0a0a0]">Available destinations</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2 text-white">4.9+</div>
              <div className="text-xl text-[#a0a0a0]">Average rating</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutSection;
