import React, { useState, useEffect, useContext } from 'react'
import { getIdols, getExchanges, createExchange, updateExchange, updateExchangeStatus, deleteExchange, getMatches, reportTrade, signup, login, getUserToken, setUserToken, clearUserToken, getUserInfo, setUserInfo } from '../api'
import { UserContext } from '../App'

export default function TradePage() {
  const [idols, setIdols] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [filterIdol, setFilterIdol] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ idol: '', member: '', description: '', contact: '', password: '' })
  const [haveInput, setHaveInput] = useState('')
  const [wantInput, setWantInput] = useState('')
  const [haveTags, setHaveTags] = useState([])
  const [wantTags, setWantTags] = useState([])
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

  // 매칭 결과
  const [matchModal, setMatchModal] = useState({ show: false, id: null, data: [], loading: false })

  // 연락처 공개 토글
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

  const loadExchanges = () => {
    getExchanges(filterIdol, filterStatus, searchQuery, page).then(res => {
      setExchanges(res.data)
      setPagination(res.pagination)
    }).catch(console.error)
  }
  useEffect(loadExchanges, [filterIdol, filterStatus, searchQuery, page])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearchQuery(searchInput)
  }

  // 로그인/회원가입
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

  const isMyExchange = (ex) => user && ex.user_id && user.id === ex.user_id

  // 태그 추가
  const addTag = (type, value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (type === 'have') {
      if (!haveTags.includes(trimmed)) setHaveTags([...haveTags, trimmed])
      setHaveInput('')
    } else {
      if (!wantTags.includes(trimmed)) setWantTags([...wantTags, trimmed])
      setWantInput('')
    }
  }

  const removeTag = (type, idx) => {
    if (type === 'have') setHaveTags(haveTags.filter((_, i) => i !== idx))
    else setWantTags(wantTags.filter((_, i) => i !== idx))
  }

  const handleTagKeyDown = (type, e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(type, type === 'have' ? haveInput : wantInput)
    }
  }

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.idol || !form.contact) {
      setMsg('아이돌과 연락처는 필수입니다.')
      return
    }
    if (haveTags.length === 0 && wantTags.length === 0) {
      setMsg('보유 카드 또는 희망 카드를 1개 이상 입력하세요.')
      return
    }
    if (!user && !editId && (!form.password || form.password.length < 4)) {
      setMsg('비밀번호는 4자 이상 입력하세요.')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('idol', form.idol)
      fd.append('member', form.member)
      fd.append('have_cards', JSON.stringify(haveTags))
      fd.append('want_cards', JSON.stringify(wantTags))
      fd.append('description', form.description)
      fd.append('contact', form.contact)
      if (file) fd.append('image', file)

      let res
      if (editId) {
        res = await updateExchange(editId, fd, editPw || '')
      } else {
        if (!user) fd.append('password', form.password)
        res = await createExchange(fd)
      }

      if (res.ok) {
        setMsg(editId ? '수정되었습니다!' : '등록되었습니다!')
        resetForm()
        loadExchanges()
      } else {
        setMsg(res.message || '실패')
      }
    } catch (err) {
      setMsg('실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ idol: '', member: '', description: '', contact: '', password: '' })
    setHaveTags([])
    setWantTags([])
    setHaveInput('')
    setWantInput('')
    setFile(null)
    setPreview(null)
    setShowForm(false)
    setEditId(null)
    setEditPw('')
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    setFile(f)
    if (f) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  const maskContact = (contact) => {
    if (!contact || contact.length <= 4) return '****'
    return contact.slice(0, 3) + '*'.repeat(contact.length - 3)
  }

  // 매칭 보기
  const handleViewMatches = async (id) => {
    setMatchModal({ show: true, id, data: [], loading: true })
    try {
      const data = await getMatches(id)
      setMatchModal({ show: true, id, data, loading: false })
    } catch {
      setMatchModal({ show: true, id, data: [], loading: false })
    }
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

  // 비밀번호 확인 후 동작
  const requestAction = (action, id) => {
    const ex = exchanges.find(t => t.id === id)
    if (isMyExchange(ex)) {
      if (action === 'completed') {
        updateExchangeStatus(id, 'completed', '').then(res => { if (res.ok) loadExchanges() })
      } else if (action === 'delete') {
        if (confirm('정말 삭제하시겠습니까?')) {
          deleteExchange(id, '').then(res => { if (res.ok) loadExchanges() })
        }
      } else if (action === 'edit') {
        setEditPw('')
        setEditId(id)
        setForm({
          idol: ex.idol,
          member: ex.member || '',
          description: ex.description || '',
          contact: ex.contact,
          password: '',
        })
        setHaveTags(ex.have_cards || [])
        setWantTags(ex.want_cards || [])
        setShowForm(true)
      }
      return
    }
    setPwModal({ show: true, action, id })
    setPwInput('')
    setPwError('')
  }

  const handlePwConfirm = async () => {
    const { action, id } = pwModal
    if (action === 'completed') {
      const res = await updateExchangeStatus(id, 'completed', pwInput)
      if (res.ok) { setPwModal({ show: false, action: null, id: null }); loadExchanges() }
      else setPwError(res.message || '비밀번호가 올바르지 않습니다')
    } else if (action === 'delete') {
      const res = await deleteExchange(id, pwInput)
      if (res.ok) { setPwModal({ show: false, action: null, id: null }); loadExchanges() }
      else setPwError(res.message || '비밀번호가 올바르지 않습니다')
    } else if (action === 'edit') {
      const ex = exchanges.find(t => t.id === id)
      if (!ex) return
      setEditPw(pwInput)
      setEditId(id)
      setForm({
        idol: ex.idol,
        member: ex.member || '',
        description: ex.description || '',
        contact: ex.contact,
        password: '',
      })
      setHaveTags(ex.have_cards || [])
      setWantTags(ex.want_cards || [])
      setShowForm(true)
      setPwModal({ show: false, action: null, id: null })
    }
  }

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr + 'Z').getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  const matchTypeLabel = (type) => {
    if (type === 'mutual') return '쌍방 매칭'
    if (type === 'partial_they_have') return '상대가 내가 원하는 카드 보유'
    return '내가 상대가 원하는 카드 보유'
  }

  const matchTypeBadgeClass = (type) => {
    if (type === 'mutual') return 'match-badge-mutual'
    return 'match-badge-partial'
  }

  return (
    <div className="trade-page">
      <header className="top-nav">
        <div className="top-nav-inner">
          <a href="#main" className="logo">굿즈모아</a>
          <span className="page-title">포카교환</span>
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
        <p>아이돌 포토카드를 팬들끼리 교환할 수 있는 공간입니다.</p>
        <p className="trade-notice">보유 카드와 희망 카드를 등록하면 자동으로 매칭해드려요!</p>
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
              <option value="exchanging">교환중</option>
              <option value="completed">교환완료</option>
            </select>
            <form onSubmit={handleSearch} className="trade-search">
              <input
                type="text"
                placeholder="카드/멤버 검색..."
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
            if (showForm) resetForm()
          }}>
            {showForm ? '닫기' : '교환 등록'}
          </button>
        </div>

        {msg && <div className={`msg ${msg.includes('되었습니다') ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="trade-form exchange-form">
            <div className="trade-form-row">
              <select value={form.idol} onChange={e => setForm({ ...form, idol: e.target.value })} required>
                <option value="">아이돌 선택</option>
                {idols.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
              <input placeholder="멤버 (선택)" value={form.member}
                onChange={e => setForm({ ...form, member: e.target.value })} />
            </div>

            <div className="tag-input-group">
              <label className="tag-label have-label">보유 카드</label>
              <div className="tag-input-wrap">
                {haveTags.map((tag, i) => (
                  <span key={i} className="card-tag have-tag">
                    {tag}
                    <button type="button" onClick={() => removeTag('have', i)}>&times;</button>
                  </span>
                ))}
                <input
                  placeholder="카드명 입력 후 Enter (예: 럭키드로우 민지)"
                  value={haveInput}
                  onChange={e => setHaveInput(e.target.value)}
                  onKeyDown={e => handleTagKeyDown('have', e)}
                  onBlur={() => addTag('have', haveInput)}
                />
              </div>
            </div>

            <div className="tag-input-group">
              <label className="tag-label want-label">희망 카드</label>
              <div className="tag-input-wrap">
                {wantTags.map((tag, i) => (
                  <span key={i} className="card-tag want-tag">
                    {tag}
                    <button type="button" onClick={() => removeTag('want', i)}>&times;</button>
                  </span>
                ))}
                <input
                  placeholder="카드명 입력 후 Enter (예: 앨범 포카 하니)"
                  value={wantInput}
                  onChange={e => setWantInput(e.target.value)}
                  onKeyDown={e => handleTagKeyDown('want', e)}
                  onBlur={() => addTag('want', wantInput)}
                />
              </div>
            </div>

            <textarea placeholder="추가 설명 (카드 상태, 교환 조건 등)" rows={2} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
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
              <button type="button" className="cancel-btn" onClick={resetForm}>취소</button>
            )}
          </form>
        )}

        <div className="trade-list">
          {exchanges.length === 0 ? (
            <div className="empty">등록된 교환 글이 없습니다.</div>
          ) : exchanges.map(ex => (
            <div key={ex.id} className={`trade-card exchange-card ${ex.status === 'completed' ? 'trade-sold' : ''}`}>
              {(ex.thumbnail_url || ex.image_url) && (
                <div className="trade-image-wrap">
                  <img src={ex.thumbnail_url || ex.image_url} alt="포토카드" loading="lazy" />
                  {ex.status === 'completed' && <div className="sold-badge">교환완료</div>}
                </div>
              )}
              {!ex.image_url && ex.status === 'completed' && (
                <div className="sold-badge-inline">교환완료</div>
              )}
              <div className="trade-body">
                <div className="trade-header">
                  <h3>{ex.idol}{ex.member ? ` - ${ex.member}` : ''}</h3>
                </div>

                <div className="card-tags-section">
                  {ex.have_cards && ex.have_cards.length > 0 && (
                    <div className="card-tags-row">
                      <span className="card-tags-label have-label">보유</span>
                      <div className="card-tags-list">
                        {ex.have_cards.map((c, i) => <span key={i} className="card-tag have-tag">{c}</span>)}
                      </div>
                    </div>
                  )}
                  {ex.want_cards && ex.want_cards.length > 0 && (
                    <div className="card-tags-row">
                      <span className="card-tags-label want-label">희망</span>
                      <div className="card-tags-list">
                        {ex.want_cards.map((c, i) => <span key={i} className="card-tag want-tag">{c}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                {ex.description && <p className="trade-desc">{ex.description}</p>}
                <div className="trade-meta">
                  <span className="tag tag-idol">{ex.idol}</span>
                  {ex.nickname && <span className="trade-nickname">{ex.nickname}</span>}
                  <span className="trade-time">{timeAgo(ex.created_at)}</span>
                </div>
                <div className="trade-contact">
                  <strong>연락처:</strong>{' '}
                  {visibleContacts[ex.id] ? ex.contact : maskContact(ex.contact)}
                  <button className="contact-toggle" onClick={() =>
                    setVisibleContacts(v => ({ ...v, [ex.id]: !v[ex.id] }))
                  }>
                    {visibleContacts[ex.id] ? '숨기기' : '보기'}
                  </button>
                </div>
                <div className="trade-actions">
                  {ex.status === 'exchanging' && (
                    <button onClick={() => handleViewMatches(ex.id)} className="match-btn">매칭 찾기</button>
                  )}
                  {ex.status === 'exchanging' && (isMyExchange(ex) || !ex.user_id) && (
                    <>
                      <button onClick={() => requestAction('edit', ex.id)} className="edit-btn">수정</button>
                      <button onClick={() => requestAction('completed', ex.id)} className="sold-btn">교환완료</button>
                      <button onClick={() => requestAction('delete', ex.id)} className="del-btn">삭제</button>
                    </>
                  )}
                  <button onClick={() => { setReportModal({ show: true, id: ex.id }); setReportReason(''); setReportDetail(''); setReportMsg('') }} className="report-btn-trade">신고</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
            <span>{pagination.page} / {pagination.totalPages} (총 {pagination.total}건)</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>다음</button>
          </div>
        )}
      </div>

      {/* 매칭 결과 모달 */}
      {matchModal.show && (
        <div className="modal-overlay" onClick={() => setMatchModal({ show: false, id: null, data: [], loading: false })}>
          <div className="modal match-modal" onClick={e => e.stopPropagation()}>
            <h3>매칭 결과</h3>
            {matchModal.loading ? (
              <p>매칭 검색 중...</p>
            ) : matchModal.data.length === 0 ? (
              <p>아직 매칭되는 교환글이 없습니다.</p>
            ) : (
              <div className="match-list">
                {matchModal.data.map(m => (
                  <div key={m.id} className="match-item">
                    <div className="match-item-header">
                      <span className={`match-badge ${matchTypeBadgeClass(m.match_type)}`}>
                        {matchTypeLabel(m.match_type)}
                      </span>
                      {m.nickname && <span className="match-nickname">{m.nickname}</span>}
                    </div>
                    <div className="match-item-body">
                      {m.they_have_i_want.length > 0 && (
                        <div className="match-detail">
                          <span className="match-detail-label">상대 보유 (내가 원하는):</span>
                          <div className="card-tags-list">
                            {m.they_have_i_want.map((c, i) => <span key={i} className="card-tag have-tag">{c}</span>)}
                          </div>
                        </div>
                      )}
                      {m.i_have_they_want.length > 0 && (
                        <div className="match-detail">
                          <span className="match-detail-label">내가 보유 (상대가 원하는):</span>
                          <div className="card-tags-list">
                            {m.i_have_they_want.map((c, i) => <span key={i} className="card-tag want-tag">{c}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="match-item-contact">
                      <strong>연락처:</strong>{' '}
                      {visibleContacts[`match_${m.id}`] ? m.contact : maskContact(m.contact)}
                      <button className="contact-toggle" onClick={() =>
                        setVisibleContacts(v => ({ ...v, [`match_${m.id}`]: !v[`match_${m.id}`] }))
                      }>
                        {visibleContacts[`match_${m.id}`] ? '숨기기' : '보기'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button onClick={() => setMatchModal({ show: false, id: null, data: [], loading: false })}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 로그인/회원가입 모달 */}
      {authModal.show && (
        <div className="modal-overlay" onClick={() => setAuthModal({ show: false, mode: 'login' })}>
          <div className="modal auth-modal" onClick={e => e.stopPropagation()}>
            <h3>{authModal.mode === 'login' ? '로그인' : '회원가입'}</h3>
            <form onSubmit={handleAuth}>
              <input
                type="text" placeholder="아이디 (영문/숫자, 3~20자)"
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                autoFocus required
              />
              <input
                type="password" placeholder="비밀번호 (4자 이상)"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
              {authModal.mode === 'signup' && (
                <input
                  type="text" placeholder="닉네임 (2~10자)"
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
              type="password" value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              placeholder="비밀번호" autoFocus
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
              placeholder="상세 내용 (선택)" rows={3}
              value={reportDetail} onChange={e => setReportDetail(e.target.value)}
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
