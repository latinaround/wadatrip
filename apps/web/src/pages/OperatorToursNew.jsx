import { useMemo, useState } from 'react';
import { AppConfig } from '../config/appConfig';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

const emptyProvider = {
  type: 'operator',
  name: '',
  email: '',
  phone: '',
  base_city: '',
  country_code: '',
  languages: '',
};

const emptyTour = {
  provider_id: '',
  title: '',
  category: 'tour',
  description: '',
  city: '',
  country_code: '',
  duration_minutes: '',
  price_from: '',
  currency: 'USD',
  start_date: '',
  end_date: '',
  tags: '',
  publish_now: true,
};

const normalizeBaseUrl = (base) => (base || '').replace(/\/$/, '');

export default function OperatorToursNew() {
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const [accessCode, setAccessCode] = useState('');
  const [providerForm, setProviderForm] = useState(emptyProvider);
  const [providerStatus, setProviderStatus] = useState(null);
  const [providerMessage, setProviderMessage] = useState(null);
  const [tourForm, setTourForm] = useState(emptyTour);
  const [tourMessage, setTourMessage] = useState(null);
  const [providerLoading, setProviderLoading] = useState(false);
  const [tourLoading, setTourLoading] = useState(false);
  const [providerLookupId, setProviderLookupId] = useState('');

  const accessCodeTrimmed = accessCode.trim();

  const handleProviderChange = (field, value) => {
    setProviderForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTourChange = (field, value) => {
    setTourForm((prev) => ({ ...prev, [field]: value }));
  };

  const ensureAccessCode = () => {
    if (!accessCodeTrimmed) {
      setProviderMessage('Access code requerido.');
      setTourMessage('Access code requerido.');
      return false;
    }
    return true;
  };

  const handleCreateProvider = async (event) => {
    event.preventDefault();
    setProviderMessage(null);
    if (!ensureAccessCode()) return;

    setProviderLoading(true);
    try {
      const payload = {
        ...providerForm,
        type: providerForm.type || 'operator',
        name: providerForm.name.trim(),
        email: providerForm.email.trim(),
        phone: providerForm.phone.trim() || undefined,
        base_city: providerForm.base_city.trim(),
        country_code: providerForm.country_code.trim().toUpperCase(),
        languages: providerForm.languages.trim(),
        access_code: accessCodeTrimmed,
      };

      const response = await fetch(`${apiBase}/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-access-code': accessCodeTrimmed,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message || data?.error || 'No se pudo crear el operador.';
        throw new Error(message);
      }

      const providerId = data?.provider?.id || data?.id;
      if (providerId) {
        setTourForm((prev) => ({ ...prev, provider_id: providerId }));
        setProviderLookupId(providerId);
      }

      setProviderStatus(data?.provider || data || null);
      setProviderMessage('Operador creado. Guarda el ID para cargar tours.');
    } catch (err) {
      setProviderMessage(err?.message || 'Error creando operador.');
    } finally {
      setProviderLoading(false);
    }
  };

  const handleLookupProvider = async (event) => {
    event.preventDefault();
    setProviderMessage(null);
    if (!providerLookupId.trim()) {
      setProviderMessage('Ingresa un ID de operador.');
      return;
    }
    setProviderLoading(true);
    try {
      const response = await fetch(`${apiBase}/providers/${encodeURIComponent(providerLookupId.trim())}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message || data?.error || 'No se pudo obtener el operador.';
        throw new Error(message);
      }
      setProviderStatus(data);
      setProviderMessage(`Operador encontrado: ${data?.name || data?.id}`);
    } catch (err) {
      setProviderMessage(err?.message || 'Error consultando operador.');
    } finally {
      setProviderLoading(false);
    }
  };

  const handleCreateTour = async (event) => {
    event.preventDefault();
    setTourMessage(null);
    if (!ensureAccessCode()) return;
    if (!tourForm.provider_id.trim()) {
      setTourMessage('Provider ID requerido.');
      return;
    }
    if (!tourForm.title.trim() || !tourForm.category.trim() || !tourForm.city.trim() || !tourForm.country_code.trim()) {
      setTourMessage('Completa los campos requeridos: titulo, categoria, ciudad, pais.');
      return;
    }

    setTourLoading(true);
    try {
      const payload = {
        provider_id: tourForm.provider_id.trim(),
        title: tourForm.title.trim(),
        category: tourForm.category.trim(),
        description: tourForm.description.trim() || null,
        city: tourForm.city.trim(),
        country_code: tourForm.country_code.trim().toUpperCase(),
        duration_minutes: tourForm.duration_minutes ? Number(tourForm.duration_minutes) : undefined,
        price_from: tourForm.price_from ? Number(tourForm.price_from) : undefined,
        currency: tourForm.currency || undefined,
        start_date: tourForm.start_date || undefined,
        end_date: tourForm.end_date || undefined,
        tags: tourForm.tags
          ? tourForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : undefined,
        status: tourForm.publish_now ? 'published' : 'draft',
        access_code: accessCodeTrimmed,
      };

      const response = await fetch(`${apiBase}/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-access-code': accessCodeTrimmed,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message || data?.error || 'No se pudo crear el tour.';
        throw new Error(message);
      }

      setTourMessage(`Tour creado: ${data?.title || payload.title}`);
      setTourForm((prev) => ({ ...emptyTour, provider_id: prev.provider_id }));
    } catch (err) {
      setTourMessage(err?.message || 'Error creando tour.');
    } finally {
      setTourLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12">
        <header className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <img src="/wadatrip.png" alt="Wadatrip" className="h-20 w-20 rounded-2xl bg-white/10 p-2 shadow-lg" />
            <span className="text-xs uppercase tracking-[0.3em] text-teal-200">Operator onboarding</span>
          </div>
          <h1 className="text-3xl font-semibold md:text-4xl">Publish tours on Wadatrip</h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-200">
            Start with your access code, add your operator details, then publish a tour in minutes.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-teal-200">Step 1</p>
              <h2 className="text-xl font-semibold">Access code</h2>
              <p className="text-sm text-slate-300">Required to unlock self-serve publishing.</p>
            </div>
          </div>
          <div className="mt-6">
            <label className="text-sm text-slate-200">Access code</label>
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Enter your access code"
              className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
          <div className="space-y-1">
            <p className="text-sm text-teal-200">Step 2 (optional)</p>
            <h2 className="text-xl font-semibold">Operator details</h2>
            <p className="text-sm text-slate-300">Create or validate your operator profile.</p>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleCreateProvider}>
            <div>
              <label className="text-sm text-slate-200">Full name</label>
              <Input
                value={providerForm.name}
                onChange={(event) => handleProviderChange('name', event.target.value)}
                placeholder="Jane Doe"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-200">Email</label>
              <Input
                value={providerForm.email}
                onChange={(event) => handleProviderChange('email', event.target.value)}
                placeholder="you@company.com"
                type="email"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-200">Phone</label>
              <Input
                value={providerForm.phone}
                onChange={(event) => handleProviderChange('phone', event.target.value)}
                placeholder="+1 555 123 456"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-200">Base city</label>
              <Input
                value={providerForm.base_city}
                onChange={(event) => handleProviderChange('base_city', event.target.value)}
                placeholder="Lima"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-200">Country (ISO2)</label>
              <Input
                value={providerForm.country_code}
                onChange={(event) => handleProviderChange('country_code', event.target.value)}
                placeholder="PE"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-200">Languages</label>
              <Input
                value={providerForm.languages}
                onChange={(event) => handleProviderChange('languages', event.target.value)}
                placeholder="es,en"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-200">Operator type</label>
              <select
                value={providerForm.type}
                onChange={(event) => handleProviderChange('type', event.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white"
              >
                <option value="operator">Operator</option>
                <option value="guide">Guide</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="h-12 w-full bg-teal-300 text-slate-900 hover:bg-teal-200 md:w-auto"
                disabled={providerLoading}
              >
                {providerLoading ? 'Creating...' : 'Create operator'}
              </Button>
            </div>
          </form>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleLookupProvider}>
              <div className="flex-1">
                <label className="text-sm text-slate-200">Verify operator by ID</label>
                <Input
                  value={providerLookupId}
                  onChange={(event) => setProviderLookupId(event.target.value)}
                  placeholder="provider_id"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <Button
                type="submit"
                className="h-12 bg-teal-300 text-slate-900 hover:bg-teal-200"
                disabled={providerLoading}
              >
                {providerLoading ? 'Checking...' : 'Verify'}
              </Button>
            </form>
            {providerStatus && (
              <div className="mt-4 text-sm text-slate-200">
                <div>ID: {providerStatus.id}</div>
                <div>Status: {providerStatus.status || providerStatus.verification_status || 'pending'}</div>
              </div>
            )}
            {providerMessage && <p className="mt-3 text-sm text-teal-100">{providerMessage}</p>}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
          <div className="space-y-1">
            <p className="text-sm text-teal-200">Step 3</p>
            <h2 className="text-xl font-semibold">Tour details</h2>
            <p className="text-sm text-slate-300">Publish the experience you want to sell.</p>
          </div>

          <form className="mt-6 grid gap-5" onSubmit={handleCreateTour}>
            <div>
              <label className="text-sm text-slate-200">Provider ID</label>
              <Input
                value={tourForm.provider_id}
                onChange={(event) => handleTourChange('provider_id', event.target.value)}
                placeholder="provider_id"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-slate-200">Tour title</label>
                <Input
                  value={tourForm.title}
                  onChange={(event) => handleTourChange('title', event.target.value)}
                  placeholder="Sunrise hike in the Andes"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">Category</label>
                <Input
                  value={tourForm.category}
                  onChange={(event) => handleTourChange('category', event.target.value)}
                  placeholder="tour"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">City</label>
                <Input
                  value={tourForm.city}
                  onChange={(event) => handleTourChange('city', event.target.value)}
                  placeholder="Cusco"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">Country (ISO2)</label>
                <Input
                  value={tourForm.country_code}
                  onChange={(event) => handleTourChange('country_code', event.target.value)}
                  placeholder="PE"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">Duration (minutes)</label>
                <Input
                  value={tourForm.duration_minutes}
                  onChange={(event) => handleTourChange('duration_minutes', event.target.value)}
                  placeholder="240"
                  type="number"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">Starting price</label>
                <Input
                  value={tourForm.price_from}
                  onChange={(event) => handleTourChange('price_from', event.target.value)}
                  placeholder="120"
                  type="number"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">Currency</label>
                <Input
                  value={tourForm.currency}
                  onChange={(event) => handleTourChange('currency', event.target.value)}
                  placeholder="USD"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">Start date</label>
                <Input
                  value={tourForm.start_date}
                  onChange={(event) => handleTourChange('start_date', event.target.value)}
                  type="date"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <label className="text-sm text-slate-200">End date</label>
                <Input
                  value={tourForm.end_date}
                  onChange={(event) => handleTourChange('end_date', event.target.value)}
                  type="date"
                  className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-200">Description</label>
              <Textarea
                value={tourForm.description}
                onChange={(event) => handleTourChange('description', event.target.value)}
                placeholder="Describe the experience, meeting point, and highlights."
                className="mt-2 min-h-[120px] bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-200">Tags</label>
              <Input
                value={tourForm.tags}
                onChange={(event) => handleTourChange('tags', event.target.value)}
                placeholder="adventure, sunrise, hiking"
                className="mt-2 h-12 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={tourForm.publish_now}
                onChange={(event) => handleTourChange('publish_now', event.target.checked)}
              />
              Publish immediately
            </label>
            <Button
              type="submit"
              className="h-12 w-full bg-orange-400 text-slate-900 hover:bg-orange-300 md:w-auto"
              disabled={tourLoading}
            >
              {tourLoading ? 'Publishing...' : 'Publish tour'}
            </Button>
          </form>
          {tourMessage && <p className="mt-4 text-sm text-teal-100">{tourMessage}</p>}
        </section>
      </div>
    </div>
  );
}
