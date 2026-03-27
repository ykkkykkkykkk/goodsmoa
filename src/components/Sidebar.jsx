import React from 'react'

export default function Sidebar({ idols, selected, onSelect }) {
  return (
    <aside className="sidebar" aria-label="아이돌 필터">
      <h3>아이돌</h3>
      <ul className="idol-list" role="listbox" aria-label="아이돌 목록">
        {idols.map(idol => (
          <li key={idol.id} role="option" aria-selected={selected === idol.name}>
            <button
              className={`idol-btn ${selected === idol.name ? 'active' : ''}`}
              onClick={() => onSelect(idol.name)}
              aria-pressed={selected === idol.name}
              style={{
                '--idol-color': idol.color,
              }}
            >
              <span
                className="idol-dot"
                style={{ background: idol.color }}
                aria-hidden="true"
              />
              {idol.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
