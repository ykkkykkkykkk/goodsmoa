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
          aria-label={`${banner.shop_name} - ${banner.idol} ${banner.category}`}
        >
          <div className="banner-image-wrap">
            {banner.image_url ? (
              <img
                src={banner.image_url}
                alt={banner.shop_name}
                className="banner-image"
                loading="lazy"
              />
            ) : (
              <div className="banner-placeholder">
                <span>{banner.shop_name}</span>
              </div>
            )}
          </div>
          <div className="banner-info">
            <span className="banner-shop">{banner.shop_name}</span>
            <span className="banner-tags">
              <span className="tag tag-idol">{banner.idol}</span>
              <span className="tag tag-cat">{banner.category}</span>
            </span>
          </div>
        </a>
      ))}
    </div>
  )
}
