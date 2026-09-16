const BASE = '/api'

async function request(method, path, body, isFormData = false) {
  const opts = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
  }
  if (body) {
    opts.body = isFormData ? body : JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// Simple in-memory cache for GET requests (TTL in ms)
const _cache = {}

async function cachedGet(path, ttlMs = 30_000) {
  const now = Date.now()
  if (_cache[path] && _cache[path].expires > now) {
    return _cache[path].data
  }
  const data = await request('GET', path)
  _cache[path] = { data, expires: now + ttlMs }
  return data
}

export const api = {
  get: (path) => request('GET', path),
  getCached: (path, ttlMs) => cachedGet(path, ttlMs),
  invalidate: (path) => { delete _cache[path] },
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, formData, true),
}

export function buildWorkoutQuery(params) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', params.page)
  if (params.pageSize) q.set('page_size', params.pageSize)
  if (params.sport) q.set('sport', params.sport)
  if (params.isRace !== undefined && params.isRace !== null) q.set('is_race', params.isRace)
  if (params.duplicates) q.set('duplicates', 'true')
  if (params.search) q.set('search', params.search)
  if (params.dateFrom) q.set('date_from', params.dateFrom)
  if (params.dateTo) q.set('date_to', params.dateTo)
  return q.toString()
}
