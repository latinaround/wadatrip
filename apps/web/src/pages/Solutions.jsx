import { Briefcase, Building2, Handshake } from "lucide-react";

const Solutions = () => {
  return (
    <div className="page-shell flex flex-col">
      <main className="flex-grow page-container">
        <div className="space-y-10">
          <header className="space-y-3 text-center">
            <p className="page-kicker">Solutions</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
              Built for operators and travel partners
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Grow bookings and distribution with tools designed for the travel industry.
            </p>
          </header>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Handshake,
                title: 'Tour operators',
                copy: 'Publish tours, manage availability, and get booked by real travelers.',
              },
              {
                icon: Building2,
                title: 'Travel agencies',
                copy: 'Offer curated itineraries and verified experiences to your clients.',
              },
              {
                icon: Briefcase,
                title: 'Custom partnerships',
                copy: 'Tailored distribution, integrations, and go-to-market support.',
              },
            ].map(({ icon: Icon, title, copy }) => (
              <div
                key={title}
                className="page-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                  <p className="text-sm text-gray-600">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Solutions;
