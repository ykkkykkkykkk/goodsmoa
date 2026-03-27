import React, { useState, useEffect } from 'react'
import { getIdols, submitReport } from '../api'

const CATEGORIES = ['팝업스토어', '공식샵', '온라인몰']

export default function ReportPage() {
  const [idols, setIdols] = useState([])
  const [form, setForm] = useState({ shop_name: '', url: '', idol: '', category: '온라인몰' })
  const [file, setFile] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getIdols().then(setIdols).catch(console.error)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.shop_name || !form.url || !form.idol) {
      setMsg('쇼핑몰명, URL, 아이돌은 필수입니다.')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('shop_name', form.shop_name)
      fd.append('url', form.url)
      fd.append('idol', form.idol)
      fd.append('category', form.category)
      if (file) fd.append('image', file)

      const res = await submitReport(fd)
      if (res.ok) {
        setMsg('제보가 접수되었습니다! 감사합니다.')
        setForm({ shop_name: '', url: '', idol: '', category: '온라인몰' })
        setFile(null)
      } else {
        setMsg(res.message || '제보 실패')
      }
    } catch (err) {
      setMsg('제보 실패: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="report-page">
      <header className="top-nav">
        <div className="top-nav-inner">
          <a href="#main" className="logo">굿즈모아</a>
          <span className="page-title">쇼핑몰 제보하기</span>
        </div>
      </header>

      <div className="report-container">
        <h2>새 쇼핑몰 제보</h2>
        <p className="report-desc">아이돌 굿즈를 판매하는 쇼핑몰을 알려주세요! 관리자 승인 후 반영됩니다.</p>

        {msg && <div className={`msg ${msg.includes('접수') ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}

        <form onSubmit={handleSubmit} className="report-form">
          <label>
            쇼핑몰명 *
            <input
              type="text"
              value={form.shop_name}
              onChange={e => setForm({ ...form, shop_name: e.target.value })}
              placeholder="예: 위버스샵"
            />
          </label>

          <label>
            URL *
            <input
              type="url"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </label>

          <label>
            아이돌 *
            <select value={form.idol} onChange={e => setForm({ ...form, idol: e.target.value })}>
              <option value="">선택하세요</option>
              {idols.map(i => (
                <option key={i.id} value={i.name}>{i.name}</option>
              ))}
            </select>
          </label>

          <label>
            카테고리
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            배너 이미지 (728x90 권장)
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
          </label>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '제보 중...' : '제보하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
