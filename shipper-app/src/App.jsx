// d:\ý tưởng kd\shipper-app\src\App.jsx
import React, { useState, useEffect } from 'react'
import { HeaderTabs } from './components/HeaderTabs'
import { ShipperMode } from './components/ShipperMode'
import { KioskMode } from './components/KioskMode'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('picko_active_mode')
      return (saved === 'kiosk' || saved === 'shipper') ? saved : 'shipper'
    } catch {
      return 'shipper'
    }
  })

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSwitching, setIsSwitching] = useState(false)

  // Lưu lựa chọn tab
  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return
    setIsSwitching(true)
    setActiveTab(newTab)
    try {
      localStorage.setItem('picko_active_mode', newTab)
    } catch {}

    // 150ms buffer để camera cũ dừng hoàn toàn trước khi component mới mount
    setTimeout(() => {
      setIsSwitching(false)
    }, 150)
  }

  // Lắng nghe trạng thái mạng
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Phím tắt bàn phím (Alt + 1: Shipper, Alt + 2: Kiosk)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === '1') {
        handleTabChange('shipper')
      } else if (e.key === '2') {
        handleTabChange('kiosk')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab])

  return (
    <div className={`app-root theme-${activeTab}`}>
      {/* Header & Tab Bar Navigation */}
      <HeaderTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isOnline={isOnline}
      />

      {/* Main Mode View */}
      <main className="app-main-content">
        {isSwitching ? (
          <div className="tab-transition-loader">
            <span className="spinner"></span>
            <p>Đang chuyển chế độ...</p>
          </div>
        ) : activeTab === 'shipper' ? (
          <ShipperMode key="shipper-mode-instance" />
        ) : (
          <KioskMode key="kiosk-mode-instance" />
        )}
      </main>

      {/* Footer Info Pill */}
      <footer className="app-footer">
        <span className="footer-tip">
          {activeTab === 'shipper'
            ? '💡 Chế độ Shipper: Quét barcode & nhập số căn hộ để lưu kho'
            : '💡 Chế độ Kiosk: Cư dân đưa mã QR nhận hàng vào camera'}
        </span>
      </footer>
    </div>
  )
}

export default App
