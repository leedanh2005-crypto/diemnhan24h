// d:\ý tưởng kd\shipper-app\src\components\ShipperMode.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../supabaseClient'
import { playBeep } from '../utils/audio'

export function ShipperMode() {
  const [trackingCode, setTrackingCode] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [submitStatus, setSubmitStatus] = useState(null) // 'loading' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [facingMode, setFacingMode] = useState('environment') // 'environment' | 'user'
  const [isManualInput, setIsManualInput] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [recentScans, setRecentScans] = useState(() => {
    try {
      const saved = sessionStorage.getItem('picko_shipper_recent')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showHistory, setShowHistory] = useState(false)

  const scannerRef = useRef(null)
  const lastScannedRef = useRef('')
  const isMountedRef = useRef(true)

  // Khởi tạo camera
  useEffect(() => {
    isMountedRef.current = true
    let isCleaningUp = false

    const initScanner = async () => {
      // Dừng scanner cũ nếu có
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop()
          }
          await scannerRef.current.clear()
        } catch (e) {
          console.warn('Lỗi dọn dẹp camera cũ:', e)
        }
      }

      if (isCleaningUp || !isMountedRef.current) return

      try {
        const html5QrCode = new Html5Qrcode('shipper-reader')
        scannerRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode },
          {
            fps: 15,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.35
          },
          (decodedText) => {
            if (!isMountedRef.current) return
            const cleanText = decodedText.trim()
            if (cleanText === lastScannedRef.current) return

            lastScannedRef.current = cleanText
            setTrackingCode(cleanText)
            playBeep('success')

            // Gợi ý số phòng nếu đơn đã có sẵn trong hệ thống (như đơn Shopee kết nối)
            supabase
              .from('packages')
              .select('"Số căn hộ"')
              .eq('Mã vận đơn', cleanText)
              .maybeSingle()
              .then(({ data }) => {
                if (data && data["Số căn hộ"]) {
                  setRoomNumber(data["Số căn hộ"])
                }
              })
              .catch(() => {})

            // Reset debounce sau 3 giây
            setTimeout(() => {
              if (lastScannedRef.current === cleanText) {
                lastScannedRef.current = ''
              }
            }, 3000)
          },
          () => {} // Bỏ qua lỗi lặp mỗi frame
        )
        setCameraError('')
      } catch (err) {
        console.error('Camera error:', err)
        if (isMountedRef.current) {
          setCameraError('Không thể mở Camera. Vui lòng cấp quyền hoặc đổi camera.')
        }
      }
    }

    // Delay nhỏ để DOM render xong element #shipper-reader
    const timer = setTimeout(() => {
      initScanner()
    }, 100)

    return () => {
      isCleaningUp = true
      isMountedRef.current = false
      clearTimeout(timer)
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {})
          }
          scannerRef.current.clear().catch(() => {})
        } catch (e) {}
      }
    }
  }, [facingMode])

  // Đổi Camera trước / sau
  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  // Numpad handlers
  const handleNumClick = (val) => {
    if (roomNumber.length < 8) {
      setRoomNumber(prev => prev + val)
    }
  }

  const handleDelete = () => {
    setRoomNumber(prev => prev.slice(0, -1))
  }

  const handleClearRoom = () => {
    setRoomNumber('')
  }

  // Xử lý nhập tay mã vận đơn
  const handleApplyManualCode = (e) => {
    e.preventDefault()
    if (manualCode.trim()) {
      const code = manualCode.trim().toUpperCase()
      setTrackingCode(code)
      setIsManualInput(false)
      setManualCode('')
      playBeep('confirm')

      // Kiểm tra và gợi ý số phòng
      supabase
        .from('packages')
        .select('"Số căn hộ"')
        .eq('Mã vận đơn', code)
        .maybeSingle()
        .then(({ data }) => {
          if (data && data["Số căn hộ"]) {
            setRoomNumber(data["Số căn hộ"])
          }
        })
        .catch(() => {})
    }
  }

  // Submit data lên Supabase
  const handleSubmit = async () => {
    const code = trackingCode.trim()
    const room = roomNumber.trim()
    if (!code || !room) return

    setSubmitStatus('loading')
    setStatusMessage('Đang nạp kiện hàng vào hệ thống...')

    try {
      // 1. Kiểm tra đơn hàng có sẵn trong hệ thống (như đơn Shopee kết nối)
      const { data: existingList } = await supabase
        .from('packages')
        .select('id, "Mã vận đơn"')
        .eq('Mã vận đơn', code)
        .limit(1)

      if (existingList && existingList.length > 0) {
        // Cập nhật trạng thái thành Đã đến trạm
        const { error: updateError } = await supabase
          .from('packages')
          .update({
            "Số căn hộ": room,
            "Trạng thái tại trạm PICKO": 'Hàng đã được giao đến trạm',
            "Cập nhật gần nhất": new Date().toISOString()
          })
          .eq('id', existingList[0].id)

        if (updateError) throw updateError
      } else {
        // Tạo mới kiện hàng nếu chưa có
        const { error: insertError } = await supabase
          .from('packages')
          .insert([
            {
              "Mã vận đơn": code,
              "Số căn hộ": room,
              "Trạng thái tại trạm PICKO": 'Hàng đã được giao đến trạm',
              "Trạng thái đơn trên sàn": 'Đang giao'
            }
          ])

        if (insertError) throw insertError
      }

      // Thành công!
      playBeep('success')
      setSubmitStatus('success')
      setStatusMessage(`Đã gửi vào tủ căn hộ ${room}`)

      // Thêm vào lịch sử gần đây
      const newScanItem = {
        id: Date.now(),
        code: code,
        room: room,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
      setRecentScans(prev => {
        const updated = [newScanItem, ...prev.slice(0, 19)]
        try {
          sessionStorage.setItem('picko_shipper_recent', JSON.stringify(updated))
        } catch {}
        return updated
      })

      // Reset form sau 1.2 giây
      setTimeout(() => {
        if (isMountedRef.current) {
          setTrackingCode('')
          setRoomNumber('')
          setSubmitStatus(null)
          setStatusMessage('')
        }
      }, 1200)

    } catch (error) {
      console.error('Lỗi insert package:', error)
      playBeep('error')
      setSubmitStatus('error')
      setStatusMessage(error.message || 'Lỗi kết nối máy chủ!')
      setTimeout(() => {
        if (isMountedRef.current) {
          setSubmitStatus(null)
          setStatusMessage('')
        }
      }, 2500)
    }
  }

  const isReadyToSubmit = Boolean(trackingCode.trim() && roomNumber.trim())

  return (
    <div className="mode-view shipper-view">
      {/* 1. Camera Section: Khung viền Tablet màu trắng sang trọng */}
      <section className="tablet-camera-enclosure shipper-tablet">
        {/* Bezel trên: Cảm biến & Ống kính trước của máy tính bảng */}
        <div className="tablet-bezel-top">
          <span className="tablet-sensor-dot" title="Cảm biến ánh sáng"></span>
          <span className="tablet-lens-dot" title="Ống kính Camera trước"></span>
          <span className="tablet-mic-hole" title="Micro thu âm"></span>
        </div>

        {/* Khung viền màn hình tablet */}
        <div className="tablet-screen-bezel">
          <div className="camera-wrapper">
            <div id="shipper-reader"></div>

            {/* Các ô công cụ màu trắng sang trọng kiểu Tablet Camera */}
            <div className="tablet-floating-hud">
              <div className="tablet-hud-top">
                <div className="luxury-white-badge">
                  <span className="live-dot-green"></span>
                  <span className="badge-title">MÁY QUÉT BARCODE</span>
                </div>
                <div className="tablet-hud-actions">
                  <button
                    type="button"
                    className="luxury-white-btn"
                    onClick={toggleCamera}
                    title="Đổi camera trước/sau"
                  >
                    🔄 <span className="btn-label">{facingMode === 'environment' ? 'Cam sau' : 'Cam trước'}</span>
                  </button>
                  <button
                    type="button"
                    className="luxury-white-btn"
                    onClick={() => setIsManualInput(true)}
                    title="Nhập mã vận đơn bằng tay"
                  >
                    ✏️ <span className="btn-label">Nhập tay</span>
                  </button>
                </div>
              </div>

              {cameraError && (
                <div className="camera-alert">
                  <p>⚠️ {cameraError}</p>
                  <button
                    className="retry-cam-btn"
                    onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                  >
                    Thử lại Camera
                  </button>
                </div>
              )}

              {/* Khung ngắm vạch trắng Pro sắc nét */}
              <div className="tablet-viewfinder-brackets">
                <span className="vf-corner vf-tl"></span>
                <span className="vf-corner vf-tr"></span>
                <span className="vf-corner vf-bl"></span>
                <span className="vf-corner vf-br"></span>
                <div className="scan-aim-line"></div>
              </div>

              {/* Ô chip thông tin ở đáy khung ngắm */}
              <div className="tablet-hud-bottom">
                <span className="tablet-mode-chip">TỰ ĐỘNG NHẬN DIỆN MÃ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bezel dưới: Thanh Home indicator phong cách iPad */}
        <div className="tablet-bezel-bottom">
          <div className="tablet-home-indicator"></div>
        </div>
      </section>

      {/* 2. Info Cards */}
      <section className="info-cards-row">
        {/* Card Mã vận đơn */}
        <div className={`data-card ${trackingCode ? 'card-has-value' : 'card-waiting'}`}>
          <div className="data-card-header">
            <span className="data-label">📦 MÃ VẬN ĐƠN</span>
            <div className="data-actions">
              {trackingCode ? (
                <button
                  type="button"
                  className="icon-mini-btn"
                  onClick={() => setTrackingCode('')}
                  title="Xóa mã"
                >
                  ✕
                </button>
              ) : (
                <button
                  type="button"
                  className="text-mini-btn"
                  onClick={() => setIsManualInput(true)}
                >
                  ✏️ Nhập tay
                </button>
              )}
            </div>
          </div>
          <div className="data-display tracking-display">
            {trackingCode ? (
              <span className="code-text">{trackingCode}</span>
            ) : (
              <span className="placeholder-text">Đang chờ quét barcode...</span>
            )}
          </div>
        </div>

        {/* Card Số căn hộ */}
        <div className={`data-card ${roomNumber ? 'card-has-value' : 'card-waiting'}`}>
          <div className="data-card-header">
            <span className="data-label">🏠 SỐ CĂN HỘ</span>
            {roomNumber && (
              <button
                type="button"
                className="icon-mini-btn"
                onClick={handleClearRoom}
                title="Xóa số phòng"
              >
                ✕
              </button>
            )}
          </div>
          <div className="data-display room-display">
            {roomNumber ? (
              <span className="room-text">{roomNumber}</span>
            ) : (
              <span className="placeholder-text">Bấm số phòng bên dưới...</span>
            )}
          </div>
        </div>
      </section>

      {/* 3. Numpad Section */}
      <section className="numpad-wrapper">
        <div className="numpad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              type="button"
              className="num-btn"
              onClick={() => handleNumClick(num.toString())}
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            className="num-btn letter-btn"
            onClick={() => handleNumClick('A')}
          >
            A
          </button>
          <button
            type="button"
            className="num-btn"
            onClick={() => handleNumClick('0')}
          >
            0
          </button>
          <button
            type="button"
            className="num-btn delete-btn"
            onClick={handleDelete}
            title="Xóa 1 ký tự"
          >
            ⌫
          </button>
        </div>

        {/* Nút Submit */}
        <button
          type="button"
          className={`submit-btn ${isReadyToSubmit ? 'ready' : ''} ${submitStatus === 'loading' ? 'loading' : ''}`}
          onClick={handleSubmit}
          disabled={!isReadyToSubmit || submitStatus === 'loading'}
        >
          {submitStatus === 'loading' ? (
            <span className="spinner-wrap">
              <span className="spinner"></span> ĐANG LƯU VÀO KHO...
            </span>
          ) : (
            <span>✅ XÁC NHẬN GỬI KHO</span>
          )}
        </button>

        {/* Thanh công cụ phụ: Xem lịch sử gần đây */}
        <div className="session-bar">
          <span className="session-count">
            Đã nhập: <strong>{recentScans.length}</strong> kiện trong phiên
          </span>
          {recentScans.length > 0 && (
            <button
              type="button"
              className="history-toggle-btn"
              onClick={() => setShowHistory(prev => !prev)}
            >
              {showHistory ? 'Ẩn lịch sử ▲' : 'Xem gần đây ▼'}
            </button>
          )}
        </div>

        {/* Danh sách các đơn vừa quét */}
        {showHistory && recentScans.length > 0 && (
          <div className="recent-list-dropdown">
            <div className="recent-list-title">Đơn hàng vừa quét gần nhất:</div>
            <div className="recent-items-scroll">
              {recentScans.slice(0, 5).map(item => (
                <div key={item.id} className="recent-item">
                  <div className="recent-item-main">
                    <span className="recent-room">Phòng {item.room}</span>
                    <span className="recent-code">{item.code}</span>
                  </div>
                  <span className="recent-time">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Modal Nhập tay mã vận đơn */}
      {isManualInput && (
        <div className="modal-backdrop">
          <div className="manual-modal">
            <div className="modal-header">
              <h3>✏️ Nhập tay mã vận đơn</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsManualInput(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleApplyManualCode}>
              <p className="modal-desc">
                Dùng khi mã vạch bị rách hoặc camera không đọc được:
              </p>
              <input
                type="text"
                className="modal-input"
                placeholder="VD: SPX12345678VN, VNPOST..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                autoFocus
              />
              <div className="modal-buttons">
                <button
                  type="button"
                  className="modal-btn secondary"
                  onClick={() => setIsManualInput(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="modal-btn primary"
                  disabled={!manualCode.trim()}
                >
                  Áp dụng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast / Status Overlay */}
      {submitStatus === 'success' && (
        <div className="status-popup success">
          <div className="popup-icon">✅</div>
          <div className="popup-title">ĐÃ VÀO KHO THÀNH CÔNG!</div>
          <div className="popup-desc">{statusMessage}</div>
        </div>
      )}

      {submitStatus === 'error' && (
        <div className="status-popup error">
          <div className="popup-icon">❌</div>
          <div className="popup-title">LỖI XÁC NHẬN!</div>
          <div className="popup-desc">{statusMessage}</div>
        </div>
      )}
    </div>
  )
}
