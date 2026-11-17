// d:\ý tưởng kd\shipper-app\src\utils\bleTagService.js

/**
 * Service quản lý kết nối Bluetooth BLE với thẻ thông minh (iTag / Pick-to-light)
 * Sử dụng Web Bluetooth API (GATT Standard)
 */
class BleTagService {
  constructor() {
    this.device = null
    this.server = null
    this.alertChar = null
    this.isConnected = false
    this.deviceName = ''
    this.listeners = new Set()
    this.alertTimer = null
  }

  // Đăng ký nhận thông báo thay đổi trạng thái kết nối
  subscribe(listener) {
    this.listeners.add(listener)
    listener({
      isConnected: this.isConnected,
      deviceName: this.deviceName
    })
    return () => this.listeners.delete(listener)
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn({
          isConnected: this.isConnected,
          deviceName: this.deviceName
        })
      } catch (e) {
        console.error('BLE listener error:', e)
      }
    })
  }

  // Kiểm tra trình duyệt có hỗ trợ Web Bluetooth không
  isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  /**
   * Kết nối thiết bị iTag thông qua hộp thoại chọn thiết bị của trình duyệt
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error(
        'Trình duyệt không hỗ trợ Web Bluetooth. Vui lòng sử dụng Google Chrome hoặc Edge trên máy tính / điện thoại Android.'
      )
    }

    try {
      // Mở hộp thoại chọn thiết bị Bluetooth
      // Chấp nhận tất cả thiết bị và đăng ký các Service chuẩn của iTag
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'immediate_alert',
          'link_loss',
          'battery_service',
          '00001802-0000-1000-8000-00805f9b34fb', // Immediate Alert
          '00001803-0000-1000-8000-00805f9b34fb', // Link Loss
          '0000ffe0-0000-1000-8000-00805f9b34fb'  // Custom chip Trung Quốc
        ]
      })

      this.device = device
      this.deviceName = device.name || 'Thẻ Smart Tag'

      // Bắt sự kiện khi thiết bị bị ngắt kết nối (hết pin, xa sóng, tắt nguồn)
      device.addEventListener('gattserverdisconnected', () => {
        console.warn('⚠️ Thẻ BLE đã ngắt kết nối.')
        this.isConnected = false
        this.alertChar = null
        this.notify()
      })

      // Kết nối GATT Server
      const server = await device.gatt.connect()
      this.server = server

      let alertChar = null

      // 1. Thử lấy Service immediate_alert chuẩn Bluetooth SIG
      try {
        const service = await server.getPrimaryService('immediate_alert')
        alertChar = await service.getCharacteristic('alert_level')
      } catch (e1) {
        console.warn('Không tìm thấy immediate_alert, thử link_loss...', e1)
      }

      // 2. Thử Service link_loss dự phòng
      if (!alertChar) {
        try {
          const service = await server.getPrimaryService('link_loss')
          alertChar = await service.getCharacteristic('alert_level')
        } catch (e2) {
          console.warn('Không tìm thấy link_loss, thử custom FFE0...', e2)
        }
      }

      // 3. Thử Service custom FFE0 (thường có trên một số iTag giá rẻ)
      if (!alertChar) {
        try {
          const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb')
          alertChar = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb')
        } catch (e3) {
          console.warn('Không tìm thấy FFE0:', e3)
        }
      }

      if (!alertChar) {
        throw new Error('Đã kết nối Bluetooth nhưng không tìm thấy dịch vụ báo động (Immediate Alert) trên thẻ.')
      }

      this.alertChar = alertChar
      this.isConnected = true
      this.notify()

      return {
        success: true,
        deviceName: this.deviceName
      }
    } catch (err) {
      this.isConnected = false
      this.alertChar = null
      this.notify()
      throw err
    }
  }

  /**
   * Gửi byte điều khiển tới Characteristic
   * @param {number} level - 0: Tắt, 1: Báo nhẹ, 2: Báo động mạnh (Còi + Nháy đèn)
   */
  async sendAlertByte(level = 2) {
    if (!this.alertChar) {
      throw new Error('Chưa kết nối thẻ Smart Tag')
    }

    const data = new Uint8Array([level])
    const char = this.alertChar

    // Characteristic Immediate Alert thường chỉ cho phép Write Without Response
    if (char.properties?.writeWithoutResponse && char.writeValueWithoutResponse) {
      await char.writeValueWithoutResponse(data)
    } else if (char.writeValueWithResponse) {
      await char.writeValueWithResponse(data)
    } else if (char.writeValue) {
      await char.writeValue(data)
    }
  }

  /**
   * Kích hoạt còi & đèn trên thẻ trong thời gian chỉ định rồi tự động tắt
   * @param {number} durationMs - Thời gian kêu bíp (mặc định 4000ms = 4 giây)
   */
  async triggerAlert(durationMs = 4000) {
    if (!this.isConnected || !this.alertChar) {
      console.warn('Bỏ qua kích hoạt BLE: Thẻ chưa kết nối')
      return false
    }

    try {
      if (this.alertTimer) {
        clearTimeout(this.alertTimer)
        this.alertTimer = null
      }

      // Mức 2: High Alert (Còi to + Nhấp nháy đèn LED)
      await this.sendAlertByte(2)

      // Hẹn giờ gửi mức 0 (Tắt còi và đèn)
      this.alertTimer = setTimeout(async () => {
        try {
          await this.sendAlertByte(0)
        } catch (e) {
          console.warn('Lỗi khi tắt báo động BLE:', e)
        }
        this.alertTimer = null
      }, durationMs)

      return true
    } catch (err) {
      console.error('Lỗi gửi lệnh kích hoạt BLE:', err)
      return false
    }
  }

  /**
   * Tắt còi & đèn ngay lập tức
   */
  async stopAlert() {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer)
      this.alertTimer = null
    }

    if (this.isConnected && this.alertChar) {
      try {
        await this.sendAlertByte(0)
      } catch (e) {
        console.warn('Lỗi tắt alert:', e)
      }
    }
  }

  /**
   * Ngắt kết nối thủ công
   */
  disconnect() {
    if (this.alertTimer) {
      clearTimeout(this.alertTimer)
      this.alertTimer = null
    }

    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect()
    }

    this.isConnected = false
    this.alertChar = null
    this.server = null
    this.notify()
  }
}

export const bleTagService = new BleTagService()

