import React from 'react'

export default function InfoPanel({ idol, recent }) {
  return (
    <aside className="info-panel">
      {idol && (
        <div className="idol-info-box" style={{ borderColor: idol.color }}>
          <h3 style={{ color: idol.color }}>{idol.name}</h3>
          <div className="idol-details">
            {idol.agency && <p><strong>소속</strong> {idol.agency}</p>}
            {idol.debut && <p><strong>데뷔</strong> {idol.debut}</p>}
          </div>
        </div>
      )}

      <div className="recent-box">
        <h3>최근 등록</h3>
        <ul className="recent-list">
          {recent.map(b => (
            <li key={b.id} className="recent-item">
              <span className="recent-shop">{b.shop_name}</span>
              <span className="recent-meta">
                {b.idol} · {b.category}
              </span>
            </li>
          ))}
          {recent.length === 0 && <li className="empty-small">아직 등록된 배너가 없습니다.</li>}
        </ul>
      </div>
    </aside>
  )
}
