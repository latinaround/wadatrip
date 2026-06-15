import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppConfig } from '../config/appConfig';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { buildTourCode, buildTourSlug, findListingIdFromSlug, isLikelyListingId } from '../utils/tourSlug';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadImageFile } from '../services/mediaUpload';

const emptyProvider = {
  type: 'operator',
  name: '',
  email: '',
  phone: '',
  instagram_handle: '',
  base_city: '',
  country_code: '',
  languages: '',
  photo_url: '',
  bio_short: '',
  license_url: '',
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
  cover_image_url: '',
  publish_now: true,
};

const normalizeBaseUrl = (base) => (base || '').replace(/\/$/, '');

const normalizeNullable = (value) => {
  const text = String(value || '').trim();
  return text || '';
};

export default function OperatorToursNew() {
  const { t } = useTranslation();
  const { user, token, logout } = useAuth();
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
  const [coverPreview, setCoverPreview] = useState('');
  const [loadingOwnedProvider, setLoadingOwnedProvider] = useState(false);
  const [providerPhotoUploading, setProviderPhotoUploading] = useState(false);
  const [tourCoverUploading, setTourCoverUploading] = useState(false);
  const [ownedListings, setOwnedListings] = useState([]);
  const [loadingOwnedListings, setLoadingOwnedListings] = useState(false);

  const accessCodeTrimmed = accessCode.trim();
  const isAuthenticatedMode = Boolean(token);
  const ownedProviderId = providerStatus?.id ? String(providerStatus.id) : '';
  const providerApprovalStatus = String(providerStatus?.status || providerStatus?.verification_status || '').toLowerCase();
  const providerApproved = ['approved', 'verified'].includes(providerApprovalStatus);
  const hasOwnedListings = ownedListings.length > 0;

  const authFetch = useCallback(async (path, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (accessCodeTrimmed) {
      headers.set('x-operator-access-code', accessCodeTrimmed);
    }

    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      ...init,
      headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }, [accessCodeTrimmed, apiBase, token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId) {
      setEditLookup(editId);
      setPendingEditId(editId);
    }
  }, []);

  const applyProviderProfile = useCallback((provider) => {
    if (!provider) return;
    setProviderStatus(provider);
    setProviderForm({
      type: provider?.type || 'guide',
      name: normalizeNullable(provider?.name || user?.name || user?.email?.split('@')?.[0]),
      email: normalizeNullable(provider?.email || user?.email),
      phone: normalizeNullable(provider?.phone),
      instagram_handle: normalizeNullable(provider?.instagram_handle),
      base_city: normalizeNullable(provider?.base_city),
      country_code: normalizeNullable(provider?.country_code),
      languages: Array.isArray(provider?.languages) ? provider.languages.join(', ') : normalizeNullable(provider?.languages),
      photo_url: normalizeNullable(provider?.photo_url),
      bio_short: normalizeNullable(provider?.bio_short),
      license_url: normalizeNullable(provider?.license_url),
    });
    setProviderLookupId(String(provider?.id || ''));
    setTourForm((prev) => ({
      ...prev,
      provider_id: String(provider?.id || prev.provider_id || ''),
      city: prev.city || normalizeNullable(provider?.base_city),
      country_code: prev.country_code || normalizeNullable(provider?.country_code),
    }));
  }, [user?.email, user?.name]);

  const loadOwnedProvider = useCallback(async () => {
    if (!token) {
      setProviderStatus(null);
      setProviderForm((prev) => ({
        ...prev,
        name: normalizeNullable(user?.name || user?.email?.split('@')?.[0]),
        email: normalizeNullable(user?.email),
      }));
      return null;
    }

    setLoadingOwnedProvider(true);
    try {
      const provider = await authFetch('/providers/me', { method: 'GET' });
      if (provider?.id) {
        applyProviderProfile(provider);
        return provider;
      }
      setProviderStatus(null);
      setProviderForm((prev) => ({
        ...prev,
        name: normalizeNullable(user?.name || user?.email?.split('@')?.[0]),
        email: normalizeNullable(user?.email),
      }));
      return null;
    } catch (error) {
      if (error?.status === 401) logout?.();
      setProviderStatus(null);
      return null;
    } finally {
      setLoadingOwnedProvider(false);
    }
  }, [applyProviderProfile, authFetch, logout, token, user?.email, user?.name]);

  useEffect(() => {
    loadOwnedProvider();
  }, [loadOwnedProvider]);

  const loadOwnedListings = useCallback(async () => {
    if (!token) {
      setOwnedListings([]);
      return [];
    }

    setLoadingOwnedListings(true);
    try {
      const data = await authFetch('/providers/me/listings?limit=200', { method: 'GET' });
      const items = Array.isArray(data?.items) ? data.items : [];
      setOwnedListings(items);
      return items;
    } catch (error) {
      if (error?.status === 401) logout?.();
      setOwnedListings([]);
      return [];
    } finally {
      setLoadingOwnedListings(false);
    }
  }, [authFetch, logout, token]);

  useEffect(() => {
    loadOwnedListings();
  }, [loadOwnedListings]);

  const handleProviderChange = (field, value) => {
    setProviderForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTourChange = (field, value) => {
    setTourForm((prev) => ({ ...prev, [field]: value }));
  };

  const uploadGuidePhoto = async (file) => {
    if (!file) return;
    setProviderMessage(null);
    setProviderPhotoUploading(true);
    try {
      const downloadURL = await uploadImageFile(file, {
        folder: 'guides',
        ownerId: user?.id || user?.email || providerForm.email || providerForm.name,
      });
      handleProviderChange('photo_url', downloadURL);
      setProviderMessage('Guide photo uploaded.');
    } catch (error) {
      setProviderMessage(error?.message || 'Could not upload guide photo.');
    } finally {
      setProviderPhotoUploading(false);
    }
  };

  const uploadTourCover = async (file) => {
    if (!file) return;
    setTourMessage(null);
    setTourCoverUploading(true);
    try {
      const downloadURL = await uploadImageFile(file, {
        folder: 'tour-covers',
        ownerId: user?.id || user?.email || ownedProviderId || tourForm.provider_id || providerForm.email,
      });
      handleTourChange('cover_image_url', downloadURL);
      setCoverPreview(downloadURL);
      setTourMessage('Tour cover uploaded.');
    } catch (error) {
      setTourMessage(error?.message || 'Could not upload tour cover.');
    } finally {
      setTourCoverUploading(false);
    }
  };

  const resolveDestinationCover = async (city, countryCode) => {
    const cityValue = String(city || '').trim();
    const countryValue = String(countryCode || '').trim().toUpperCase();
    if (!cityValue) return null;

    const params = new URLSearchParams();
    params.set('city', cityValue);
    if (countryValue) params.set('country_code', countryValue);

    const response = await fetch(`${apiBase}/destination-covers/resolve?${params.toString()}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || data?.error || 'Destination cover could not be resolved.');
    }
    return data?.item?.image_url ? String(data.item.image_url) : null;
  };

  const ensureTourCoverImage = async () => {
    const manual = String(tourForm.cover_image_url || '').trim();
    if (manual) return manual;
    return resolveDestinationCover(tourForm.city, tourForm.country_code);
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

    setProviderLoading(true);
    try {
      const payload = {
        ...providerForm,
        type: providerForm.type || 'operator',
        name: providerForm.name.trim(),
        email: providerForm.email.trim(),
        phone: providerForm.phone.trim() || undefined,
        instagram_handle: providerForm.instagram_handle.trim().replace(/^@+/, '') || undefined,
        base_city: providerForm.base_city.trim(),
        country_code: providerForm.country_code.trim().toUpperCase(),
        languages: providerForm.languages.trim(),
        photo_url: providerForm.photo_url.trim() || undefined,
        bio_short: providerForm.bio_short.trim() || undefined,
        license_url: providerForm.license_url.trim() || undefined,
      };

      let data = null;
      if (isAuthenticatedMode) {
        data = await authFetch('/providers/me', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        if (!ensureAccessCode()) return;
        data = await authFetch('/providers', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            access_code: accessCodeTrimmed,
          }),
        });
      }

      const providerRecord = data?.provider || data || null;
      const providerId = providerRecord?.id;
      if (providerId) {
        setTourForm((prev) => ({ ...prev, provider_id: providerId }));
        setProviderLookupId(providerId);
      }

      setProviderStatus(providerRecord);
      applyProviderProfile(providerRecord);
      setProviderMessage(
        isAuthenticatedMode
          ? 'Your guide profile was saved to your account.'
          : t('operator.messages.operator_created', 'Operator created. Save the ID to publish tours.')
      );
    } catch (err) {
      if (err?.status === 401) logout?.();
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
    if (isAuthenticatedMode) {
      try {
        const provider = await loadOwnedProvider();
        if (!provider?.id) {
          setProviderMessage('No guide profile is linked to this account yet.');
          return;
        }
        setProviderMessage(`Guide profile loaded: ${provider.name || provider.id}`);
      } catch (err) {
        setProviderMessage(err?.message || 'Error loading your guide profile.');
      }
      return;
    }
    if (!providerLookupId.trim()) {
      setProviderMessage(t('operator.messages.operator_id_required', 'Enter an operator ID.'));
      return;
    }
    setProviderLoading(true);
    try {
      const data = await authFetch(`/providers/${encodeURIComponent(providerLookupId.trim())}`, { method: 'GET' });
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
    const providerId = String(tourForm.provider_id || ownedProviderId || '').trim();
    if (!providerId) {
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
      const coverImageUrl = await ensureTourCoverImage();
      const payload = {
        provider_id: providerId,
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
        cover_image_url: coverImageUrl || undefined,
      };

      const data = await authFetch('/listings', {
        method: 'POST',
        body: JSON.stringify(
          isAuthenticatedMode
            ? payload
            : { ...payload, access_code: accessCodeTrimmed }
        ),
      });

      const created = data?.listing || data;
      setCreatedTour(created);
      setCoverPreview(created?.cover_image_url || coverImageUrl || '');
      setTourMessage(
        providerApproved
          ? t('operator.messages.tour_created', 'Tour created: {{title}}', {
              title: created?.title || payload.title,
            })
          : `Tour saved as ${String(created?.status || payload.status || 'draft')}. It will publish after approval.`
      );
      loadOwnedListings();
      setTourForm((prev) => ({
        ...emptyTour,
        provider_id: providerId,
        city: prev.city,
        country_code: prev.country_code,
      }));
    } catch (err) {
      if (err?.status === 401) logout?.();
      setTourMessage(
        err?.message || t('operator.messages.tour_create_error', 'Error creating tour.')
      );
    } finally {
      setTourLoading(false);
    }
  };

  const handleLoadTourById = async (listingId) => {
    setEditMessage(null);
    if (!listingId) {
      setEditMessage(t('operator.messages.tour_link_required', 'Enter a tour link or ID.'));
      return;
    }

    setTourLoading(true);
    try {
      const data = await authFetch(`/listings/${encodeURIComponent(listingId)}`, { method: 'GET' });
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
        cover_image_url: data?.cover_image_url || '',
        publish_now: data?.status ? String(data.status).toLowerCase() === 'published' : true,
      });
      setIsFreeTour(Array.isArray(data?.tags) && data.tags.includes('free_tour'));
      setCoverPreview(data?.cover_image_url || '');
      setEditMessage(t('operator.messages.tour_loaded', 'Tour loaded. Update the fields and save.'));
    } catch (err) {
      if (err?.status === 401) logout?.();
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

    const sources = [];
    if (token) {
      try {
        const owned = await authFetch('/providers/me/listings?limit=200', { method: 'GET' });
        sources.push(...(Array.isArray(owned?.items) ? owned.items : []));
      } catch (error) {
        if (error?.status === 401) logout?.();
      }
    }
    const data = await authFetch('/listings/search?status=published&limit=200', { method: 'GET' });
    const items = [
      ...sources,
      ...(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []),
    ];
    return findListingIdFromSlug(slugOrId, items);
  };

  useEffect(() => {
    if (pendingEditId && (accessCodeTrimmed || token)) {
      handleLoadTourById(pendingEditId);
      setPendingEditId(null);
    }
  }, [pendingEditId, accessCodeTrimmed, token]);

  const handleLoadTour = async (event) => {
    event.preventDefault();
    setEditMessage(null);
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
    if (!editingId) {
      setEditMessage(t('operator.messages.update_requires_load', 'Load a tour before updating.'));
      return;
    }
    setTourLoading(true);
    try {
      const coverImageUrl = await ensureTourCoverImage();
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
        cover_image_url: coverImageUrl || null,
      };

      const data = await authFetch(`/listings/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        body: JSON.stringify(
          isAuthenticatedMode
            ? payload
            : { ...payload, access_code: accessCodeTrimmed }
        ),
      });

      setCreatedTour(data);
      setCoverPreview(data?.cover_image_url || coverImageUrl || '');
      setTourMessage(t('operator.messages.tour_updated', 'Tour updated successfully.'));
      loadOwnedListings();
    } catch (err) {
      if (err?.status === 401) logout?.();
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
    if (!editingId) {
      setEditMessage(t('operator.messages.delete_requires_load', 'Load a tour before deleting.'));
      return;
    }
    const confirmed = window.confirm('Delete this tour? This cannot be undone.');
    if (!confirmed) return;
    setTourLoading(true);
    try {
      await authFetch(`/listings/${encodeURIComponent(editingId)}`, {
        method: 'DELETE',
      });
      setTourMessage(t('operator.messages.tour_deleted', 'Tour deleted.'));
      setEditingId(null);
      setCreatedTour(null);
      setTourForm((prev) => ({
        ...emptyTour,
        provider_id: prev.provider_id,
        city: prev.city,
        country_code: prev.country_code,
      }));
      setCoverPreview('');
      loadOwnedListings();
    } catch (err) {
      if (err?.status === 401) logout?.();
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
            <span className="page-kicker">{t('operator.kicker', 'Guide publishing')}</span>
          </div>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">
            {t('operator.publish_title', 'Publish tours on Wadatrip')}
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-[#a0a0a0]">
            {t(
              'operator.subtitle',
              'Use your account-owned guide profile, then publish and manage tours from the same identity on web and mobile.'
            )}
          </p>
        </header>

        {!isAuthenticatedMode ? (
          <section className="page-card">
            <div className="space-y-3">
              <p className="text-sm text-[#00D9FF]">Sign in required</p>
              <h2 className="text-2xl font-semibold text-white">Sign in as a guide to create or edit tours</h2>
              <p className="max-w-2xl text-sm text-[#a0a0a0]">
                This page uses your guide account to load your profile and tours. If you are a new guide, create your account first. If you already signed up, use your 6-digit code to continue.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/guide/register?mode=login&next=/operator/tours/new"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff3f97] via-[#ffb347] to-[#16d7d0] px-6 text-sm font-black uppercase tracking-[0.14em] text-white transition-transform hover:scale-[1.01]"
              >
                Continue as guide
              </Link>
              <Link
                to="/tours"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#00D9FF]/40 px-6 text-sm font-semibold text-[#00D9FF] transition hover:bg-[#00D9FF]/10 hover:text-white"
              >
                Explore tours instead
              </Link>
            </div>
          </section>
        ) : null}

        {isAuthenticatedMode ? (
          <>

        <section className="page-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#00D9FF]">{t('operator.step1_label', 'Step 1')}</p>
              <h2 className="text-xl font-semibold text-white">
                {isAuthenticatedMode
                  ? hasOwnedListings
                    ? 'Your tours'
                    : 'Create your first tour'
                  : t('operator.access_title', 'Legacy access code')}
              </h2>
              <p className="text-sm text-[#a0a0a0]">
                {isAuthenticatedMode
                  ? hasOwnedListings
                    ? 'Your account is already linked to a guide profile. Pick an existing tour to edit or create a new one below.'
                    : 'Your account is already linked to a guide profile. You do not have any tours yet, so start by creating your first one below.'
                  : t('operator.access_help', 'Required to unlock self-serve publishing.')}
              </p>
            </div>
          </div>
          {isAuthenticatedMode ? (
            <div className="mt-6 rounded-2xl border border-[#00D9FF]/20 bg-[#0a0e27]/60 p-4 text-sm text-[#cad3df]">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">{providerStatus?.name || user?.name || user?.email}</p>
                  <p className="text-[#a0a0a0]">
                    Status: {providerStatus?.status || providerStatus?.verification_status || 'pending'}
                  </p>
                </div>
                <div className="text-[#a0a0a0]">
                  {loadingOwnedListings ? 'Checking your tours...' : `${ownedListings.length} tour${ownedListings.length === 1 ? '' : 's'} linked to this account`}
                </div>
              </div>
              {!hasOwnedListings ? (
                <p className="mt-3 text-[#e0e0e0]">
                  No tours yet. Go to Step 3 and fill out the form to create your first tour.
                </p>
              ) : null}
            </div>
          ) : (
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
          )}
        </section>

        {isAuthenticatedMode && hasOwnedListings ? (
          <section className="page-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Your tours</h2>
                <p className="text-sm text-[#a0a0a0]">
                  Choose one of your tours to edit it, or paste a Wadatrip tour link if you prefer.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {ownedListings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[#00D9FF]/15 bg-[#0a0e27]/60 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-white">{listing.title || 'Untitled tour'}</p>
                    <p className="text-sm text-[#a0a0a0]">
                      {[listing.city, listing.country_code, listing.status].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="h-12 w-full neon-cta font-black hover:scale-105 transition-all md:w-auto"
                    onClick={() => handleLoadTourById(listing.id)}
                    disabled={tourLoading}
                  >
                    {tourLoading && editingId === listing.id ? t('operator.loading_label', 'Loading...') : 'Edit this tour'}
                  </Button>
                </div>
              ))}
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
        ) : !isAuthenticatedMode ? (
          <section className="page-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {t('operator.edit_kicker', 'Edit your tour')}
              </h2>
              <p className="text-sm text-[#a0a0a0]">
                {isAuthenticatedMode
                  ? 'Load one of your existing tours by link or ID and update it securely with your session.'
                  : t('operator.edit_kicker_help', 'Already published? Jump to the edit section.')}
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
        ) : null}

        <section className="page-card" id="edit-tour">
          <div className="space-y-1">
            <p className="text-sm text-[#00D9FF]">
              {isAuthenticatedMode && !hasOwnedListings && !editingId
                ? 'Step 2'
                : t('operator.step2_label', 'Step 2 (optional)')}
            </p>
            <h2 className="text-xl font-semibold text-white">
              {isAuthenticatedMode ? 'Guide profile' : t('operator.operator_title', 'Operator details')}
            </h2>
            <p className="text-sm text-[#a0a0a0]">
              {isAuthenticatedMode
                ? hasOwnedListings
                  ? 'This profile belongs to your logged-in account and will be reused by the mobile app.'
                  : 'Review your guide profile before publishing your first tour. Update anything that should appear publicly.'
                : t('operator.operator_help', 'Create or validate your operator profile.')}
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
              <label htmlFor="provider-instagram" className="text-sm text-[#e0e0e0]">
                Instagram (optional)
              </label>
              <Input
                id="provider-instagram"
                value={providerForm.instagram_handle}
                onChange={(event) => handleProviderChange('instagram_handle', event.target.value)}
                placeholder="@yourhandle"
                className="mt-2 h-12 neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-photo-url" className="text-sm text-[#e0e0e0]">
                Guide photo
              </label>
              <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  id="provider-photo-url"
                  value={providerForm.photo_url}
                  onChange={(event) => handleProviderChange('photo_url', event.target.value)}
                  placeholder="Upload from your device or paste a URL"
                  className="h-12 neon-input"
                />
                <label
                  htmlFor="provider-photo-file"
                  className="flex h-12 cursor-pointer items-center justify-center rounded-md border border-[#00D9FF]/40 px-4 text-sm font-semibold text-[#00D9FF] transition hover:bg-[#00D9FF]/10 hover:text-white"
                >
                  {providerPhotoUploading ? 'Uploading...' : 'Upload photo'}
                </label>
                <input
                  id="provider-photo-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    await uploadGuidePhoto(file);
                    event.target.value = '';
                  }}
                />
              </div>
              {providerForm.photo_url ? (
                <img
                  src={providerForm.photo_url}
                  alt="Guide preview"
                  className="mt-3 h-28 w-28 rounded-[20px] object-cover shadow-[0_16px_36px_rgba(15,23,42,0.12)]"
                />
              ) : null}
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
            <div className="md:col-span-2">
              <label htmlFor="provider-bio" className="text-sm text-[#e0e0e0]">
                Short bio
              </label>
              <Textarea
                id="provider-bio"
                value={providerForm.bio_short}
                onChange={(event) => handleProviderChange('bio_short', event.target.value)}
                placeholder="Tell travelers why they should book with you."
                className="mt-2 min-h-[100px] neon-input"
              />
            </div>
            <div>
              <label htmlFor="provider-license-url" className="text-sm text-[#e0e0e0]">
                License URL (optional)
              </label>
              <Input
                id="provider-license-url"
                value={providerForm.license_url}
                onChange={(event) => handleProviderChange('license_url', event.target.value)}
                placeholder="https://..."
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
                  : isAuthenticatedMode ? 'Save guide profile' : t('operator.create_button', 'Create operator')}
              </Button>
            </div>
          </form>

          <div className="mt-6 page-card">
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleLookupProvider}>
              <div className="flex-1">
                <label htmlFor="provider-lookup-id" className="text-sm text-[#e0e0e0]">
                  {isAuthenticatedMode ? 'Refresh my guide profile' : t('operator.verify_title', 'Verify operator by ID')}
                </label>
                <Input
                  id="provider-lookup-id"
                  value={providerLookupId}
                  onChange={(event) => setProviderLookupId(event.target.value)}
                  placeholder={isAuthenticatedMode ? 'Your provider ID appears here after save' : t('operator.provider_id_placeholder', 'provider_id')}
                  className="mt-2 h-12 neon-input"
                  readOnly={isAuthenticatedMode}
                />
              </div>
              <Button
                type="submit"
                className="h-12 neon-cta font-black hover:scale-105 transition-all"
                disabled={providerLoading}
              >
                {providerLoading
                  ? t('operator.checking_label', 'Checking...')
                  : isAuthenticatedMode ? 'Refresh profile' : t('operator.verify_button', 'Verify')}
              </Button>
            </form>
            {providerStatus && (
              <div className="mt-4 text-sm text-[#a0a0a0]">
                <div>ID: {providerStatus.id}</div>
                <div>Status: {providerStatus.status || providerStatus.verification_status || 'pending'}</div>
                {loadingOwnedProvider ? <div>Refreshing linked profile...</div> : null}
              </div>
            )}
            {providerMessage && <p className="mt-3 text-sm text-[#00D9FF]">{providerMessage}</p>}
          </div>
        </section>

        <section className="page-card">
          <div className="space-y-1">
            <p className="text-sm text-[#00D9FF]">
              {isAuthenticatedMode && !hasOwnedListings && !editingId
                ? 'Step 3'
                : t('operator.step3_label', 'Step 3')}
            </p>
            <h2 className="text-xl font-semibold text-white">
              {isAuthenticatedMode && !hasOwnedListings && !editingId ? 'Create your first tour' : t('operator.tour_title', 'Tour details')}
            </h2>
            <p className="text-sm text-[#a0a0a0]">
              {isAuthenticatedMode
                ? hasOwnedListings
                  ? 'This tour will be published under your linked guide profile, just like in the mobile app.'
                  : 'Add the basics for your first experience. You can save it now and come back later to edit it.'
                : t('operator.tour_help', 'Publish the experience you want to sell.')}
            </p>
          </div>

          {(!isAuthenticatedMode || hasOwnedListings) ? (
            <>
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
            </>
          ) : null}

          <form className="mt-6 grid gap-5" onSubmit={handleCreateTour}>
            <div>
              <label htmlFor="tour-provider-id" className="text-sm text-[#e0e0e0]">
                {isAuthenticatedMode ? 'Linked provider ID' : t('operator.tour_provider_id_label', 'Provider ID')}
              </label>
              <Input
                id="tour-provider-id"
                value={tourForm.provider_id || ownedProviderId}
                onChange={(event) => handleTourChange('provider_id', event.target.value)}
                placeholder={isAuthenticatedMode ? 'Saved automatically from your account' : t('operator.provider_id_placeholder', 'provider_id')}
                className="mt-2 h-12 neon-input"
                readOnly={Boolean(editingId) || isAuthenticatedMode}
              />
              {editingId && (
                <p className="mt-2 text-xs text-[#a0a0a0]">
                  {t('operator.provider_id_locked', 'Provider ID is locked while editing.')}
                </p>
              )}
              {!editingId && isAuthenticatedMode ? (
                <p className="mt-2 text-xs text-[#a0a0a0]">
                  {ownedProviderId
                    ? `This tour will use your account-owned provider profile (${ownedProviderId}).`
                    : 'Save your guide profile first so tours belong to your account.'}
                </p>
              ) : null}
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
            <div>
              <label htmlFor="tour-cover-image" className="text-sm text-[#e0e0e0]">
                Cover image
              </label>
              <div className="mt-2 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <Input
                  id="tour-cover-image"
                  value={tourForm.cover_image_url}
                  onChange={(event) => {
                    handleTourChange('cover_image_url', event.target.value);
                    setCoverPreview(event.target.value);
                  }}
                  placeholder="Upload from your device, use a destination cover, or paste a URL"
                  className="h-12 neon-input"
                />
                <label
                  htmlFor="tour-cover-file"
                  className="flex h-12 cursor-pointer items-center justify-center rounded-md border border-[#00D9FF]/40 px-4 text-sm font-semibold text-[#00D9FF] transition hover:bg-[#00D9FF]/10 hover:text-white"
                >
                  {tourCoverUploading ? 'Uploading...' : 'Upload cover'}
                </label>
                <input
                  id="tour-cover-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    await uploadTourCover(file);
                    event.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border border-[#00D9FF]/40 text-[#00D9FF] hover:text-white"
                  onClick={async () => {
                    try {
                      const imageUrl = await resolveDestinationCover(tourForm.city, tourForm.country_code);
                      if (!imageUrl) {
                        setTourMessage('No destination cover found for that city yet.');
                        return;
                      }
                      handleTourChange('cover_image_url', imageUrl);
                      setCoverPreview(imageUrl);
                      setTourMessage('Destination cover applied.');
                    } catch (error) {
                      setTourMessage(error?.message || 'Could not resolve destination cover.');
                    }
                  }}
                >
                  Use destination cover
                </Button>
              </div>
              {coverPreview || tourForm.cover_image_url ? (
                <img
                  src={coverPreview || tourForm.cover_image_url}
                  alt="Tour cover preview"
                  className="mt-3 h-48 w-full rounded-[20px] object-cover shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
                />
              ) : null}
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
            {isAuthenticatedMode && !providerApproved ? (
              <p className="text-sm text-[#f7c6a5]">
                Your provider status is currently `{providerApprovalStatus || 'pending'}`. New tours may be saved as draft until approval.
              </p>
            ) : null}
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
          </>
        ) : null}
      </div>
    </div>
  );
}

