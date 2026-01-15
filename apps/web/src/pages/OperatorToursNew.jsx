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
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-orange-700 to-orange-600 text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Crear nuevo tour o experiencia</h1>
          <p className="text-orange-100 text-sm">
            Usa el access code para crear operadores y publicar tours sin login formal.
          </p>
        </header>

        <section className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur">
          <h2 className="text-lg font-semibold mb-4">Access code</h2>
          <Input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder="Access code"
            className="bg-white/20 text-white placeholder:text-white/60"
          />
        </section>

        <section className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur">
          <h2 className="text-lg font-semibold mb-4">Crear operador (opcional)</h2>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateProvider}>
            <Input
              value={providerForm.name}
              onChange={(event) => handleProviderChange('name', event.target.value)}
              placeholder="Nombre completo"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <Input
              value={providerForm.email}
              onChange={(event) => handleProviderChange('email', event.target.value)}
              placeholder="Email"
              type="email"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <Input
              value={providerForm.phone}
              onChange={(event) => handleProviderChange('phone', event.target.value)}
              placeholder="Telefono"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <Input
              value={providerForm.base_city}
              onChange={(event) => handleProviderChange('base_city', event.target.value)}
              placeholder="Ciudad base"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <Input
              value={providerForm.country_code}
              onChange={(event) => handleProviderChange('country_code', event.target.value)}
              placeholder="Pais (ISO2)"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <Input
              value={providerForm.languages}
              onChange={(event) => handleProviderChange('languages', event.target.value)}
              placeholder="Idiomas (es,en)"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <select
              value={providerForm.type}
              onChange={(event) => handleProviderChange('type', event.target.value)}
              className="h-9 rounded-md border border-white/30 bg-white/20 px-3 text-sm text-white"
            >
              <option value="operator">operator</option>
              <option value="guide">guide</option>
            </select>
            <div className="flex items-center gap-3">
              <Button type="submit" className="w-full md:w-auto" disabled={providerLoading}>
                {providerLoading ? 'Creando...' : 'Crear operador'}
              </Button>
            </div>
          </form>
          {providerMessage && <p className="mt-3 text-sm text-orange-100">{providerMessage}</p>}
        </section>

        <section className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur">
          <h2 className="text-lg font-semibold mb-4">Validar operador</h2>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleLookupProvider}>
            <Input
              value={providerLookupId}
              onChange={(event) => setProviderLookupId(event.target.value)}
              placeholder="provider_id"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <Button type="submit" disabled={providerLoading}>
              {providerLoading ? 'Buscando...' : 'Validar'}
            </Button>
          </form>
          {providerStatus && (
            <div className="mt-4 text-sm text-orange-100">
              <div>ID: {providerStatus.id}</div>
              <div>Estado: {providerStatus.status || providerStatus.verification_status || 'pending'}</div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur">
          <h2 className="text-lg font-semibold mb-4">Nuevo tour</h2>
          <form className="grid gap-4" onSubmit={handleCreateTour}>
            <Input
              value={tourForm.provider_id}
              onChange={(event) => handleTourChange('provider_id', event.target.value)}
              placeholder="provider_id"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                value={tourForm.title}
                onChange={(event) => handleTourChange('title', event.target.value)}
                placeholder="Titulo del tour"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.category}
                onChange={(event) => handleTourChange('category', event.target.value)}
                placeholder="Categoria (tour)"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.city}
                onChange={(event) => handleTourChange('city', event.target.value)}
                placeholder="Ciudad"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.country_code}
                onChange={(event) => handleTourChange('country_code', event.target.value)}
                placeholder="Pais (ISO2)"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.duration_minutes}
                onChange={(event) => handleTourChange('duration_minutes', event.target.value)}
                placeholder="Duracion (min)"
                type="number"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.price_from}
                onChange={(event) => handleTourChange('price_from', event.target.value)}
                placeholder="Precio desde"
                type="number"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.currency}
                onChange={(event) => handleTourChange('currency', event.target.value)}
                placeholder="Moneda (USD)"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.start_date}
                onChange={(event) => handleTourChange('start_date', event.target.value)}
                placeholder="Fecha inicio"
                type="date"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
              <Input
                value={tourForm.end_date}
                onChange={(event) => handleTourChange('end_date', event.target.value)}
                placeholder="Fecha fin"
                type="date"
                className="bg-white/20 text-white placeholder:text-white/60"
              />
            </div>
            <Textarea
              value={tourForm.description}
              onChange={(event) => handleTourChange('description', event.target.value)}
              placeholder="Descripcion"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <Input
              value={tourForm.tags}
              onChange={(event) => handleTourChange('tags', event.target.value)}
              placeholder="Tags (aventura, playa, familia)"
              className="bg-white/20 text-white placeholder:text-white/60"
            />
            <label className="flex items-center gap-2 text-sm text-orange-100">
              <input
                type="checkbox"
                checked={tourForm.publish_now}
                onChange={(event) => handleTourChange('publish_now', event.target.checked)}
              />
              Publicar inmediatamente
            </label>
            <Button type="submit" className="w-full md:w-auto" disabled={tourLoading}>
              {tourLoading ? 'Enviando...' : 'Crear tour'}
            </Button>
          </form>
          {tourMessage && <p className="mt-3 text-sm text-orange-100">{tourMessage}</p>}
        </section>
      </div>
    </div>
  );
}
