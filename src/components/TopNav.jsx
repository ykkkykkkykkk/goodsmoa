import React, { useState } from 'react'
import { signup, login, getUserInfo, setUserToken, setUserInfo, clearUserToken } from '../api'

export default function TopNav({ categories, selected, onSelect, user, onUserChange }) {
  const [authModal, setAuthModal] = useState({ show: false, mode: 'login' })
  const [authForm, setAuthForm] = useState({ username: '', password: '', nickname: '' })
  const [authMsg, setAuthMsg] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

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
        onUserChange(res.user)
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
    onUserChange(null)
  }

  return (
    <>
      <header className="top-nav" role="banner">
        <div className="top-nav-inner">
          <a href="#main" className="logo" aria-label="굿즈모아 홈으로">굿즈모아</a>
          <nav className="nav-links" aria-label="카테고리 네비게이션">
            {categories.map(cat => (
              <button
                key={cat}
                className={`nav-btn ${selected === cat ? 'active' : ''}`}
                onClick={() => onSelect(cat)}
                aria-pressed={selected === cat}
              >
                {cat}
              </button>
            ))}
            <a href="#trade" className="nav-btn trade-btn" aria-label="포카교환 페이지로 이동">포카교환</a>
            <a href="#report" className="nav-btn report-btn" aria-label="쇼핑몰 제보 페이지로 이동">제보하기</a>
          </nav>
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
    </>
  )
}
