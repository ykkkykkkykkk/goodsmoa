import React, { useState, useEffect, useContext } from 'react'
import { getIdols, getPocaCards, createPocaPost, analyzePocaImage, getPocaCardDetail, addPocaComment, togglePocaReaction, getPocaProfile, deletePocaCard, signup, login, getUserToken, setUserToken, clearUserToken, setUserInfo } from '../api'
import { UserContext } from '../App'

export default function PocaPage() {
  const { user, setUser } = useContext(UserContext)
  const [idols, setIdols] = useState([])
  const [cards, setCards] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)

  // 필터
  const [filterArtist, setFilterArtist] = useState('')
  const [filterRarity, setFilterRarity] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // 업로드 폼
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formCards, setFormCards] = useState([{ artist: '', album: '', version: '', rarity: 1, file: null, preview: null }])
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  // 카드 상세 모달
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentType, setCommentType] = useState('comment')

  // 프로필 모달
  const [profile, setProfile] = useState(null)

  // 로그인 모달
  const [authModal, setAuthModal] = useState({ show: false, mode: 'login' })
  const [authForm, setAuthForm] = useState({ username: '', password: '', nickname: '' })
  const [authMsg, setAuthMsg] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => { getIdols().then(setIdols).catch(console.error) }, [])

  const loadCards = () => {
    getPocaCards(filterArtist, '', filterRarity, searchQuery, page).then(res => {
      setCards(res.data)
      setPagination(res.pagination)
    }).catch(console.error)
  }
  useEffect(loadCards, [filterArtist, filterRarity, searchQuery, page])

  const handleSearch = (e) => { e.preventDefault(); setPage(1); setSearchQuery(searchInput) }

  // 로그인/회원가입
  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthLoading(true); setAuthMsg('')
    try {
      const res = authModal.mode === 'login'
        ? await login(authForm.username, authForm.password)
        : await signup(authForm.username, authForm.password, authForm.nickname)
      if (res.ok) {
        setUserToken(res.token); setUserInfo(res.user); setUser(res.user)
        setAuthModal({ show: false, mode: 'login' }); setAuthForm({ username: '', password: '', nickname: '' })
      } else { setAuthMsg(res.message || '실패') }
    } catch (err) { setAuthMsg('오류: ' + err.message) }
    finally { setAuthLoading(false) }
  }

  // 카드 폼 관리
  const updateCardForm = (idx, field, value) => {
    const next = [...formCards]
    next[idx] = { ...next[idx], [field]: value }
    setFormCards(next)
  }

  const handleCardFile = async (idx, e) => {
    const f = e.target.files[0]
    if (!f) return
    const preview = URL.createObjectURL(f)

    setFormCards(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], file: f, preview, analyzing: true, analyzed: false }
      return next
    })

    try {
      const res = await analyzePocaImage(f)
      if (res.ok && res.data) {
        const d = res.data
        setFormCards(prev => {
          const next = [...prev]
          next[idx] = {
            ...next[idx],
            artist: d.artist || next[idx].artist,
            album: d.album || next[idx].album,
            version: d.version || next[idx].version,
            rarity: d.rarity || next[idx].rarity,
            analyzing: false,
            analyzed: true,
          }
          return next
        })
      } else {
        setFormCards(prev => {
          const next = [...prev]
          next[idx] = { ...next[idx], analyzing: false }
          return next
        })
      }
    } catch {
      setFormCards(prev => {
        const next = [...prev]
        next[idx] = { ...next[idx], analyzing: false }
        return next
      })
    }
  }

  const addCardSlot = () => {
    if (formCards.length >= 10) return
    setFormCards([...formCards, { artist: '', album: '', version: '', rarity: 1, file: null, preview: null }])
  }

  const removeCardSlot = (idx) => {
    if (formCards.length <= 1) return
    setFormCards(formCards.filter((_, i) => i !== idx))
  }

  // 업로드
  const handleUpload = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) { setUploadMsg('제목을 입력하세요'); return }
    const validCards = formCards.filter(c => c.file)
    if (validCards.length === 0) { setUploadMsg('이미지를 1장 이상 선택하세요'); return }

    setUploading(true); setUploadMsg('')
    try {
      const fd = new FormData()
      fd.append('title', formTitle)
      const cardData = validCards.map(c => ({ artist: c.artist, album: c.album, version: c.version, rarity: c.rarity }))
      fd.append('cards', JSON.stringify(cardData))
      validCards.forEach(c => fd.append('images', c.file))

      const res = await createPocaPost(fd)
      if (res.ok) {
        setUploadMsg(res.message)
        setFormTitle(''); setFormCards([{ artist: '', album: '', version: '', rarity: 1, file: null, preview: null }])
        setShowForm(false)
        loadCards()
      } else { setUploadMsg(res.message || '실패') }
    } catch (err) { setUploadMsg('실패: ' + err.message) }
    finally { setUploading(false) }
  }

  // 카드 상세 열기
  const openDetail = async (cardId) => {
    setDetailLoading(true); setDetail(null)
    try {
      const data = await getPocaCardDetail(cardId)
      setDetail(data)
    } catch { setDetail(null) }
    finally { setDetailLoading(false) }
  }

  // 댓글 작성
  const handleComment = async () => {
    if (!commentText.trim()) return
    const res = await addPocaComment(detail.id, commentText, commentType)
    if (res.ok) {
      setCommentText(''); setCommentType('comment')
      openDetail(detail.id)
    }
  }

  // 반응 토글
  const handleReaction = async (type) => {
    const res = await togglePocaReaction(detail.id, type)
    if (res.ok) openDetail(detail.id)
  }

  // 프로필 열기
  const openProfile = async (userId) => {
    try {
      const data = await getPocaProfile(userId)
      setProfile(data)
    } catch { setProfile(null) }
  }

  // 카드 삭제
  const handleDeleteCard = async (cardId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const res = await deletePocaCard(cardId)
    if (res.ok) { setDetail(null); loadCards() }
  }

  const rarityStars = (r) => '★'.repeat(r) + '☆'.repeat(5 - r)
  const rarityLabel = (r) => ['', 'N', 'R', 'SR', 'SSR', 'UR'][r] || ''

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr + 'Z').getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  return (
    <div className="poca-page">
      <header className="top-nav">
        <div className="top-nav-inner">
          <a href="#main" className="logo">굿즈모아</a>
          <span className="page-title">포카도감</span>
          <div className="auth-area">
            {user ? (
              <>
                <span className="user-nickname" style={{ cursor: 'pointer' }} onClick={() => openProfile(user.id)}>{user.nickname}</span>
                <button className="auth-btn" onClick={() => { clearUserToken(); setUser(null) }}>로그아웃</button>
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

      <div className="poca-banner">
        <p>나만의 포토카드 컬렉션을 자랑하고 공유하세요!</p>
        <p className="trade-notice">사진을 올리면 홀로그램 이펙트가 자동 적용됩니다.</p>
      </div>

      <div className="poca-container">
        {/* 툴바 */}
        <div className="trade-toolbar">
          <div className="trade-filters">
            <select value={filterArtist} onChange={e => { setFilterArtist(e.target.value); setPage(1) }}>
              <option value="">전체 아이돌</option>
              {idols.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
            <select value={filterRarity} onChange={e => { setFilterRarity(e.target.value); setPage(1) }}>
              <option value="">전체 등급</option>
              <option value="1">★ N</option>
              <option value="2">★★ R</option>
              <option value="3">★★★ SR</option>
              <option value="4">★★★★ SSR</option>
              <option value="5">★★★★★ UR</option>
            </select>
            <form onSubmit={handleSearch} className="trade-search">
              <input placeholder="검색..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
              <button type="submit">검색</button>
            </form>
          </div>
          <button className="trade-write-btn" onClick={() => {
            if (!user) { setAuthModal({ show: true, mode: 'login' }); setAuthMsg('포카 등록은 로그인이 필요합니다'); return }
            setShowForm(!showForm)
          }}>
            {showForm ? '닫기' : '포카 등록'}
          </button>
        </div>

        {uploadMsg && <div className={`msg ${uploadMsg.includes('등록') ? 'msg-ok' : 'msg-err'}`}>{uploadMsg}</div>}

        {/* 업로드 폼 */}
        {showForm && (
          <form onSubmit={handleUpload} className="poca-upload-form">
            <input placeholder="제목 (예: 뉴진스 겟업 앨범 포카)" value={formTitle}
              onChange={e => setFormTitle(e.target.value)} required />
            {formCards.map((c, idx) => (
              <div key={idx} className="poca-card-form-row">
                <div className="poca-card-form-header">
                  <span className="poca-card-form-num">카드 {idx + 1}</span>
                  <div className="poca-card-form-header-right">
                    {c.analyzing && <span className="ai-badge analyzing">AI 분석 중...</span>}
                    {c.analyzed && !c.analyzing && <span className="ai-badge analyzed">AI 자동입력</span>}
                    {formCards.length > 1 && <button type="button" className="del-btn" onClick={() => removeCardSlot(idx)}>제거</button>}
                  </div>
                </div>
                <div className="poca-card-form-fields">
                  <input type="file" accept="image/*" onChange={e => handleCardFile(idx, e)} required={!c.file} />
                  <input placeholder="아티스트" value={c.artist} onChange={e => updateCardForm(idx, 'artist', e.target.value)}
                    className={c.analyzed && c.artist ? 'ai-filled' : ''} />
                  <input placeholder="앨범" value={c.album} onChange={e => updateCardForm(idx, 'album', e.target.value)}
                    className={c.analyzed && c.album ? 'ai-filled' : ''} />
                  <input placeholder="버전" value={c.version} onChange={e => updateCardForm(idx, 'version', e.target.value)}
                    className={c.analyzed && c.version ? 'ai-filled' : ''} />
                  <select value={c.rarity} onChange={e => updateCardForm(idx, 'rarity', parseInt(e.target.value))}
                    className={c.analyzed ? 'ai-filled' : ''}>
                    <option value={1}>★ N</option>
                    <option value={2}>★★ R</option>
                    <option value={3}>★★★ SR</option>
                    <option value={4}>★★★★ SSR</option>
                    <option value={5}>★★★★★ UR</option>
                  </select>
                </div>
                {c.preview && <img src={c.preview} alt="미리보기" className="poca-card-preview" />}
              </div>
            ))}
            <button type="button" className="poca-add-card-btn" onClick={addCardSlot}>+ 카드 추가 (최대 10장)</button>
            <button type="submit" className="submit-btn" disabled={uploading}>
              {uploading ? '업로드 중...' : '등록하기'}
            </button>
          </form>
        )}

        {/* 4열 그리드 도감 */}
        <div className="poca-grid">
          {cards.length === 0 ? (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>등록된 포토카드가 없습니다.</div>
          ) : cards.map(c => (
            <div key={c.id} className={`poca-card rarity-${c.rarity}`} onClick={() => openDetail(c.id)}>
              <div className="poca-card-image-wrap">
                <img src={c.thumbnail_url || c.image_url} alt={c.artist} loading="lazy" />
                <div className="holo-overlay"></div>
                <div className="shimmer"></div>
              </div>
              <div className="poca-card-info">
                <div className="poca-card-artist">{c.artist || '미입력'}</div>
                <div className="poca-card-meta">
                  {c.album && <span className="poca-tag">{c.album}</span>}
                  {c.version && <span className="poca-tag">{c.version}</span>}
                </div>
                <div className="poca-card-rarity">
                  <span className={`rarity-badge rarity-${c.rarity}`}>{rarityLabel(c.rarity)}</span>
                  <span className="rarity-stars">{rarityStars(c.rarity)}</span>
                </div>
                <div className="poca-card-reactions-mini">
                  {c.reactions['부럽다'] > 0 && <span>부럽다 {c.reactions['부럽다']}</span>}
                  {c.reactions['교환해요'] > 0 && <span>교환 {c.reactions['교환해요']}</span>}
                  {c.reactions['나도있어요'] > 0 && <span>나도! {c.reactions['나도있어요']}</span>}
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

      {/* 카드 상세 모달 */}
      {(detail || detailLoading) && (
        <div className="modal-overlay" onClick={() => { setDetail(null); setDetailLoading(false) }}>
          <div className="modal poca-detail-modal" onClick={e => e.stopPropagation()}>
            {detailLoading ? <p>로딩 중...</p> : detail && (
              <>
                <div className="poca-detail-top">
                  <div className={`poca-detail-card rarity-${detail.rarity}`}>
                    <img src={detail.image_url} alt={detail.artist} />
                    <div className="holo-overlay"></div>
                    <div className="shimmer"></div>
                  </div>
                  <div className="poca-detail-info">
                    <h3>{detail.post_title}</h3>
                    <p className="poca-detail-artist">{detail.artist}</p>
                    {detail.album && <p className="poca-detail-sub">앨범: {detail.album}</p>}
                    {detail.version && <p className="poca-detail-sub">버전: {detail.version}</p>}
                    <p className="poca-detail-rarity">
                      <span className={`rarity-badge rarity-${detail.rarity}`}>{rarityLabel(detail.rarity)}</span>
                      {rarityStars(detail.rarity)}
                    </p>
                    <p className="poca-detail-owner" onClick={() => { openProfile(detail.user_id); setDetail(null) }} style={{ cursor: 'pointer' }}>
                      by <strong>{detail.nickname}</strong>
                    </p>

                    {/* 반응 버튼 */}
                    <div className="poca-reaction-btns">
                      {['부럽다', '교환해요', '나도있어요'].map(type => (
                        <button key={type} className="poca-reaction-btn" onClick={() => {
                          if (!user) { setAuthModal({ show: true, mode: 'login' }); setAuthMsg('로그인이 필요합니다'); return }
                          handleReaction(type)
                        }}>
                          {type} {detail.reactions[type] || 0}
                        </button>
                      ))}
                    </div>

                    {user && detail.user_id === user.id && (
                      <button className="del-btn" style={{ marginTop: 8 }} onClick={() => handleDeleteCard(detail.id)}>삭제</button>
                    )}
                  </div>
                </div>

                {/* 댓글 */}
                <div className="poca-comments">
                  <h4>댓글 ({detail.comments?.length || 0})</h4>
                  {user && (
                    <div className="poca-comment-form">
                      <div className="poca-comment-type-btns">
                        {['comment', '부럽다', '교환해요', '나도있어요'].map(t => (
                          <button key={t} type="button"
                            className={`poca-comment-type-btn ${commentType === t ? 'active' : ''}`}
                            onClick={() => setCommentType(t)}>
                            {t === 'comment' ? '일반' : t}
                          </button>
                        ))}
                      </div>
                      <div className="poca-comment-input-row">
                        <input placeholder="댓글을 입력하세요" value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleComment()} />
                        <button onClick={handleComment}>등록</button>
                      </div>
                    </div>
                  )}
                  <div className="poca-comment-list">
                    {detail.comments?.map(cm => (
                      <div key={cm.id} className="poca-comment-item">
                        <div className="poca-comment-header">
                          <strong>{cm.nickname}</strong>
                          {cm.type !== 'comment' && <span className="poca-comment-badge">{cm.type}</span>}
                          <span className="poca-comment-time">{timeAgo(cm.created_at)}</span>
                        </div>
                        <p>{cm.content}</p>
                      </div>
                    ))}
                    {(!detail.comments || detail.comments.length === 0) && <p className="empty-small">아직 댓글이 없습니다.</p>}
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setDetail(null)}>닫기</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 프로필 모달 */}
      {profile && (
        <div className="modal-overlay" onClick={() => setProfile(null)}>
          <div className="modal poca-profile-modal" onClick={e => e.stopPropagation()}>
            <h3>{profile.nickname}의 프로필</h3>
            <div className="poca-profile-stats">
              <div className="poca-profile-stat">
                <div className="poca-profile-stat-num">{profile.totalCards}</div>
                <div className="poca-profile-stat-label">보유 카드</div>
              </div>
              <div className="poca-profile-stat">
                <div className="poca-profile-stat-num poca-ssr">{profile.ssrCards}</div>
                <div className="poca-profile-stat-label">SSR+</div>
              </div>
              <div className="poca-profile-stat">
                <div className="poca-profile-stat-num poca-exchange">{profile.exchangeDone}</div>
                <div className="poca-profile-stat-label">교환완료</div>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setProfile(null)}>닫기</button>
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
              <input type="text" placeholder="아이디 (영문/숫자, 3~20자)" value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })} autoFocus required />
              <input type="password" placeholder="비밀번호 (4자 이상)" value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />
              {authModal.mode === 'signup' && (
                <input type="text" placeholder="닉네임 (2~10자)" value={authForm.nickname}
                  onChange={e => setAuthForm({ ...authForm, nickname: e.target.value })} required />
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
    </div>
  )
}
