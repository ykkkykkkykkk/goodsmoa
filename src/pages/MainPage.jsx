import React, { useState, useEffect, useContext } from 'react'
import Sidebar from '../components/Sidebar'
import BannerList from '../components/BannerList'
import TopNav from '../components/TopNav'
import { getBanners, getIdols } from '../api'
import { UserContext } from '../App'

export default function MainPage({ categories }) {
  const { user, setUser } = useContext(UserContext)
  const [idols, setIdols] = useState([])
  const [banners, setBanners] = useState([])
  const [selectedIdol, setSelectedIdol] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('전체')
  const [selectedIdolInfo, setSelectedIdolInfo] = useState(null)

  useEffect(() => {
    getIdols().then(setIdols).catch(console.error)
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
        user={user}
        onUserChange={setUser}
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
      </div>
    </div>
  )
}
