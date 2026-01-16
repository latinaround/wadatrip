import { Card, CardContent } from './ui/card';
import { Brain, CalendarDays, Users } from 'lucide-react';

const AboutSection = () => {
  return (
    <div className="py-20 bg-gradient-to-br from-[#003c3d] via-[#006d6f] to-[#00b7b3] text-white">
      <section className="py-24 bg-gradient-to-br from-[#004f50] via-[#006d6f] to-[#00a5a1]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-teal-100">How Wadatrip works</p>
            <h3 className="text-3xl font-bold text-white">Simple, local, and powered by AI</h3>
            <p className="text-lg text-gray-200 max-w-2xl mx-auto">
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
                className="bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20 transition-all duration-300 rounded-2xl shadow-md p-5 text-white flex flex-col items-center"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#00b7b3] to-[#009b9f] rounded-full shadow-md mb-3 shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <CardContent className="p-0 text-center">
                  <h4 className="text-lg font-semibold mb-1">{label}</h4>
                  <p className="text-sm text-gray-300 leading-snug">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-[#00a5a1] to-[#00c4b4] text-white">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Why choose Wadatrip</h3>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">10K+</div>
              <div className="text-xl text-white/80">Satisfied travelers</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">150+</div>
              <div className="text-xl text-white/80">Available destinations</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">4.9?</div>
              <div className="text-xl text-white/80">Average rating</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutSection;
