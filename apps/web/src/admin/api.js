import { AppConfig } from '../config/appConfig'
import { createAdminClient } from './client'

let readSession = () => null
export const getApiBase = () => (AppConfig.api.baseUrl || '').replace(/\/$/, '')
const client = createAdminClient({ getSession: () => readSession(), getBase: getApiBase,
  onStepUp: () => window.dispatchEvent(new Event('wadatrip:admin-step-up')) })
export function configureAdminClient(reader) { readSession = reader || (() => null); client.clear() }
export const clearAdminSession = client.clear
export const setAdminProof = client.setProof
export const apiFetch = client.request
