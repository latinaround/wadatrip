import { Bot, Brain, Compass, Plane } from 'lucide-react'

const Products = () => {
  const handleOpenWadaAgent = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('wadagent:open'));
  };

  return (
    <div className="page-shell flex flex-col">
      <main className="flex-grow page-container">
        <div className="space-y-12">
          <header className="space-y-3 text-center">
            <p className="page-kicker text-[#00D9FF]">Products</p>
            <h1 className="text-3xl md:text-4xl font-semibold neon-title">
              Traveler tools built for real trips
            </h1>
            <p className="text-lg text-[#e0e0e0] max-w-2xl mx-auto">
              Everything you need to plan, book, and experience the trip you want.
            </p>
          </header>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Brain,
                title: 'AI trip planner',
                copy: 'Generate itineraries tailored to your dates, budget, and interests.',
              },
              {
                icon: Compass,
                title: 'Tours marketplace',
                copy: 'Book local experiences from verified operators in one place.',
              },
              {
                icon: Plane,
                title: 'Flight insights',
                copy: 'Get smarter timing and pricing guidance before you book.',
              },
              {
                icon: Bot,
                title: 'WadaAgent',
                copy: 'AI assistant that checks operators, tours, and pricing for you.',
                action: 'Open WadaAgent',
              },
            ].map(({ icon: Icon, title, copy, action }) => (
              <div
                key={title}
                className="page-card flex flex-col justify-center gap-4 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00D9FF] via-[#FFB703] to-[#FF006E] text-white shadow-lg shadow-[#00D9FF]/40">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="text-sm text-[#a0a0a0] leading-relaxed">{copy}</p>
                  {action && (
                    <button
                      type="button"
                      onClick={handleOpenWadaAgent}
                      className="mt-2 inline-flex items-center justify-center rounded-lg border border-[#00D9FF]/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#00D9FF] transition hover:border-[#00D9FF] hover:text-white"
                    >
                      {action}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Products
