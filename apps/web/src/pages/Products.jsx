import { Brain, Compass, Plane } from 'lucide-react'

const Products = () => {
  return (
    <div className="page-shell flex flex-col">
      <main className="flex-grow page-container">
        <div className="space-y-12">
          <header className="space-y-3 text-center">
            <p className="page-kicker">Products</p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
              Traveler tools built for real trips
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to plan, book, and experience the trip you want.
            </p>
          </header>

          <div className="grid gap-8 md:grid-cols-3">
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
            ].map(({ icon: Icon, title, copy }) => (
              <div
                key={title}
                className="page-card px-8 py-8 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 via-fuchsia-500 to-orange-400 text-white shadow-md">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                  <p className="text-sm text-slate-600">{copy}</p>
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
