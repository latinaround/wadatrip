import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../config/appConfig';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { buildTourCode, buildTourSlug, findListingIdFromSlug, isLikelyListingId } from '../utils/tourSlug';

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
  const { t } = useTranslation();
  const apiBase = useMemo(() => normalizeBaseUrl(AppConfig.api.baseUrl), []);
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const [accessCode, setAccessCode] = useState('');
  const [providerForm, setProviderForm] = useState(emptyProvider);
  const [providerStatus, setProviderStatus] = useState(null);
  const [providerMessage, setProviderMessage] = useState(null);
  const [tourForm, setTourForm] = useState(emptyTour);
  const [tourMessage, setTourMessage] = useState(null);
  const [providerLoading, setProviderLoading] = useState(false);
  const [tourLoading, setTourLoading] = useState(false);
  const [providerLookupId, setProviderLookupId] = useState('');
  const [createdTour, setCreatedTour] = useState(null);
  const [editLookup, setEditLookup] = useState('');
  const [editMessage, setEditMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [pendingEditId, setPendingEditId] = useState(null);
  const [isFreeTour, setIsFreeTour] = useState(false);

  const accessCodeTrimmed = accessCode.trim();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId) {
      setEditLookup(editId);
      setPendingEditId(editId);
    }
  }, []);

  const handleProviderChange = (field, value) => {
    setProviderForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTourChange = (field, value) => {
    setTourForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildTagsPayload = () => {
    const tags = tourForm.tags
      ? tourForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];
    if (isFreeTour && !tags.includes('free_tour')) tags.push('free_tour');
    if (!isFreeTour) return tags.filter((tag) => tag !== 'free_tour');
    return tags;
  };

  const ensureAccessCode = () => {
    if (!accessCodeTrimmed) {
      setProviderMessage(t('operator.messages.access_required', 'Access code is required.'));
      setTourMessage(t('operator.messages.access_required', 'Access code is required.'));
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
        const message = data?.message || data?.error || 'Operator could not be created.';
        throw new Error(message);
      }

      const providerId = data?.provider?.id || data?.id;
      if (providerId) {
        setTourForm((prev) => ({ ...prev, provider_id: providerId }));
        setProviderLookupId(providerId);
      }

      setProviderStatus(data?.provider || data || null);
      setProviderMessage(
        t('operator.messages.operator_created', 'Operator created. Save the ID to publish tours.')
      );
    } catch (err) {
      setProviderMessage(
        err?.message || t('operator.messages.operator_create_error', 'Error creating operator.')
      );
    } finally {
      setProviderLoading(false);
    }
  };

  const handleLookupProvider = async (event) => {
    event.preventDefault();
    setProviderMessage(null);
    if (!providerLookupId.trim()) {
      setProviderMessage(t('operator.messages.operator_id_required', 'Enter an operator ID.'));
      return;
    }
    setProviderLoading(true);
    try {
      const response = await fetch(`${apiBase}/providers/${encodeURIComponent(providerLookupId.trim())}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message || data?.error || 'Operator could not be loaded.';
        throw new Error(message);
      }
      setProviderStatus(data);
      setProviderMessage(
        t('operator.messages.operator_found', 'Operator found: {{name}}', {
          name: data?.name || data?.id,
        })
      );
    } catch (err) {
      setProviderMessage(
        err?.message || t('operator.messages.operator_fetch_error', 'Error fetching operator.')
      );
    } finally {
      setProviderLoading(false);
    }
  };

  const handleCreateTour = async (event) => {
    event.preventDefault();
    setTourMessage(null);
    if (editingId) {
      setTourMessage(
        t('operator.messages.use_update', 'Use "Update tour" to save changes to an existing tour.')
      );
      return;
    }
    if (!ensureAccessCode()) return;
    if (!tourForm.provider_id.trim()) {
      setTourMessage(t('operator.messages.provider_id_required', 'Provider ID is required.'));
      return;
    }
    if (!tourForm.title.trim() || !tourForm.category.trim() || !tourForm.city.trim() || !tourForm.country_code.trim()) {
      setTourMessage(
        t('operator.messages.required_fields', 'Complete required fields: title, category, city, country.')
      );
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
        tags: buildTagsPayload(),
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
        const message = data?.message || data?.error || 'Tour could not be created.';
        throw new Error(message);
      }

      const created = data?.listing || data;
      setCreatedTour(created);
      setTourMessage(
        t('operator.messages.tour_created', 'Tour created: {{title}}', {
          title: created?.title || payload.title,
        })
      );
      setTourForm((prev) => ({ ...emptyTour, provider_id: prev.provider_id }));
    } catch (err) {
      setTourMessage(
        err?.message || t('operator.messages.tour_create_error', 'Error creating tour.')
      );
    } finally {
      setTourLoading(false);
    }
  };

  const handleLoadTourById = async (listingId) => {
    setEditMessage(null);
    if (!ensureAccessCode()) return;
    if (!listingId) {
      setEditMessage(t('operator.messages.tour_link_required', 'Enter a tour link or ID.'));
      return;
    }

    setTourLoading(true);
    try {
      const response = await fetch(`${apiBase}/listings/${encodeURIComponent(listingId)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || t('operator.messages.tour_load_error', 'Error loading tour.')
        );
      }
      setEditingId(listingId);
      setCreatedTour(data);
      setTourForm({
        provider_id: data?.provider_id || '',
        title: data?.title || '',
        category: data?.category || 'tour',
        description: data?.description || '',
        city: data?.city || '',
        country_code: data?.country_code || '',
        duration_minutes: data?.duration_minutes ?? '',
        price_from: data?.price_from ?? '',
        currency: data?.currency || 'USD',
        start_date: data?.start_date ? String(data.start_date).slice(0, 10) : '',
        end_date: data?.end_date ? String(data.end_date).slice(0, 10) : '',
        tags: Array.isArray(data?.tags) ? data.tags.filter((tag) => tag !== 'free_tour').join(', ') : '',
        publish_now: data?.status ? String(data.status).toLowerCase() === 'published' : true,
      });
      setIsFreeTour(Array.isArray(data?.tags) && data.tags.includes('free_tour'));
      setEditMessage(t('operator.messages.tour_loaded', 'Tour loaded. Update the fields and save.'));
    } catch (err) {
      setEditMessage(err?.message || t('operator.messages.tour_load_error', 'Error loading tour.'));
    } finally {
      setTourLoading(false);
    }
  };

  const resolveEditId = async () => {
    const raw = editLookup.trim();
    if (!raw) return null;
    let slugOrId = raw;
    if (raw.includes('/tours/')) {
      slugOrId = raw.split('/tours/')[1] || raw;
    }
    slugOrId = slugOrId.split('?')[0].split('#')[0];
    if (isLikelyListingId(slugOrId)) return slugOrId;

    const response = await fetch(`${apiBase}/listings/search?status=published&limit=200`);
    const data = await response.json().catch(() => null);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return findListingIdFromSlug(slugOrId, items);
  };

  useEffect(() => {
    if (pendingEditId && accessCodeTrimmed) {
      handleLoadTourById(pendingEditId);
      setPendingEditId(null);
    }
  }, [pendingEditId, accessCodeTrimmed]);

  const handleLoadTour = async (event) => {
    event.preventDefault();
    setEditMessage(null);
    if (!accessCodeTrimmed) {
      setEditMessage(
        t('operator.messages.access_required_load', 'Access code is required to load a tour.')
      );
      return;
    }
    if (!editLookup.trim()) {
      setEditMessage(t('operator.messages.tour_link_required', 'Enter a tour link or ID.'));
      return;
    }
    try {
      const listingId = await resolveEditId();
      if (!listingId) {
        throw new Error(t('operator.messages.tour_not_found', 'Tour not found. Check the link or ID.'));
      }
      await handleLoadTourById(listingId);
    } catch (err) {
      setEditMessage(err?.message || t('operator.messages.tour_load_error', 'Error loading tour.'));
    }
  };

  const handleUpdateTour = async () => {
    setTourMessage(null);
    setEditMessage(null);
    if (!ensureAccessCode()) return;
    if (!editingId) {
      setEditMessage(t('operator.messages.update_requires_load', 'Load a tour before updating.'));
      return;
    }
    setTourLoading(true);
    try {
      const payload = {
        title: tourForm.title.trim(),
        category: tourForm.category.trim(),
        description: tourForm.description.trim() || null,
        city: tourForm.city.trim(),
        country_code: tourForm.country_code.trim().toUpperCase(),
        duration_minutes: tourForm.duration_minutes ? Number(tourForm.duration_minutes) : undefined,
        price_from: tourForm.price_from ? Number(tourForm.price_from) : undefined,
        currency: tourForm.currency || undefined,
        start_date: tourForm.start_date || null,
        end_date: tourForm.end_date || null,
        tags: buildTagsPayload(),
        access_code: accessCodeTrimmed,
      };

      const response = await fetch(`${apiBase}/listings/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-access-code': accessCodeTrimmed,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Tour could not be updated.');
      }

      setCreatedTour(data);
      setTourMessage(t('operator.messages.tour_updated', 'Tour updated successfully.'));
    } catch (err) {
      setTourMessage(
        err?.message || t('operator.messages.tour_update_error', 'Error updating tour.')
      );
    } finally {
      setTourLoading(false);
    }
  };

  const handleDeleteTour = async () => {
    setTourMessage(null);
    setEditMessage(null);
    if (!ensureAccessCode()) return;
    if (!editingId) {
      setEditMessage(t('operator.messages.delete_requires_load', 'Load a tour before deleting.'));
      return;
    }
    const confirmed = window.confirm('Delete this tour? This cannot be undone.');
    if (!confirmed) return;
    setTourLoading(true);
    try {
      const response = await fetch(`${apiBase}/listings/${encodeURIComponent(editingId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-access-code': accessCodeTrimmed,
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Tour could not be deleted.');
      }
      setTourMessage(t('operator.messages.tour_deleted', 'Tour deleted.'));
      setEditingId(null);
      setCreatedTour(null);
      setTourForm((prev) => ({ ...emptyTour, provider_id: prev.provider_id }));
    } catch (err) {
      setTourMessage(
        err?.message || t('operator.messages.tour_delete_error', 'Error deleting tour.')
      );
    } finally {
      setTourLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-container flex w-full flex-col gap-10">
        <header className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="page-kicker">{t('operator.kicker', 'Operator onboarding')}</span>
          </div>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">
            {t('operator.publish_title', 'Publish tours on Wadatrip')}
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-[#a0a0a0]">
            {t(
              'operator.subtitle',
              'Start with your access code, add your operator details, then publish a tour in minutes.'
            )}
          </p>
        </header>

        <section className="page-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#00D9FF]">{t('operator.step1_label', 'Step 1')}</p>
              <h2 className="text-xl font-semibold text-white">
                {t('operator.access_title', 'Access code')}
              </h2>
              <p className="text-sm text-[#a0a0a0]">
                {t('operator.access_help', 'Required to unlock self-serve publishing.')}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <label htmlFor="access-code" className="text-sm text-[#e0e0e0]">
              {t('operator.access_label', 'Access code')}
            </label>
            <Input
              id="access-code"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder={t('operator.access_placeholder', 'Enter your access code')}
              className="mt-2 h-12 neon-input"
            />
          </div>
        </section>

        <section className="page-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {t('operator.edit_kicker', 'Edit your tour')}
              </h2>
              <p className="text-sm text-[#a0a0a0]">
                {t('operator.edit_kicker_help', 'Already published? Jump to the edit section.')}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label htmlFor="edit-tour-link" className="text-sm text-[#e0e0e0]">
                {t('operator.tour_link_label', 'Tour link or ID')}
              </label>
              <Input
                id="edit-tour-link"
                value={editLookup}
                onChange={(event) => setEditLookup(event.target.value)}
                placeholder={t('operator.tour_link_placeholder', 'https://wadatrip.com/tours/...')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <Button
              type="button"
              className="h-12 w-full neon-cta font-black hover:scale-105 transition-all md:w-auto"
              onClick={handleLoadTour}
              disabled={tourLoading}
            >
              {tourLoading ? t('operator.loading_label', 'Loading...') : t('operator.load_tour', 'Load tour')}
            </Button>
          </div>
        </section>

        <section className="page-card" id="edit-tour">
          <div className="space-y-1">
            <p className="text-sm text-[#00D9FF]">{t('operator.step2_label', 'Step 2 (optional)')}</p>
            <h2 className="text-xl font-semibold text-white">
              {t('operator.operator_title', 'Operator details')}
            </h2>
            <p className="text-sm text-[#a0a0a0]">
              {t('operator.operator_help', 'Create or validate your operator profile.')}
            </p>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleCreateProvider}>
            <div>
              <label htmlFor="provider-name" className="text-sm text-[#e0e0e0]">
                {t('operator.full_name_label', 'Full name')}
              </label>
              <Input
                id="provider-name"
                value={providerForm.name}
                onChange={(event) => handleProviderChange('name', event.target.value)}
                placeholder={t('operator.full_name_placeholder', 'Jane Doe')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-email" className="text-sm text-[#e0e0e0]">
                {t('operator.email_label', 'Email')}
              </label>
              <Input
                id="provider-email"
                value={providerForm.email}
                onChange={(event) => handleProviderChange('email', event.target.value)}
                placeholder={t('operator.email_placeholder', 'you@company.com')}
                type="email"
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-phone" className="text-sm text-[#e0e0e0]">
                {t('operator.phone_label', 'Phone')}
              </label>
              <Input
                id="provider-phone"
                value={providerForm.phone}
                onChange={(event) => handleProviderChange('phone', event.target.value)}
                placeholder={t('operator.phone_placeholder', '+1 555 123 456')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-base-city" className="text-sm text-[#e0e0e0]">
                {t('operator.base_city_label', 'Base city')}
              </label>
              <Input
                id="provider-base-city"
                value={providerForm.base_city}
                onChange={(event) => handleProviderChange('base_city', event.target.value)}
                placeholder={t('operator.base_city_placeholder', 'Lima')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-country" className="text-sm text-[#e0e0e0]">
                {t('operator.country_label', 'Country (ISO2)')}
              </label>
              <Input
                id="provider-country"
                value={providerForm.country_code}
                onChange={(event) => handleProviderChange('country_code', event.target.value)}
                placeholder={t('operator.country_placeholder', 'PE')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-languages" className="text-sm text-[#e0e0e0]">
                {t('operator.languages_label', 'Languages')}
              </label>
              <Input
                id="provider-languages"
                value={providerForm.languages}
                onChange={(event) => handleProviderChange('languages', event.target.value)}
                placeholder={t('operator.languages_placeholder', 'es,en')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-type" className="text-sm text-[#e0e0e0]">
                {t('operator.type_label', 'Operator type')}
              </label>
              <select
                id="provider-type"
                value={providerForm.type}
                onChange={(event) => handleProviderChange('type', event.target.value)}
                className="mt-2 h-12 w-full rounded-md border border-[#00D9FF]/30 bg-[#1a1f3a] px-3 text-sm text-white"
              >
                <option value="operator">{t('operator.type_operator', 'Operator')}</option>
                <option value="guide">{t('operator.type_guide', 'Guide')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="h-12 w-full neon-cta font-black hover:scale-105 transition-all md:w-auto"
                disabled={providerLoading}
              >
                {providerLoading
                  ? t('operator.creating_label', 'Creating...')
                  : t('operator.create_button', 'Create operator')}
              </Button>
            </div>
          </form>

          <div className="mt-6 page-card">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleLookupProvider}>
              <div className="flex-1">
                <label htmlFor="provider-lookup-id" className="text-sm text-[#e0e0e0]">
                  {t('operator.verify_title', 'Verify operator by ID')}
                </label>
                <Input
                  id="provider-lookup-id"
                  value={providerLookupId}
                  onChange={(event) => setProviderLookupId(event.target.value)}
                  placeholder={t('operator.provider_id_placeholder', 'provider_id')}
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <Button
                type="submit"
                className="h-12 neon-cta font-black hover:scale-105 transition-all"
                disabled={providerLoading}
              >
                {providerLoading
                  ? t('operator.checking_label', 'Checking...')
                  : t('operator.verify_button', 'Verify')}
              </Button>
            </form>
            {providerStatus && (
              <div className="mt-4 text-sm text-[#a0a0a0]">
                <div>ID: {providerStatus.id}</div>
                <div>Status: {providerStatus.status || providerStatus.verification_status || 'pending'}</div>
              </div>
            )}
            {providerMessage && <p className="mt-3 text-sm text-[#00D9FF]">{providerMessage}</p>}
          </div>
        </section>

        <section className="page-card">
          <div className="space-y-1">
            <p className="text-sm text-[#00D9FF]">{t('operator.step3_label', 'Step 3')}</p>
            <h2 className="text-xl font-semibold text-white">{t('operator.tour_title', 'Tour details')}</h2>
            <p className="text-sm text-[#a0a0a0]">
              {t('operator.tour_help', 'Publish the experience you want to sell.')}
            </p>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-[2fr_1fr]" onSubmit={handleLoadTour}>
            <div>
              <label htmlFor="tour-edit-lookup" className="text-sm text-[#e0e0e0]">
                {t('operator.tour_link_label', 'Tour link or ID')}
              </label>
              <Input
                id="tour-edit-lookup"
                value={editLookup}
                onChange={(event) => setEditLookup(event.target.value)}
                placeholder={t('operator.tour_link_placeholder', 'https://wadatrip.com/tours/...')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                className="h-12 w-full neon-cta font-black hover:scale-105 transition-all md:w-auto"
                disabled={tourLoading}
              >
                {tourLoading ? t('operator.loading_label', 'Loading...') : t('operator.load_tour', 'Load tour')}
              </Button>
            </div>
          </form>
          {editMessage && <p className="mt-3 text-sm text-[#00D9FF]">{editMessage}</p>}

          <form className="mt-6 grid gap-5" onSubmit={handleCreateTour}>
            <div>
              <label htmlFor="tour-provider-id" className="text-sm text-[#e0e0e0]">
                {t('operator.tour_provider_id_label', 'Provider ID')}
              </label>
              <Input
                id="tour-provider-id"
                value={tourForm.provider_id}
                onChange={(event) => handleTourChange('provider_id', event.target.value)}
                placeholder={t('operator.provider_id_placeholder', 'provider_id')}
                className="mt-2 h-12 neon-input"
                readOnly={Boolean(editingId)}
              />
              {editingId && (
                <p className="mt-2 text-xs text-[#a0a0a0]">
                  {t('operator.provider_id_locked', 'Provider ID is locked while editing.')}
                </p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="tour-title" className="text-sm text-[#e0e0e0]">
                  {t('operator.tour_title_label', 'Tour title')}
                </label>
                <Input
                  id="tour-title"
                  value={tourForm.title}
                  onChange={(event) => handleTourChange('title', event.target.value)}
                  placeholder={t('operator.tour_title_placeholder', 'Sunrise hike in the Andes')}
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-category" className="text-sm text-[#e0e0e0]">
                  {t('operator.category_label', 'Category')}
                </label>
                <Input
                  id="tour-category"
                  value={tourForm.category}
                  onChange={(event) => handleTourChange('category', event.target.value)}
                  placeholder={t('operator.category_placeholder', 'tour')}
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-city" className="text-sm text-[#e0e0e0]">
                  {t('operator.city_label', 'City')}
                </label>
                <Input
                  id="tour-city"
                  value={tourForm.city}
                  onChange={(event) => handleTourChange('city', event.target.value)}
                  placeholder={t('operator.city_placeholder', 'Cusco')}
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-country" className="text-sm text-[#e0e0e0]">
                  {t('operator.tour_country_label', 'Country (ISO2)')}
                </label>
                <Input
                  id="tour-country"
                  value={tourForm.country_code}
                  onChange={(event) => handleTourChange('country_code', event.target.value)}
                  placeholder={t('operator.country_placeholder', 'PE')}
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-duration" className="text-sm text-[#e0e0e0]">
                  {t('operator.duration_label', 'Duration (minutes)')}
                </label>
                <Input
                  id="tour-duration"
                  value={tourForm.duration_minutes}
                  onChange={(event) => handleTourChange('duration_minutes', event.target.value)}
                  placeholder={t('operator.duration_placeholder', '240')}
                  type="number"
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-price" className="text-sm text-[#e0e0e0]">
                  {t('operator.price_label', 'Starting price')}
                </label>
                <Input
                  id="tour-price"
                  value={tourForm.price_from}
                  onChange={(event) => handleTourChange('price_from', event.target.value)}
                  placeholder={t('operator.price_placeholder', '120')}
                  type="number"
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-currency" className="text-sm text-[#e0e0e0]">
                  {t('operator.currency_label', 'Currency')}
                </label>
                <Input
                  id="tour-currency"
                  value={tourForm.currency}
                  onChange={(event) => handleTourChange('currency', event.target.value)}
                  placeholder={t('operator.currency_placeholder', 'USD')}
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-start-date" className="text-sm text-[#e0e0e0]">
                  {t('operator.start_date_label', 'Start date')}
                </label>
                <Input
                  id="tour-start-date"
                  value={tourForm.start_date}
                  onChange={(event) => handleTourChange('start_date', event.target.value)}
                  type="date"
                  className="mt-2 h-12 neon-input"
                />
              </div>
              <div>
                <label htmlFor="tour-end-date" className="text-sm text-[#e0e0e0]">
                  {t('operator.end_date_label', 'End date')}
                </label>
                <Input
                  id="tour-end-date"
                  value={tourForm.end_date}
                  onChange={(event) => handleTourChange('end_date', event.target.value)}
                  type="date"
                  className="mt-2 h-12 neon-input"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tour-description" className="text-sm text-[#e0e0e0]">
                {t('operator.description_label', 'Description')}
              </label>
              <Textarea
                id="tour-description"
                value={tourForm.description}
                onChange={(event) => handleTourChange('description', event.target.value)}
                placeholder={t(
                  'operator.description_placeholder',
                  'Describe the experience, meeting point, and highlights.'
                )}
                className="mt-2 min-h-[120px] neon-input"
              />
            </div>
            <div>
              <label htmlFor="tour-tags" className="text-sm text-[#e0e0e0]">
                {t('operator.tags_label', 'Tags')}
              </label>
              <Input
                id="tour-tags"
                value={tourForm.tags}
                onChange={(event) => handleTourChange('tags', event.target.value)}
                placeholder={t('operator.tags_placeholder', 'adventure, sunrise, hiking')}
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-[#e0e0e0]">
              <input
                id="tour-free"
                type="checkbox"
                checked={isFreeTour}
                onChange={(event) => setIsFreeTour(event.target.checked)}
              />
              <label htmlFor="tour-free">
                {t('operator.free_tour_label', 'Free walking tour (pay-what-you-want)')}
              </label>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#e0e0e0]">
              <input
                id="tour-publish-now"
                type="checkbox"
                checked={tourForm.publish_now}
                onChange={(event) => handleTourChange('publish_now', event.target.checked)}
              />
              <label htmlFor="tour-publish-now">
                {t('operator.publish_now_label', 'Publish immediately')}
              </label>
            </div>
            <Button
              type="submit"
              className="h-12 w-full neon-cta font-black hover:scale-105 transition-all md:w-auto"
              disabled={tourLoading}
            >
              {tourLoading
                ? t('operator.publishing_label', 'Publishing...')
                : t('operator.publish_button', 'Publish tour')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white md:w-auto"
              onClick={handleUpdateTour}
              disabled={tourLoading || !editingId}
            >
              {tourLoading ? t('operator.saving_label', 'Saving...') : t('operator.update_button', 'Update tour')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-12 w-full md:w-auto"
              onClick={handleDeleteTour}
              disabled={tourLoading || !editingId}
            >
              {tourLoading ? t('operator.deleting_label', 'Deleting...') : t('operator.delete_button', 'Delete tour')}
            </Button>
          </form>
          {tourMessage && <p className="mt-4 text-sm text-[#00D9FF]">{tourMessage}</p>}
          {createdTour?.id && (
            <div className="mt-4 space-y-2 text-sm text-[#a0a0a0]">
              <p>{t('operator.shareable_link_label', 'Shareable link (no internal ID):')}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  readOnly
                  value={`${siteOrigin}/tours/${buildTourSlug({
                    title: createdTour.title,
                    city: createdTour.city,
                    id: createdTour.id,
                  })}`}
                  className="h-12 neon-input"
                />
                <Button
                  type="button"
                  className="h-12 neon-cta font-black hover:scale-105 transition-all"
                  onClick={() => {
                    const url = `${siteOrigin}/tours/${buildTourSlug({
                      title: createdTour.title,
                      city: createdTour.city,
                      id: createdTour.id,
                    })}`;
                    navigator.clipboard?.writeText(url);
                  }}
                >
                  {t('operator.copy_tour_link', 'Copy tour link')}
                </Button>
              </div>
              <p>
                {t('operator.tour_code_label', 'Tour code')}:{' '}
                {buildTourCode({ city: createdTour.city, id: createdTour.id })}
              </p>
              <div className="mt-4 rounded-xl border border-[#00D9FF]/20 bg-[#0a0e27]/60 p-4">
                <p className="text-sm font-semibold text-white">
                  {t('operator.edit_title', 'Edit this tour')}
                </p>
                <p className="text-xs text-[#a0a0a0]">
                  {t('operator.edit_help', 'Use this link to edit later.')}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    readOnly
                    value={`${siteOrigin}/operator/tours/new?edit=${createdTour.id}`}
                    className="h-12 neon-input"
                  />
                  <Button
                    type="button"
                    className="h-12 neon-cta font-black hover:scale-105 transition-all"
                    onClick={() => {
                      const url = `${siteOrigin}/operator/tours/new?edit=${createdTour.id}`;
                      navigator.clipboard?.writeText(url);
                    }}
                  >
                    {t('operator.copy_edit_link', 'Copy edit link')}
                  </Button>
                </div>
                <Button
                  type="button"
                  className="mt-3 h-12 w-full neon-cta font-black hover:scale-105 transition-all md:w-auto"
                  onClick={() => handleLoadTourById(createdTour.id)}
                >
                  {t('operator.edit_button', 'Load for editing')}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

