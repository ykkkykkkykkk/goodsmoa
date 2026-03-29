import React, { useState, useEffect } from 'react'
import {
  adminLogin, adminCreateBanner, adminUpdateBanner, adminDeleteBanner,
  adminCreateIdol, adminDeleteIdol, getBanners, getIdols,
  getReports, approveReport, rejectReport,
  getStats, getTradeReports, resolveTradeReport,
  getToken, setToken, clearToken,
} from '../api'

const CATEGORIES = ['팝업스토어', '공식샵', '온라인몰']

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState('stats')

  const handleLogin = async (e) => {
    e.preventDefault()
    const res = await adminLogin(password)
    if (res.ok) {
      setToken(res.token)
      setAuthed(true)
      setPassword('')
    } else {
      setLoginError(res.message || '로그인 실패')
    }
  }

  useEffect(() => {
    if (getToken()) setAuthed(true)
  }, [])

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
  }

  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-box">
          <h2>굿즈모아 관리자</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button type="submit">로그인</button>
            {loginError && <p className="err">{loginError}</p>}
          </form>
          <a href="#main" className="back-link">메인으로 돌아가기</a>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <a href="#main" className="logo">굿즈모아</a>
        <span>관리자</span>
        <button onClick={handleLogout}>로그아웃</button>
      </header>

      <div className="admin-tabs">
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
          통계
        </button>
        <button className={tab === 'banners' ? 'active' : ''} onClick={() => setTab('banners')}>
          배너 관리
        </button>
        <button className={tab === 'idols' ? 'active' : ''} onClick={() => setTab('idols')}>
          아이돌 관리
        </button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          제보 관리
        </button>
        <button className={tab === 'tradeReports' ? 'active' : ''} onClick={() => setTab('tradeReports')}>
          신고 관리
        </button>
      </div>

      <div className="admin-content">
        {tab === 'stats' && <StatsPanel />}
        {tab === 'banners' && <BannerManager />}
        {tab === 'idols' && <IdolManager />}
        {tab === 'reports' && <ReportManager />}
        {tab === 'tradeReports' && <TradeReportManager />}
      </div>
    </div>
  )
}

