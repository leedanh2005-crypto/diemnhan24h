// d:\ý tưởng kd\shipper-app\src\App.jsx
import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [trackingCode, setTrackingCode] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [submitStatus, setSubmitStatus] = useState(null) // 'loading', 'success', 'error'
  const [cameraError, setCameraError] = useState('')
  
  const scannerRef = useRef(null)
  const lastScannedRef = useRef('') // Debounce: tránh quét trùng liên tục

  // Khởi tạo Camera thủ công (không dùng Scanner UI mặc định)
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader")
    scannerRef.current = html5QrCode

    html5QrCode.start(
      { facingMode: "environment" }, // Camera sau
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
      },
      (decodedText) => {
        // Debounce: bỏ qua nếu vừa quét mã này trong 3 giây trước
        if (decodedText === lastScannedRef.current) return
        lastScannedRef.current = decodedText

        // Lưu mã vận đơn
        setTrackingCode(decodedText)
        playBeep()

        // Reset debounce sau 3 giây
        setTimeout(() => { lastScannedRef.current = '' }, 3000)
      },
      () => {} // Lỗi quét liên tục - bỏ qua
    ).catch((err) => {
      console.error("Camera error:", err)
      setCameraError("Không thể mở Camera. Hãy cho phép quyền Camera trong trình duyệt.")
    })

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const playBeep = () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 800
      oscillator.connect(context.destination)
      oscillator.start()
      setTimeout(() => { oscillator.stop(); context.close() }, 150)
    } catch(e) {
      // Fallback: vibrate nếu có
      if (navigator.vibrate) navigator.vibrate(100)
    }
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

  // Submit Data lên Supabase
  const handleSubmit = async () => {
    if (!trackingCode || !roomNumber) return
    
    setSubmitStatus('loading')
    
    try {
      const { error: insertError } = await supabase
        .from('packages')
        .insert([
          { 
            tracking_code: trackingCode, 
            room_number: roomNumber, 
            status: 'WAITING_FOR_PICKUP'
          }
        ])

      if (insertError) throw insertError

      // Thành công!
      setSubmitStatus('success')
      playBeep()
      
      // Reset form sau 1.5 giây để quét kiện tiếp theo
      setTimeout(() => {
        setTrackingCode('')
        setRoomNumber('')
        setSubmitStatus(null)
      }, 1500)

    } catch (error) {
      console.error(error)
      setSubmitStatus('error')
      setTimeout(() => setSubmitStatus(null), 2000)
    }
  }

  const isReadyToSubmit = trackingCode !== '' && roomNumber !== ''

  return (
    <div className="app-container">
      {/* 1. Camera Section */}
      <div className="camera-section">
        <div id="reader"></div>
        {cameraError ? (
          <div className="camera-error">{cameraError}</div>
        ) : (
          <div className="camera-overlay">
            📷 CAMERA ĐANG BẬT
          </div>
        )}
      </div>

      {/* 2. Info Section */}
      <div className="info-section">
        <div className="info-row">
          <span className="info-label">📦 MÃ VẬN ĐƠN</span>
          <span className={`info-value ${trackingCode ? 'value-ok' : 'value-missing'}`}>
            {trackingCode || 'Chờ quét mã vạch...'}
          </span>
        </div>
        
        <div className="info-row">
          <span className="info-label">🏠 SỐ PHÒNG</span>
          <span className={`info-value ${roomNumber ? 'value-ok' : 'value-missing'}`}>
            {roomNumber || 'Gõ bên dưới...'}
          </span>
        </div>
      </div>

      {/* 3. Numpad Section */}
      <div className="numpad-section">
        <div className="numpad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} className="num-btn" onClick={() => handleNumClick(num.toString())}>
              {num}
            </button>
          ))}
          <button className="num-btn letter" onClick={() => handleNumClick('A')}>A</button>
          <button className="num-btn" onClick={() => handleNumClick('0')}>0</button>
          <button className="num-btn delete" onClick={handleDelete}>⌫</button>
        </div>
        
        <button 
          className={`submit-btn ${isReadyToSubmit ? 'active' : ''} ${submitStatus === 'loading' ? 'loading' : ''}`}
          onClick={handleSubmit}
          disabled={!isReadyToSubmit || submitStatus === 'loading'}
        >
          {submitStatus === 'loading' ? '⏳ ĐANG GỬI...' : '✅ XÁC NHẬN GỬI KHO'}
        </button>
      </div>

      {/* Success Overlay */}
      {submitStatus === 'success' && (
        <div className="status-overlay success">
          <div className="status-icon">✅</div>
          <div className="status-text">ĐÃ VÀO KHO THÀNH CÔNG!</div>
        </div>
      )}

      {/* Error Overlay */}
      {submitStatus === 'error' && (
        <div className="status-overlay error">
          <div className="status-icon">❌</div>
          <div className="status-text">LỖI! THỬ LẠI SAU.</div>
        </div>
      )}
    </div>
  )
}

export default App
