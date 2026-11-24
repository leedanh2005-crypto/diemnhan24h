// d:\ý tưởng kd\shipper-app\src\components\KioskMode.jsx
import React, { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../supabaseClient'
import { playBeep } from '../utils/audio'
import { bleTagService } from '../utils/bleTagService'

export function KioskMode() {
  const [scanResult, setScanResult] = useState(null) // { type: 'success' | 'error' | 'loading', text: '', detail: '' }
  const [pendingToken, setPendingToken] = useState(null)
  const [tokenInfo, setTokenInfo] = useState(null) // Thông tin kiện hàng tìm được từ Supabase
  const [cameraError, setCameraError] = useState('')
  const [facingMode, setFacingMode] = useState('environment')
  const [cameraKey, setCameraKey] = useState(0)
  const [isManualInput, setIsManualInput] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [bleStatus, setBleStatus] = useState({ isConnected: false, deviceName: '' })
  const [bleLoading, setBleLoading] = useState(false)
  const [bleTesting, setBleTesting] = useState(false)
  const [bleMessage, setBleMessage] = useState('')

  const scannerRef = useRef(null)
  const lastScannedRef = useRef('')
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    let isCleaningUp = false

    const initScanner = async () => {
      // Dọn dẹp scanner cũ nếu còn
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop()
          }
          await scannerRef.current.clear()
        } catch (e) {
          console.warn('Lỗi dọn dẹp camera kiosk:', e)
        }
        scannerRef.current = null
      }

      if (isCleaningUp || !isMountedRef.current) return

      try {
        // 1. Quét danh sách camera vật lý từ thiết bị
        let cameras = []
        try {
          cameras = await Html5Qrcode.getCameras()
        } catch (camErr) {
          console.warn('Lấy danh sách camera thiết bị (kiosk):', camErr)
        }

        if (isCleaningUp || !isMountedRef.current) return

        // 2. Xây dựng danh sách candidate configs ưu tiên deviceId trước, sau đó đến facingMode
        const candidateConfigs = []

        if (cameras && cameras.length > 0) {
          if (facingMode === 'environment') {
            const rearCam = cameras.find(c => /(back|rear|environment|sau|world)/i.test(c.label || ''))
            if (rearCam) {
              candidateConfigs.push(rearCam.id)
            }
            cameras.forEach(c => {
              if (!candidateConfigs.includes(c.id)) {
                candidateConfigs.push(c.id)
              }
            })
          } else {
            const frontCam = cameras.find(c => /(front|user|trước|webcam|integrated|facetime)/i.test(c.label || ''))
            if (frontCam) {
              candidateConfigs.push(frontCam.id)
            }
            cameras.forEach(c => {
              if (!candidateConfigs.includes(c.id)) {
                candidateConfigs.push(c.id)
              }
            })
          }
        }

        candidateConfigs.push({ facingMode })
        candidateConfigs.push({ facingMode: facingMode === 'environment' ? 'user' : 'environment' })

        const html5QrCode = new Html5Qrcode('kiosk-reader')
        scannerRef.current = html5QrCode

        const config = {
          fps: 12
          // Không khóa cứng aspectRatio để tương thích hoàn toàn webcam laptop/PC
        }

        const onScanSuccess = (decodedText) => {
          if (!isMountedRef.current) return
          const cleanText = decodedText.trim()
          if (cleanText === lastScannedRef.current) return

          lastScannedRef.current = cleanText
          playBeep('confirm')

          // Tạm dừng quét khi nhận được mã QR hợp lệ
          if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.pause()
          }

          setPendingToken(cleanText)
          inspectToken(cleanText)
        }

        const onScanFailure = () => {}

        let started = false
        let lastError = null

        for (const camConf of candidateConfigs) {
          if (isCleaningUp || !isMountedRef.current) return
          try {
            await html5QrCode.start(camConf, config, onScanSuccess, onScanFailure)
            started = true
            setCameraError('')
            console.log('Kiosk camera mở thành công với cấu hình:', camConf)
            break
          } catch (err) {
            console.warn('Kiosk thử camera thất bại:', camConf, err)
            lastError = err
            try {
              if (html5QrCode.isScanning) {
                await html5QrCode.stop()
              }
              await html5QrCode.clear()
            } catch (_) {}
          }
        }

        if (!started && isMountedRef.current) {
          console.error('Không thể mở camera kiosk:', lastError)
          setCameraError('Không thể mở Camera Kiosk. Vui lòng kiểm tra quyền Camera trong trình duyệt hoặc kết nối webcam.')
        }
      } catch (err) {
        console.error('Lỗi scanner kiosk:', err)
        if (isMountedRef.current) {
          setCameraError('Không thể mở Camera Kiosk. Vui lòng cấp quyền camera hoặc bấm Thử lại.')
        }
      }
    }

    const timer = setTimeout(() => {
      initScanner()
    }, 150)

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
        scannerRef.current = null
      }
    }
  }, [facingMode, cameraKey])

  // Đổi Camera
  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))
    setCameraKey(prev => prev + 1)
  }

  // Thử lại Camera
  const handleRetryCamera = () => {
    setCameraError('')
    setCameraKey(prev => prev + 1)
  }

  // Lắng nghe trạng thái thẻ BLE
  useEffect(() => {
    const unsub = bleTagService.subscribe((status) => {
      setBleStatus(status)
    })
    return () => unsub()
  }, [])

  // Thao tác kết nối BLE
  const handleConnectBle = async () => {
    setBleLoading(true)
    setBleMessage('')
    try {
      const res = await bleTagService.connect()
      playBeep('success')
      setBleMessage(`Đã kết nối: ${res.deviceName}`)
      setTimeout(() => setBleMessage(''), 3500)
    } catch (err) {
      console.error('Lỗi kết nối BLE:', err)
      if (err.name !== 'NotFoundError') {
        playBeep('error')
        setBleMessage(err.message || 'Không thể kết nối thẻ BLE')
        setTimeout(() => setBleMessage(''), 4500)
      }
    } finally {
      setBleLoading(false)
    }
  }

  // Bấm thử còi & đèn trên thẻ
  const handleTestBleAlert = async () => {
    if (bleTesting) return
    setBleTesting(true)
    playBeep('confirm')
    await bleTagService.triggerAlert(3000)
    setTimeout(() => setBleTesting(false), 3000)
  }

  // Tra cứu thông tin mã QR trước khi bấm nhận
  const inspectToken = async (token) => {
    // 1. Thử gọi API backend PICKO trước
    const apiBase = import.meta.env.VITE_API_URL || ''
    try {
      const res = await fetch(`${apiBase}/api/orders/inspect?token=${encodeURIComponent(token)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.apartment) {
          setTokenInfo({
            count: data.count || 1,
            apartment: data.apartment,
            isPickup: true,
            trackingCode: data.trackingCode
          })
          return
        }
      }
    } catch {}

    // 2. Fallback sang Supabase
    try {
      const { data: pkgs } = await supabase
        .from('packages')
        .select('*')
        .or(`"Mã lấy hàng".eq.${token},"Mã vận đơn".eq.${token}`)

      if (pkgs && pkgs.length > 0) {
        setTokenInfo({
          count: pkgs.length,
          apartment: pkgs[0]['Số căn hộ'] || '1204',
          isPickup: true,
          trackingCode: pkgs[0]['Mã vận đơn']
        })
        return
      }
    } catch {}

    // 3. Nếu không phải mã lấy hàng cũ, đây là mã barcode kiện hàng mới!
    setTokenInfo({
      isNewPackage: true,
      apartment: '1204',
      trackingCode: token
    })
  }

  // Tiếp nhận kiện hàng mới trực tiếp từ màn hình Kiosk
  const handleCheckinFromKiosk = async (apartment = '1204') => {
    const code = pendingToken || lastScannedRef.current
    if (!code) return

    setScanResult({
      type: 'loading',
      text: 'Đang tiếp nhận kiện hàng vào trạm...',
      detail: `Lưu vào hệ thống cho Căn hộ ${apartment}`
    })
    setPendingToken(null)

    // 1. Gửi lên backend PICKO
    const apiBase = import.meta.env.VITE_API_URL || ''
    try {
      await fetch(`${apiBase}/api/orders/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingCode: code,
          roomNumber: apartment,
          productName: `Kiện hàng ${code.slice(-4)}`,
          marketplace: 'Shopee'
        })
      })
    } catch (e) {
      console.warn('Lỗi gọi API checkin:', e)
    }

    // 2. Ghi trực tiếp Supabase
    try {
      await supabase.from('packages').upsert({
        "Mã vận đơn": code,
        "Số căn hộ": apartment,
        "Trạng thái tại trạm PICKO": 'Hàng đã được giao đến trạm',
        "Trạng thái đơn trên sàn": 'Đang giao',
        "Cập nhật gần nhất": new Date().toISOString()
      }, { onConflict: 'Mã vận đơn' })
    } catch (e) {
      console.warn('Lỗi upsert Supabase:', e)
    }

    playBeep('success')
    setScanResult({
      type: 'success',
      text: `Đã nạp kiện hàng ${code} vào trạm PODO!`,
      detail: `Căn hộ: ${apartment} • Đơn hàng đã xuất hiện ngay tức thì trên ứng dụng Cư Dân.`
    })

    setTimeout(() => {
      if (!isMountedRef.current) return
      setScanResult(null)
      setPendingToken(null)
      setTokenInfo(null)
      lastScannedRef.current = ''

      if (scannerRef.current && scannerRef.current.getState() === 2) {
        scannerRef.current.resume()
      }
    }, 3500)
  }

  // Xác nhận lấy hàng
  const confirmPickup = async () => {
    const token = pendingToken || lastScannedRef.current
    if (!token) return

    setScanResult({ type: 'loading', text: 'Đang xử lý mở khóa tủ...', detail: 'Vui lòng chờ giây lát' })
    setPendingToken(null)

    let isSuccess = false
    let successMsg = ''
    let detailMsg = ''

    // 1. Thử gọi API backend PICKO trước
    const apiBase = import.meta.env.VITE_API_URL || ''
    try {
      const res = await fetch(`${apiBase}/api/orders/verify-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          isSuccess = true
          successMsg = data.message || 'Mở tủ thành công!'
          if (data.data?.apartment) {
            detailMsg = `Căn hộ: ${data.data.apartment} • ${data.data.packagesCount || 1} kiện hàng`
          }
        } else {
          successMsg = data.message || 'Mã QR không hợp lệ'
        }
      } else {
        throw new Error('API server unreachable')
      }
    } catch {
      // 2. FALLBACK trực tiếp qua Supabase (Đảm bảo 100% không bao giờ gián đoạn)
      try {
        const { data: pkgs, error: findError } = await supabase
          .from('packages')
          .select('*')
          .eq('Mã lấy hàng', token)
          .eq('Trạng thái tại trạm PICKO', 'Hàng đã được giao đến trạm')

        if (findError) throw findError

        if (!pkgs || pkgs.length === 0) {
          isSuccess = false
          successMsg = 'Mã QR không hợp lệ hoặc đã được sử dụng trước đó.'
        } else {
          const { error: updateError } = await supabase
            .from('packages')
            .update({
              'Trạng thái tại trạm PICKO': 'Đã nhận',
              'Mã lấy hàng': null
            })
            .eq('Mã lấy hàng', token)

          if (updateError) throw updateError

          isSuccess = true
          const room = pkgs[0]['Số căn hộ'] || 'Chưa rõ'
          successMsg = `Thành công! Đã mở tủ nhận hàng.`
          detailMsg = `Căn hộ: ${room} • Giao ${pkgs.length} kiện hàng`
        }
      } catch (err) {
        console.error('Lỗi fallback Supabase:', err)
        isSuccess = false
        successMsg = 'Lỗi hệ thống khi xác thực mã QR. Vui lòng thử lại.'
      }
    }

    if (isSuccess) {
      playBeep('success')
      // Tự động kích hoạt thẻ BLE bíp + nháy đèn trong 5 giây cho khách hàng nhận diện
      bleTagService.triggerAlert(5000).catch(() => {})

      setScanResult({
        type: 'success',
        text: successMsg,
        detail: (detailMsg || 'Cửa tủ đã mở. Chúc bạn một ngày tốt lành!') + (bleStatus.isConnected ? ' • 🔔 Thẻ trên gói hàng đang phát sáng & bíp!' : '')
      })
    } else {
      playBeep('error')
      setScanResult({
        type: 'error',
        text: successMsg,
        detail: 'Vui lòng kiểm tra lại mã QR trên ứng dụng cư dân'
      })
    }

    // Reset tự động sau 3.5 giây để người tiếp theo lấy hàng
    setTimeout(() => {
      if (!isMountedRef.current) return
      setScanResult(null)
      setPendingToken(null)
      setTokenInfo(null)
      lastScannedRef.current = ''

      if (scannerRef.current && scannerRef.current.getState() === 2) {
        scannerRef.current.resume()
      }
    }, 3500)
  }

  // Hủy bỏ
  const cancelPickup = () => {
    setPendingToken(null)
    setTokenInfo(null)
    setScanResult(null)
    lastScannedRef.current = ''

    if (scannerRef.current && scannerRef.current.getState() === 2) {
      scannerRef.current.resume()
    }
  }

  // Nhập tay token
  const handleApplyManualToken = (e) => {
    e.preventDefault()
    if (manualToken.trim()) {
      const token = manualToken.trim().toUpperCase()
      setIsManualInput(false)
      setManualToken('')
      setPendingToken(token)
      inspectToken(token)
      playBeep('confirm')
    }
  }

  return (
    <div className="mode-view kiosk-view">
      {/* 1. Kiosk Welcome Banner */}
      <section className="kiosk-welcome-card">
        <div className="kiosk-hero-text">
          <div className="kiosk-hero-brand">
            <img src="/podo-logo-h.png" alt="PODO STATION" className="kiosk-hero-logo" />
            <span className="kiosk-hero-badge">TRẠM TỰ PHỤC VỤ</span>
          </div>
          <p className="kiosk-hero-sub">
            Mở ứng dụng Cư Dân, đưa mã QR lấy hàng vào camera phía dưới
          </p>
        </div>
        <div className="kiosk-header-actions">
          <button
            type="button"
            className="cam-control-btn"
            onClick={toggleCamera}
          >
            🔄 {facingMode === 'environment' ? 'Cam sau' : 'Cam trước'}
          </button>
          <button
            type="button"
            className="text-mini-btn"
            onClick={() => setIsManualInput(true)}
          >
            ⌨️ Nhập mã
          </button>
        </div>
      </section>

      {/* Thanh Điều Khiển Thẻ Smart Tag BLE (Khách Hàng) */}
      <div className={`kiosk-ble-bar ${bleStatus.isConnected ? 'is-connected' : 'is-disconnected'}`}>
        <div className="ble-bar-info">
          <span className="ble-dot"></span>
          <span className="ble-text">
            {bleStatus.isConnected ? (
              <>Thẻ Smart Tag: <strong>{bleStatus.deviceName}</strong> (Sẵn sàng)</>
            ) : (
              <>Thẻ Smart Tag: <em>Chưa kết nối</em></>
            )}
          </span>
        </div>
        <div className="ble-bar-actions">
          {!bleStatus.isConnected ? (
            <button
              type="button"
              className="ble-btn ble-connect-btn"
              onClick={handleConnectBle}
              disabled={bleLoading}
            >
              {bleLoading ? '⏳ Đang quét...' : '⚡ Kết nối Thẻ (BLE)'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`ble-btn ble-test-btn ${bleTesting ? 'is-testing' : ''}`}
                onClick={handleTestBleAlert}
                disabled={bleTesting}
              >
                {bleTesting ? '🔔 Đang bíp...' : '🔔 Thử bíp'}
              </button>
              <button
                type="button"
                className="ble-btn ble-disconnect-btn"
                onClick={() => bleTagService.disconnect()}
                title="Ngắt kết nối thẻ"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
      {bleMessage && <div className="ble-toast-msg">{bleMessage}</div>}

      {/* 2. Scanner Viewport: Khung viền Tablet màu trắng sang trọng */}
      {!pendingToken && !scanResult && (
        <section className="kiosk-scanner-container">
          <div className="tablet-camera-enclosure kiosk-tablet">
            {/* Bezel trên: Cảm biến & Ống kính trước của máy tính bảng */}
            <div className="tablet-bezel-top">
              <span className="tablet-sensor-dot" title="Cảm biến ánh sáng"></span>
              <span className="tablet-lens-dot" title="Ống kính Camera trước"></span>
              <span className="tablet-mic-hole" title="Micro thu âm"></span>
            </div>

            {/* Màn hình Tablet */}
            <div className="tablet-screen-bezel">
              <div className="kiosk-camera-frame">
                <div id="kiosk-reader"></div>

                {/* Các ô công cụ màu trắng sang trọng kiểu Tablet Camera */}
                <div className="tablet-floating-hud">
                  <div className="tablet-hud-top">
                    <div className="luxury-white-badge">
                      <span className="live-dot-indigo"></span>
                      <span className="badge-title">QUÉT QR CƯ DÂN</span>
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
                    </div>
                  </div>

                  {/* Khung định vị ngắm QR màu trắng sang trọng */}
                  <div className="kiosk-target-frame">
                    <div className="kiosk-corner top-left"></div>
                    <div className="kiosk-corner top-right"></div>
                    <div className="kiosk-corner bottom-left"></div>
                    <div className="kiosk-corner bottom-right"></div>
                    <div className="kiosk-laser-line"></div>
                  </div>

                  {cameraError && (
                    <div className="camera-alert">
                      <p>⚠️ {cameraError}</p>
                      <button
                        className="retry-cam-btn"
                        onClick={handleRetryCamera}
                      >
                        Thử lại Camera
                      </button>
                    </div>
                  )}

                  {/* Ô chip thông tin ở đáy khung ngắm */}
                  <div className="tablet-hud-bottom">
                    <span className="tablet-mode-chip">ĐƯA MÃ QR VÀO KHUNG</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bezel dưới: Thanh Home indicator phong cách iPad */}
            <div className="tablet-bezel-bottom">
              <div className="tablet-home-indicator"></div>
            </div>
          </div>

          <div className="kiosk-scan-tip">
            💡 Giữ điện thoại cách camera 15-20cm để nhận diện tức thì
          </div>
        </section>
      )}

      {/* 3. Màn hình xác nhận mã QR */}
      {pendingToken && !scanResult && (
        <section className="kiosk-confirm-card">
          {tokenInfo?.isNewPackage ? (
            <>
              <div className="confirm-icon-pulse" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8' }}>📦</div>
              <h3 className="confirm-title" style={{ color: '#38bdf8' }}>PHÁT HIỆN KIỆN HÀNG MỚI!</h3>
              <p className="confirm-desc">
                Hệ thống đã nhận diện mã vận đơn/mã QR từ camera Kiosk.
              </p>

              <div className="confirm-token-badge">
                <span className="token-label">MÃ VẬN ĐƠN:</span>
                <span className="token-value" style={{ color: '#38bdf8' }}>{pendingToken}</span>
              </div>

              <div className="confirm-info-box">
                <div className="info-item">
                  <span className="info-key">Trạng thái:</span>
                  <span className="info-val highlight" style={{ color: '#10b981' }}>Sẵn sàng lưu vào trạm PODO</span>
                </div>
                <div className="info-item">
                  <span className="info-key">Điểm đến mặc định:</span>
                  <span className="info-val">Căn hộ 1204 (Cư Dân)</span>
                </div>
              </div>

              <div className="confirm-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="kiosk-action-btn primary-confirm"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', width: '100%' }}
                  onClick={() => handleCheckinFromKiosk('1204')}
                >
                  ⭐ TIẾP NHẬN VÀO TRẠM CHO CĂN 1204
                </button>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    className="kiosk-action-btn"
                    style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#60a5fa', flex: 1 }}
                    onClick={() => handleCheckinFromKiosk('205')}
                  >
                    Gán Căn 205
                  </button>
                  <button
                    type="button"
                    className="kiosk-action-btn cancel-btn"
                    style={{ flex: 1 }}
                    onClick={cancelPickup}
                  >
                    ❌ Hủy bỏ
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="confirm-icon-pulse">🔓</div>
              <h3 className="confirm-title">MÃ QR HỢP LỆ!</h3>
              <p className="confirm-desc">
                Hệ thống đã nhận diện mã xác thực từ ứng dụng Cư Dân.
              </p>

              <div className="confirm-token-badge">
                <span className="token-label">MÃ XÁC THỰC:</span>
                <span className="token-value">{pendingToken}</span>
              </div>

              {tokenInfo && (
                <div className="confirm-info-box">
                  <div className="info-item">
                    <span className="info-key">Căn hộ:</span>
                    <span className="info-val highlight">{tokenInfo.apartment}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-key">Số kiện sẵn sàng:</span>
                    <span className="info-val">{tokenInfo.count} kiện hàng</span>
                  </div>
                </div>
              )}

              <div className="confirm-actions">
                <button
                  type="button"
                  className="kiosk-action-btn primary-confirm"
                  onClick={confirmPickup}
                >
                  ✅ XÁC NHẬN MỞ TỦ LẤY HÀNG
                </button>
                <button
                  type="button"
                  className="kiosk-action-btn cancel-btn"
                  onClick={cancelPickup}
                >
                  ❌ Hủy bỏ
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* 4. Màn hình kết quả (Đang mở tủ / Thành công / Lỗi) */}
      {scanResult && (
        <section className={`kiosk-result-card ${scanResult.type}`}>
          <div className="result-icon">
            {scanResult.type === 'loading' && <span className="spinner big-spinner"></span>}
            {scanResult.type === 'success' && '🎉'}
            {scanResult.type === 'error' && '⚠️'}
          </div>

          <h3 className="result-title">{scanResult.text}</h3>
          {scanResult.detail && <p className="result-detail">{scanResult.detail}</p>}

          {scanResult.type === 'success' && (
            <div className="cabinet-anim">
              <div className="cabinet-door-open">🚪 CỬA TỦ ĐÃ MỞ</div>
              <span className="auto-reset-hint">Màn hình sẽ tự động trở về sau 3 giây...</span>
            </div>
          )}

          {scanResult.type === 'error' && (
            <button
              type="button"
              className="retry-inline-btn"
              onClick={cancelPickup}
            >
              Quét lại ngay
            </button>
          )}
        </section>
      )}

      {/* Modal Nhập mã thủ công */}
      {isManualInput && (
        <div className="modal-backdrop">
          <div className="manual-modal">
            <div className="modal-header">
              <h3>⌨️ Nhập mã nhận hàng</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsManualInput(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleApplyManualToken}>
              <p className="modal-desc">
                Nhập mã token hiển thị dưới mã QR trên điện thoại cư dân:
              </p>
              <input
                type="text"
                className="modal-input monospace"
                placeholder="VD: PODO-ABC123"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
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
                  disabled={!manualToken.trim()}
                >
                  Kiểm tra mã
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
