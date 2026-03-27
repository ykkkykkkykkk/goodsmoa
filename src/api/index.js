const BASE = (import.meta.env.VITE_API_BASE ?? '') + '/api'

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options)
  const data = await res.json()
  if (!data.ok) throw new Error(data.message || '요청 실패')
  return data
}

// 토큰 관리
export function getToken() {
  return sessionStorage.getItem('admin_token')
}
export function setToken(token) {
  sessionStorage.setItem('admin_token', token)
}
export function clearToken() {
  sessionStorage.removeItem('admin_token')
}
function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 배너
export async function getBanners(idol, category) {
  const params = new URLSearchParams()
  if (idol) params.set('idol', idol)
  if (category && category !== '전체') params.set('category', category)
  const res = await fetchJSON(`${BASE}/banners?${params}`)
  return res.data
}

export async function getRecentBanners() {
  const res = await fetchJSON(`${BASE}/banners/recent/list`)
  return res.data
}

// 아이돌
export async function getIdols() {
  const res = await fetchJSON(`${BASE}/idols`)
  return res.data
}

// 어드민 로그인 → JWT 토큰
export async function adminLogin(password) {
  const res = await fetch(`${BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return res.json()
}

export function adminCreateBanner(formData) {
  return fetch(`${BASE}/admin/banners`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  }).then(r => r.json())
}

export function adminUpdateBanner(id, formData) {
  return fetch(`${BASE}/admin/banners/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: formData,
  }).then(r => r.json())
}

export function adminDeleteBanner(id) {
  return fetch(`${BASE}/admin/banners/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).then(r => r.json())
}

export function adminCreateIdol(data) {
  return fetch(`${BASE}/admin/idols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  }).then(r => r.json())
}

export function adminDeleteIdol(id) {
  return fetch(`${BASE}/admin/idols/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).then(r => r.json())
}

// 제보 관리 (관리자)
export async function getReports(status) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  const res = await fetch(`${BASE}/admin/reports?${params}`, {
    headers: authHeaders(),
  })
  return res.json()
}

export function approveReport(id) {
  return fetch(`${BASE}/admin/reports/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(),
  }).then(r => r.json())
}

export function rejectReport(id) {
  return fetch(`${BASE}/admin/reports/${id}/reject`, {
    method: 'POST',
    headers: authHeaders(),
  }).then(r => r.json())
}

// 중고거래
export async function getTrades(idol, status, q, page = 1, limit = 20) {
  const params = new URLSearchParams()
  if (idol) params.set('idol', idol)
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  params.set('page', page)
  params.set('limit', limit)
  const res = await fetchJSON(`${BASE}/trades?${params}`)
  return res
}

export function createTrade(formData) {
  return fetch(`${BASE}/trades`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json())
}

export function updateTrade(id, formData, password) {
  formData.append('password', password)
  return fetch(`${BASE}/trades/${id}`, {
    method: 'PUT',
    body: formData,
  }).then(r => r.json())
}

export function updateTradeStatus(id, status, password) {
  return fetch(`${BASE}/trades/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, password }),
  }).then(r => r.json())
}

export function deleteTrade(id, password) {
  return fetch(`${BASE}/trades/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then(r => r.json())
}

export function verifyTradePassword(id, password) {
  return fetch(`${BASE}/trades/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then(r => r.json())
}

export function submitReport(formData) {
  return fetch(`${BASE}/admin/report`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json())
}

// 거래글 신고
export function reportTrade(id, reason, detail) {
  return fetch(`${BASE}/trades/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, detail }),
  }).then(r => r.json())
}

// 관리자: 통계
export async function getStats() {
  const res = await fetch(`${BASE}/admin/stats`, { headers: authHeaders() })
  return res.json()
}

// 관리자: 거래글 신고 목록
export async function getTradeReports(status) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  const res = await fetch(`${BASE}/admin/trade-reports?${params}`, { headers: authHeaders() })
  return res.json()
}

// 관리자: 거래글 신고 처리
export function resolveTradeReport(id, action, deleteTrade = false) {
  return fetch(`${BASE}/admin/trade-reports/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ action, deleteTrade }),
  }).then(r => r.json())
}
