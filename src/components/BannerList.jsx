import React from 'react'

export default function BannerList({ banners }) {
  return (
    <div className="banner-list" role="list" aria-label="쇼핑몰 배너 목록">
      {banners.map(banner => (
        <a
          key={banner.id}
          href={banner.url}
          target="_blank"
          rel="noopener noreferrer"
          className="banner-card"
          role="listitem"
          aria-label={banner.shop_name}
        >
          <div className="banner-image-wrap">
            {banner.image_url ? (
              <img
                src={banner.image_url}
                alt=""
                className="banner-image"
                loading="lazy"
                onError={e => { e.target.style.display = 'none' }}
              />
            ) : null}
          </div>
        </a>
      ))}
    </div>
  )
}
