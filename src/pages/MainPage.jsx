import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import BannerList from '../components/BannerList'
import InfoPanel from '../components/InfoPanel'
import TopNav from '../components/TopNav'
import { getBanners, getIdols, getRecentBanners } from '../api'

export default function MainPage({ categories }) {
  const [idols, setIdols] = useState([])
  const [banners, setBanners] = useState([])
  const [recentBanners, setRecentBanners] = useState([])
  const [selectedIdol, setSelectedIdol] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [selectedIdolInfo, setSelectedIdolInfo] = useState(null)

  useEffect(() => {
    getIdols().then(setIdols).catch(console.error)
    getRecentBanners().then(setRecentBanners).catch(console.error)
  }, [])

  useEffect(() => {
    getBanners(selectedIdol, selectedCategory)
      .then(setBanners)
      .catch(console.error)
  }, [selectedIdol, selectedCategory])

  useEffect(() => {
    if (selectedIdol) {
      const idol = idols.find(i => i.name === selectedIdol)
      setSelectedIdolInfo(idol || null)
    } else {
      setSelectedIdolInfo(null)
    }
  }, [selectedIdol, idols])

  return (
    <div className="layout">
      <TopNav
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <div className="content">
        <Sidebar
          idols={idols}
          selected={selectedIdol}
          onSelect={(name) => setSelectedIdol(name === selectedIdol ? null : name)}
        />
        <main className="main">
          <div className="main-header">
            <h2>
              {selectedIdol || '전체'} {selectedCategory !== '전체' ? `> ${selectedCategory}` : ''} 배너
            </h2>
            <span className="banner-count">{banners.length}개</span>
          </div>
          {banners.length === 0 ? (
            <div className="empty">등록된 배너가 없습니다.</div>
          ) : (
            <BannerList banners={banners} />
          )}
        </main>
        <InfoPanel idol={selectedIdolInfo} recent={recentBanners} />
      </div>
    </div>
  )
}
