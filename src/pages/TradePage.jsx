import React, { useState, useEffect, useContext } from 'react'
import { getIdols, getTrades, createTrade, updateTrade, updateTradeStatus, deleteTrade, reportTrade, signup, login, getUserToken, setUserToken, clearUserToken, getUserInfo, setUserInfo } from '../api'
import { UserContext } from '../App'

export default function TradePage() {
  const [idols, setIdols] = useState([])
  const [trades, setTrades] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [filterIdol, setFilterIdol] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', idol: '', price: '', contact: '', password: '' })
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // 수정 모드
  const [editId, setEditId] = useState(null)
  const [editPw, setEditPw] = useState('')

  // 이미지 미리보기
  const [preview, setPreview] = useState(null)

  // 비밀번호 확인 모달
  const [pwModal, setPwModal] = useState({ show: false, action: null, id: null })
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')

  // 신고 모달
  const [reportModal, setReportModal] = useState({ show: false, id: null })
  const [reportReason, setReportReason] = useState('')
  const [reportDetail, setReportDetail] = useState('')
  const [reportMsg, setReportMsg] = useState('')

  // 연락처 공개 토글 (게시글별)
  const [visibleContacts, setVisibleContacts] = useState({})

  // 로그인/회원가입
  const { user, setUser } = useContext(UserContext)
  const [authModal, setAuthModal] = useState({ show: false, mode: 'login' })
  const [authForm, setAuthForm] = useState({ username: '', password: '', nickname: '' })
  const [authMsg, setAuthMsg] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    getIdols().then(setIdols).catch(console.error)
  }, [])

  const loadTrades = () => {
    getTrades(filterIdol, filterStatus, searchQuery, page).then(res => {
      setTrades(res.data)
      setPagination(res.pagination)
    }).catch(console.error)
  }
  useEffect(loadTrades, [filterIdol, filterStatus, searchQuery, page])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearchQuery(searchInput)
  }

  // 로그인/회원가입 처리
  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthMsg('')
    try {
      let res
      if (authModal.mode === 'login') {
        res = await login(authForm.username, authForm.password)
      } else {
        res = await signup(authForm.username, authForm.password, authForm.nickname)
      }
      if (res.ok) {
        setUserToken(res.token)
        setUserInfo(res.user)
        setUser(res.user)
        setAuthModal({ show: false, mode: 'login' })
        setAuthForm({ username: '', password: '', nickname: '' })
        setAuthMsg('')
      } else {
        setAuthMsg(res.message || '실패')
      }
    } catch (err) {
      setAuthMsg('오류: ' + err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    clearUserToken()
    setUser(null)
  }

  // 본인 글 여부 확인
  const isMyTrade = (trade) => user && trade.user_id && user.id === trade.user_id

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.idol || !form.price || !form.contact) {
      setMsg('제목, 아이돌, 가격, 연락처는 필수입니다.')
      return
    }
    if (!user && !editId && (!form.password || form.password.length < 4)) {
      setMsg('비밀번호는 4자 이상 입력하세요.')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('idol', form.idol)
      fd.append('price', form.price)
      fd.append('contact', form.contact)
      if (file) fd.append('image', file)

      let res
      if (editId) {
        res = await updateTrade(editId, fd, editPw || '')
      } else {
        if (!user) fd.append('password', form.password)
        res = await createTrade(fd)
      }

      if (res.ok) {
        setMsg(editId ? '수정되었습니다!' : '등록되었습니다!')
        setForm({ title: '', description: '', idol: '', price: '', contact: '', password: '' })
        setFile(null)
        setPreview(null)
        setShowForm(false)
        setEditId(null)
        setEditPw('')
        loadTrades()
      } else {
        setMsg(res.message || '실패')
      }
    } catch (err) {
      setMsg('실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 파일 선택 시 미리보기
  const handleFileChange = (e) => {
    const f = e.target.files[0]
    setFile(f)
    if (f) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  // 연락처 마스킹
  const maskContact = (contact) => {
    if (!contact || contact.length <= 4) return '****'
    return contact.slice(0, 3) + '*'.repeat(contact.length - 3)
  }

  // 신고 제출
  const handleReport = async () => {
    if (!reportReason) { setReportMsg('사유를 선택하세요'); return }
    const res = await reportTrade(reportModal.id, reportReason, reportDetail)
    setReportMsg(res.message || (res.ok ? '접수되었습니다' : '실패'))
    if (res.ok) {
      setTimeout(() => {
        setReportModal({ show: false, id: null })
        setReportReason('')
        setReportDetail('')
        setReportMsg('')
      }, 1500)
    }
  }

  // 비밀번호 확인 후 동작 (비로그인 글용)
  const requestAction = (action, id) => {
    const trade = trades.find(t => t.id === id)
    // 로그인 유저 본인 글이면 비밀번호 없이 바로 실행
    if (isMyTrade(trade)) {
      if (action === 'sold') {
        updateTradeStatus(id, 'sold', '').then(res => { if (res.ok) loadTrades() })
      } else if (action === 'delete') {
        if (confirm('정말 삭제하시겠습니까?')) {
          deleteTrade(id, '').then(res => { if (res.ok) loadTrades() })
        }
      } else if (action === 'edit') {
        setEditPw('')
        setEditId(id)
        setForm({
          title: trade.title,
          description: trade.description || '',
          idol: trade.idol,
          price: String(trade.price),
          contact: trade.contact,
          password: '',
        })
        setShowForm(true)
      }
      return
    }
    // 비밀번호 모달
    setPwModal({ show: true, action, id })
    setPwInput('')
    setPwError('')
  }

  const handlePwConfirm = async () => {
    const { action, id } = pwModal
    if (action === 'sold') {
      const res = await updateTradeStatus(id, 'sold', pwInput)
      if (res.ok) {
        setPwModal({ show: false, action: null, id: null })
        loadTrades()
      } else {
        setPwError(res.message || '비밀번호가 올바르지 않습니다')
      }
    } else if (action === 'delete') {
      const res = await deleteTrade(id, pwInput)
      if (res.ok) {
        setPwModal({ show: false, action: null, id: null })
        loadTrades()
      } else {
        setPwError(res.message || '비밀번호가 올바르지 않습니다')
      }
    } else if (action === 'edit') {
      const trade = trades.find(t => t.id === id)
      if (!trade) return
      setEditPw(pwInput)
      setEditId(id)
      setForm({
        title: trade.title,
        description: trade.description || '',
        idol: trade.idol,
        price: String(trade.price),
        contact: trade.contact,
        password: '',
      })
      setShowForm(true)
      setPwModal({ show: false, action: null, id: null })
    }
  }

  const formatPrice = (n) => Number(n).toLocaleString() + '원'
  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr + 'Z').getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  return (
    <div className="trade-page">
      <header className="top-nav">
        <div className="top-nav-inner">
          <a href="#main" className="logo">굿즈모아</a>
          <span className="page-title">중고거래</span>
          <div className="auth-area">
            {user ? (
              <>
                <span className="user-nickname">{user.nickname}</span>
                <button className="auth-btn" onClick={handleLogout}>로그아웃</button>
              </>
            ) : (
              <>
                <button className="auth-btn" onClick={() => { setAuthModal({ show: true, mode: 'login' }); setAuthMsg('') }}>로그인</button>
                <button className="auth-btn signup-btn" onClick={() => { setAuthModal({ show: true, mode: 'signup' }); setAuthMsg('') }}>회원가입</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="trade-banner">
        <p>아이돌 굿즈를 팬들끼리 직접 사고팔 수 있는 공간입니다.</p>
        <p className="trade-notice">거래 시 사기에 주의하세요. 굿즈모아는 직접 거래에 대한 책임을 지지 않습니다.</p>
      </div>

      <div className="trade-container">
        <div className="trade-toolbar">
          <div className="trade-filters">
            <select value={filterIdol} onChange={e => { setFilterIdol(e.target.value); setPage(1) }}>
              <option value="">전체 아이돌</option>
              {idols.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
              <option value="">전체 상태</option>
              <option value="selling">판매중</option>
              <option value="sold">판매완료</option>
            </select>
            <form onSubmit={handleSearch} className="trade-search">
              <input
                type="text"
                placeholder="검색..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
              <button type="submit">검색</button>
            </form>
          </div>
          <button className="trade-write-btn" onClick={() => {
            if (!user) {
              setAuthModal({ show: true, mode: 'login' })
              setAuthMsg('글쓰기는 로그인이 필요합니다')
              return
            }
            setShowForm(!showForm)
            if (showForm) { setEditId(null); setEditPw('') }
          }}>
            {showForm ? '닫기' : '글쓰기'}
          </button>
        </div>

        {msg && <div className={`msg ${msg.includes('되었습니다') ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="trade-form">
            <input placeholder="제목 (예: BTS 지민 포카 양도)" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} required />
            <textarea placeholder="상세 설명 (상태, 구성품 등)" rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
            <div className="trade-form-row">
              <select value={form.idol} onChange={e => setForm({ ...form, idol: e.target.value })} required>
                <option value="">아이돌 선택</option>
                {idols.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
              <input type="number" placeholder="가격 (원)" value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })} required min="0" />
            </div>
            <input placeholder="연락처 (트위터, 오픈채팅 등)" value={form.contact}
              onChange={e => setForm({ ...form, contact: e.target.value })} required />
            {!user && !editId && (
              <input type="password" placeholder="게시글 비밀번호 (수정/삭제 시 필요, 4자 이상)" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} required minLength={4} />
            )}
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {preview && (
              <div className="image-preview">
                <img src={preview} alt="미리보기" />
                <button type="button" onClick={() => { setFile(null); setPreview(null) }}>제거</button>
              </div>
            )}
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (editId ? '수정 중...' : '등록 중...') : (editId ? '수정하기' : '등록하기')}
            </button>
            {editId && (
              <button type="button" className="cancel-btn" onClick={() => {
                setEditId(null); setEditPw(''); setShowForm(false)
                setForm({ title: '', description: '', idol: '', price: '', contact: '', password: '' })
              }}>취소</button>
            )}
          </form>
        )}

        <div className="trade-list">
          {trades.length === 0 ? (
            <div className="empty">등록된 거래 글이 없습니다.</div>
          ) : trades.map(t => (
            <div key={t.id} className={`trade-card ${t.status === 'sold' ? 'trade-sold' : ''}`}>
              {(t.thumbnail_url || t.image_url) && (
                <div className="trade-image-wrap">
                  <img src={t.thumbnail_url || t.image_url} alt={t.title} loading="lazy" />
                  {t.status === 'sold' && <div className="sold-badge">판매완료</div>}
                </div>
              )}
              {!t.image_url && t.status === 'sold' && (
                <div className="sold-badge-inline">판매완료</div>
              )}
              <div className="trade-body">
                <div className="trade-header">
                  <h3>{t.title}</h3>
                  <span className="trade-price">{formatPrice(t.price)}</span>
                </div>
                {t.description && <p className="trade-desc">{t.description}</p>}
                <div className="trade-meta">
                  <span className="tag tag-idol">{t.idol}</span>
                  {t.nickname && <span className="trade-nickname">{t.nickname}</span>}
                  <span className="trade-time">{timeAgo(t.created_at)}</span>
                </div>
                <div className="trade-contact">
                  <strong>연락처:</strong>{' '}
                  {visibleContacts[t.id] ? t.contact : maskContact(t.contact)}
                  <button className="contact-toggle" onClick={() =>
                    setVisibleContacts(v => ({ ...v, [t.id]: !v[t.id] }))
                  }>
                    {visibleContacts[t.id] ? '숨기기' : '보기'}
                  </button>
                </div>
                <div className="trade-actions">
                  {t.status === 'selling' && (isMyTrade(t) || !t.user_id) && (
                    <>
                      <button onClick={() => requestAction('edit', t.id)} className="edit-btn">수정</button>
                      <button onClick={() => requestAction('sold', t.id)} className="sold-btn">판매완료</button>
                      <button onClick={() => requestAction('delete', t.id)} className="del-btn">삭제</button>
                    </>
                  )}
                  <button onClick={() => { setReportModal({ show: true, id: t.id }); setReportReason(''); setReportDetail(''); setReportMsg('') }} className="report-btn-trade">신고</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span>{pagination.page} / {pagination.totalPages} (총 {pagination.total}건)</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        )}
      </div>

      {/* 로그인/회원가입 모달 */}
      {authModal.show && (
        <div className="modal-overlay" onClick={() => setAuthModal({ show: false, mode: 'login' })}>
          <div className="modal auth-modal" onClick={e => e.stopPropagation()}>
            <h3>{authModal.mode === 'login' ? '로그인' : '회원가입'}</h3>
            <form onSubmit={handleAuth}>
              <input
                type="text"
                placeholder="아이디 (영문/숫자, 3~20자)"
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                autoFocus
                required
              />
              <input
                type="password"
                placeholder="비밀번호 (4자 이상)"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
              {authModal.mode === 'signup' && (
                <input
                  type="text"
                  placeholder="닉네임 (2~10자)"
                  value={authForm.nickname}
                  onChange={e => setAuthForm({ ...authForm, nickname: e.target.value })}
                  required
                />
              )}
              {authMsg && <p className="err">{authMsg}</p>}
              <div className="modal-actions">
                <button type="submit" disabled={authLoading}>
                  {authLoading ? '처리 중...' : (authModal.mode === 'login' ? '로그인' : '가입하기')}
                </button>
                <button type="button" onClick={() => setAuthModal({ show: false, mode: 'login' })}>취소</button>
              </div>
            </form>
            <p className="auth-switch">
              {authModal.mode === 'login' ? (
                <>계정이 없으신가요? <button type="button" className="link-btn" onClick={() => { setAuthModal({ ...authModal, mode: 'signup' }); setAuthMsg('') }}>회원가입</button></>
              ) : (
                <>이미 계정이 있으신가요? <button type="button" className="link-btn" onClick={() => { setAuthModal({ ...authModal, mode: 'login' }); setAuthMsg('') }}>로그인</button></>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 비밀번호 확인 모달 */}
      {pwModal.show && (
        <div className="modal-overlay" onClick={() => setPwModal({ show: false, action: null, id: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>비밀번호 확인</h3>
            <p>게시글 작성 시 설정한 비밀번호를 입력하세요.</p>
            <input
              type="password"
              value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              placeholder="비밀번호"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handlePwConfirm()}
            />
            {pwError && <p className="err">{pwError}</p>}
            <div className="modal-actions">
              <button onClick={handlePwConfirm}>확인</button>
              <button onClick={() => setPwModal({ show: false, action: null, id: null })}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 신고 모달 */}
      {reportModal.show && (
        <div className="modal-overlay" onClick={() => setReportModal({ show: false, id: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>게시글 신고</h3>
            <p>신고 사유를 선택하세요.</p>
            <select value={reportReason} onChange={e => setReportReason(e.target.value)}>
              <option value="">사유 선택</option>
              <option value="사기 의심">사기 의심</option>
              <option value="허위 매물">허위 매물</option>
              <option value="부적절한 내용">부적절한 내용</option>
              <option value="기타">기타</option>
            </select>
            <textarea
              placeholder="상세 내용 (선택)"
              rows={3}
              value={reportDetail}
              onChange={e => setReportDetail(e.target.value)}
              style={{ width: '100%', marginTop: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical', fontSize: '0.9rem' }}
            />
            {reportMsg && <p className={reportMsg.includes('접수') ? 'msg-ok' : 'err'} style={{ marginTop: 8 }}>{reportMsg}</p>}
            <div className="modal-actions">
              <button onClick={handleReport}>신고하기</button>
              <button onClick={() => setReportModal({ show: false, id: null })}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
