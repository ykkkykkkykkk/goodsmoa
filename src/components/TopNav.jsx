import React from 'react'

export default function TopNav({ categories, selected, onSelect }) {
  return (
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
          <a href="#trade" className="nav-btn trade-btn" aria-label="중고거래 페이지로 이동">중고거래</a>
          <a href="#report" className="nav-btn report-btn" aria-label="쇼핑몰 제보 페이지로 이동">제보하기</a>
        </nav>
      </div>
    </header>
  )
}
