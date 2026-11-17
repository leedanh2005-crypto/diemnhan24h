// d:\ý tưởng kd\shipper-app\src\components\HeaderTabs.jsx
import React from 'react'

export function HeaderTabs({ activeTab, onTabChange, isOnline }) {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand-group">
          <div className="brand-icon">
            <img src="/podo-icon.png" alt="PODO" className="brand-logo-img" />
          </div>
          <div className="brand-text">
            <span className="brand-title">PODO STATION</span>
            <span className="brand-sub">Hệ thống Trạm Thông Minh</span>
          </div>
        </div>

        <div className="status-indicator">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
          <span className="status-label">{isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}</span>
        </div>
      </div>

      <nav className="tab-bar-container" aria-label="Chế độ làm việc">
        <div className="tab-pill-track">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'shipper' ? 'active shipper-theme' : ''}`}
            onClick={() => onTabChange('shipper')}
            aria-selected={activeTab === 'shipper'}
          >
            <span className="tab-icon">🚚</span>
            <span className="tab-title">SHIPPER</span>
            <span className="tab-badge">Nhập Kho</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'kiosk' ? 'active kiosk-theme' : ''}`}
            onClick={() => onTabChange('kiosk')}
            aria-selected={activeTab === 'kiosk'}
          >
            <span className="tab-icon">🏪</span>
            <span className="tab-title">KIOSK</span>
            <span className="tab-badge">Lấy Hàng</span>
          </button>
        </div>
      </nav>
    </header>
  )
}