function BannerManager() {
  const [banners, setBanners] = useState([])
  const [idols, setIdols] = useState([])
  const [form, setForm] = useState({ shop_name: '', url: '', idol: '', category: '온라인몰', image_url: '' })
  const [file, setFile] = useState(null)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState('')

  const load = () => {
    getBanners().then(setBanners).catch(console.error)
    getIdols().then(setIdols).catch(console.error)
  }
  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('shop_name', form.shop_name)
    fd.append('url', form.url)
    fd.append('idol', form.idol)
    fd.append('category', form.category)
    if (form.image_url) fd.append('image_url', form.image_url)
    if (file) fd.append('image', file)

    let res
    if (editId) {
      fd.append('sort_order', form.sort_order || '0')
      res = await adminUpdateBanner(editId, fd)
    } else {
      res = await adminCreateBanner(fd)
    }

    setMsg(res.message || (res.ok ? '완료' : '실패'))
    if (res.ok) {
      setForm({ shop_name: '', url: '', idol: '', category: '온라인몰', image_url: '' })
      setFile(null)
      setEditId(null)
      load()
    }
  }

  const handleEdit = (b) => {
    setEditId(b.id)
    setForm({
      shop_name: b.shop_name,
      url: b.url,
      idol: b.idol,
      category: b.category,
      image_url: b.image_url || '',
      sort_order: b.sort_order || 0,
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await adminDeleteBanner(id)
    setMsg(res.message)
    if (res.ok) load()
  }

  return (
    <div>
      <h3>{editId ? '배너 수정' : '배너 등록'}</h3>
      {msg && <div className="admin-msg">{msg}</div>}
      <form onSubmit={handleSubmit} className="admin-form">
        <input placeholder="쇼핑몰명" value={form.shop_name}
          onChange={e => setForm({ ...form, shop_name: e.target.value })} required />
        <input placeholder="URL" type="url" value={form.url}
          onChange={e => setForm({ ...form, url: e.target.value })} required />
        <select value={form.idol} onChange={e => setForm({ ...form, idol: e.target.value })} required>
          <option value="">아이돌 선택</option>
          {idols.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
        </select>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="이미지 URL (직접 입력)" value={form.image_url}
          onChange={e => setForm({ ...form, image_url: e.target.value })} />
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
        {editId && (
          <input type="number" placeholder="정렬 순서" value={form.sort_order || 0}
            onChange={e => setForm({ ...form, sort_order: e.target.value })} />
        )}
        <div className="form-actions">
          <button type="submit">{editId ? '수정' : '등록'}</button>
          {editId && <button type="button" onClick={() => { setEditId(null); setForm({ shop_name: '', url: '', idol: '', category: '온라인몰', image_url: '' }) }}>취소</button>}
        </div>
      </form>

      <h3>배너 목록 ({banners.length})</h3>
      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>쇼핑몰</th><th>아이돌</th><th>카테고리</th><th>순서</th><th>관리</th></tr>
        </thead>
        <tbody>
          {banners.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td><a href={b.url} target="_blank" rel="noopener">{b.shop_name}</a></td>
              <td>{b.idol}</td>
              <td>{b.category}</td>
              <td>{b.sort_order}</td>
              <td>
                <button onClick={() => handleEdit(b)}>수정</button>
                <button onClick={() => handleDelete(b.id)} className="del-btn">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IdolManager() {
  const [idols, setIdols] = useState([])
  const [form, setForm] = useState({ name: '', color: '#000000', debut: '', agency: '' })
  const [msg, setMsg] = useState('')

  const load = () => getIdols().then(setIdols).catch(console.error)
  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await adminCreateIdol(form)
    setMsg(res.message)
    if (res.ok) {
      setForm({ name: '', color: '#000000', debut: '', agency: '' })
      load()
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await adminDeleteIdol(id)
    setMsg(res.message)
    if (res.ok) load()
  }

  return (
    <div>
      <h3>아이돌 등록</h3>
      {msg && <div className="admin-msg">{msg}</div>}
      <form onSubmit={handleSubmit} className="admin-form">
        <input placeholder="이름" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} required />
        <div className="color-field">
          <input type="color" value={form.color}
            onChange={e => setForm({ ...form, color: e.target.value })} />
          <span>{form.color}</span>
        </div>
        <input placeholder="데뷔일 (YYYY-MM-DD)" value={form.debut}
          onChange={e => setForm({ ...form, debut: e.target.value })} />
        <input placeholder="소속사" value={form.agency}
          onChange={e => setForm({ ...form, agency: e.target.value })} />
        <button type="submit">등록</button>
      </form>

      <h3>아이돌 목록 ({idols.length})</h3>
      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>이름</th><th>색상</th><th>데뷔</th><th>소속</th><th>관리</th></tr>
        </thead>
        <tbody>
          {idols.map(i => (
            <tr key={i.id}>
              <td>{i.id}</td>
              <td>{i.name}</td>
              <td><span className="color-preview" style={{ background: i.color }} /> {i.color}</td>
              <td>{i.debut}</td>
              <td>{i.agency}</td>
              <td><button onClick={() => handleDelete(i.id)} className="del-btn">삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatsPanel() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStats().then(res => { if (res.ok) setStats(res.data) }).catch(console.error)
  }, [])

  if (!stats) return <div>로딩 중...</div>

  const PAGE_LABELS = { main: '메인', trade: '중고거래', report: '제보', admin: '관리자' }

  return (
    <div>
      <h3>대시보드</h3>
      <div className="stats-grid">
        <div className="stat-card stat-highlight">
          <div className="stat-number">{stats.views?.today || 0}</div>
          <div className="stat-label">오늘 방문</div>
        </div>
        <div className="stat-card stat-highlight">
          <div className="stat-number">{stats.views?.uniqueToday || 0}</div>
          <div className="stat-label">오늘 순방문자</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.views?.total || 0}</div>
          <div className="stat-label">누적 방문</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.users || 0}</div>
          <div className="stat-label">가입 회원</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.banners}</div>
          <div className="stat-label">등록 배너</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.trades.total}</div>
          <div className="stat-label">전체 거래글</div>
        </div>
        <div className="stat-card stat-selling">
          <div className="stat-number">{stats.trades.selling}</div>
          <div className="stat-label">판매중</div>
        </div>
        <div className="stat-card stat-sold">
          <div className="stat-number">{stats.trades.sold}</div>
          <div className="stat-label">판매완료</div>
        </div>
        <div className="stat-card stat-pending">
          <div className="stat-number">{stats.pendingReports}</div>
          <div className="stat-label">대기중 제보</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-number">{stats.pendingTradeReports}</div>
          <div className="stat-label">대기중 신고</div>
        </div>
      </div>

      {stats.views?.byPage?.length > 0 && (
        <>
          <h3>오늘 페이지별 방문</h3>
          <table className="admin-table">
            <thead>
              <tr><th>페이지</th><th>방문수</th></tr>
            </thead>
            <tbody>
              {stats.views.byPage.map(p => (
                <tr key={p.page}>
                  <td>{PAGE_LABELS[p.page] || p.page}</td>
                  <td>{p.cnt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3>인기 아이돌 (거래 기준)</h3>
      <table className="admin-table">
        <thead>
          <tr><th>순위</th><th>아이돌</th><th>거래글 수</th></tr>
        </thead>
        <tbody>
          {stats.topIdols.map((item, i) => (
            <tr key={item.idol}>
              <td>{i + 1}</td>
              <td>{item.idol}</td>
              <td>{item.cnt}</td>
            </tr>
          ))}
          {stats.topIdols.length === 0 && (
            <tr><td colSpan="3" style={{ textAlign: 'center' }}>데이터가 없습니다</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ReportManager() {
  const [reports, setReports] = useState([])
  const [filterStatus, setFilterStatus] = useState('pending')
  const [msg, setMsg] = useState('')

  const load = () => {
    getReports(filterStatus).then(res => {
      if (res.ok) setReports(res.data)
    }).catch(console.error)
  }
  useEffect(load, [filterStatus])

  const handleApprove = async (id) => {
    const res = await approveReport(id)
    setMsg(res.message)
    if (res.ok) load()
  }

  const handleReject = async (id) => {
    if (!confirm('이 제보를 거절하시겠습니까?')) return
    const res = await rejectReport(id)
    setMsg(res.message)
    if (res.ok) load()
  }

  const STATUS_LABELS = { pending: '대기중', approved: '승인됨', rejected: '거절됨' }

  return (
    <div>
      <h3>제보 관리</h3>
      {msg && <div className="admin-msg">{msg}</div>}
      <div className="report-filter">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="pending">대기중</option>
          <option value="approved">승인됨</option>
          <option value="rejected">거절됨</option>
          <option value="">전체</option>
        </select>
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>쇼핑몰</th><th>URL</th><th>아이돌</th><th>카테고리</th><th>상태</th><th>날짜</th><th>관리</th></tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr><td colSpan="8" style={{ textAlign: 'center' }}>제보가 없습니다</td></tr>
          ) : reports.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.shop_name}</td>
              <td><a href={r.url} target="_blank" rel="noopener">{r.url.length > 30 ? r.url.slice(0, 30) + '...' : r.url}</a></td>
              <td>{r.idol}</td>
              <td>{r.category}</td>
              <td>{STATUS_LABELS[r.status] || r.status}</td>
              <td>{r.created_at?.slice(0, 10)}</td>
              <td>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => handleApprove(r.id)} className="approve-btn">승인</button>
                    <button onClick={() => handleReject(r.id)} className="del-btn">거절</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TradeReportManager() {
  const [reports, setReports] = useState([])
  const [filterStatus, setFilterStatus] = useState('pending')
  const [msg, setMsg] = useState('')

  const load = () => {
    getTradeReports(filterStatus).then(res => {
      if (res.ok) setReports(res.data)
    }).catch(console.error)
  }
  useEffect(load, [filterStatus])

  const handleResolve = async (id, action, delTrade = false) => {
    if (action === 'resolved' && delTrade) {
      if (!confirm('신고를 처리하고 해당 거래글을 삭제하시겠습니까?')) return
    }
    const res = await resolveTradeReport(id, action, delTrade)
    setMsg(res.message)
    if (res.ok) load()
  }

  const STATUS_LABELS = { pending: '대기중', resolved: '처리됨', dismissed: '무시됨' }

  return (
    <div>
      <h3>거래글 신고 관리</h3>
      {msg && <div className="admin-msg">{msg}</div>}
      <div className="report-filter">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="pending">대기중</option>
          <option value="resolved">처리됨</option>
          <option value="dismissed">무시됨</option>
          <option value="">전체</option>
        </select>
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>ID</th><th>거래글</th><th>아이돌</th><th>사유</th><th>상세</th><th>상태</th><th>날짜</th><th>관리</th></tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr><td colSpan="8" style={{ textAlign: 'center' }}>신고가 없습니다</td></tr>
          ) : reports.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.trade_title || `#${r.trade_id}`}</td>
              <td>{r.trade_idol || '-'}</td>
              <td>{r.reason}</td>
              <td>{r.detail ? (r.detail.length > 20 ? r.detail.slice(0, 20) + '...' : r.detail) : '-'}</td>
              <td>{STATUS_LABELS[r.status] || r.status}</td>
              <td>{r.created_at?.slice(0, 10)}</td>
              <td>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => handleResolve(r.id, 'resolved', true)} className="del-btn">처리+삭제</button>
                    <button onClick={() => handleResolve(r.id, 'resolved', false)} className="approve-btn">처리</button>
                    <button onClick={() => handleResolve(r.id, 'dismissed')}>무시</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
