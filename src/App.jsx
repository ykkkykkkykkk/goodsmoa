import React, { Component, useState, useEffect, lazy, Suspense, createContext } from 'react'
import { getUserInfo, trackPageView } from './api'

export const UserContext = createContext(null)

const MainPage = lazy(() => import('./pages/MainPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const TradePage = lazy(() => import('./pages/TradePage'))
const PocaPage = lazy(() => import('./pages/PocaPage'))

const CATEGORIES = ['전체', '팝업스토어', '공식샵', '온라인몰']
const VALID_PAGES = ['main', 'admin', 'trade', 'poca']

// Error Boundary
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-page">
          <div className="error-box">
            <h1>문제가 발생했습니다</h1>
            <p>페이지를 불러오는 중 오류가 발생했습니다.</p>
            <div className="error-actions">
              <button onClick={() => window.location.reload()}>새로고침</button>
              <a href="#main">메인으로</a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// 404 페이지
function NotFoundPage() {
  return (
    <div className="error-page">
      <div className="error-box">
        <h1>404</h1>
        <p>페이지를 찾을 수 없습니다.</p>
        <a href="#main" className="error-home">메인으로 돌아가기</a>
      </div>
    </div>
  )
}

function PageRouter({ page }) {
  if (page === 'admin') return <AdminPage />
if (page === 'trade') return <TradePage />
  if (page === 'poca') return <PocaPage />
  if (page === 'main') return <MainPage categories={CATEGORIES} />
  return <NotFoundPage />
}

export default function App() {
  const [page, setPage] = useState('main')
  const [user, setUser] = useState(getUserInfo())

  useEffect(() => {
    const update = () => {
      const hash = window.location.hash.slice(1) || 'main'
      setPage(hash)
    }
    window.addEventListener('hashchange', update)
    update()
    return () => window.removeEventListener('hashchange', update)
  }, [])

  // 페이지별 title 설정 + 페이지뷰 기록
  useEffect(() => {
    const titles = {
      main: '굿즈모아 - 아이돌 굿즈 쇼핑몰 모음',
      admin: '굿즈모아 - 관리자',
      trade: '굿즈모아 - 포카교환',
      poca: '굿즈모아 - 포카도감',
    }
    document.title = titles[page] || '굿즈모아'
    trackPageView(page)
  }, [page])

  return (
    <ErrorBoundary>
      <UserContext.Provider value={{ user, setUser }}>
        <Suspense fallback={<div className="loading" role="status" aria-label="로딩 중">로딩 중...</div>}>
          <PageRouter page={page} />
        </Suspense>
      </UserContext.Provider>
    </ErrorBoundary>
  )
}
