// d:\ý tưởng kd\shipper-app\src\utils\bleTagService.js

/**
 * Service quản lý kết nối Bluetooth BLE với thẻ thông minh (iTag / Pick-to-light)
 * Sử dụng Web Bluetooth API (GATT Standard)
 */
const ALERT_CHARACTERISTIC_TARGETS = [
  { service: 'immediate_alert', char: 'alert_level', label: 'immediate_alert' },
  { service: 'link_loss', char: 'alert_level', label: 'link_loss' },
  {
    service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    char: '0000ffe1-0000-1000-8000-00805f9b34fb',
    label: 'ffe0/ffe1'
  }
]

const OPTIONAL_BLE_SERVICES = [
  'immediate_alert',
  'link_loss',
  'battery_service',
  '00001802-0000-1000-8000-00805f9b34fb', // Immediate Alert
  '00001803-0000-1000-8000-00805f9b34fb', // Link Loss
  '0000ffe0-0000-1000-8000-00805f9b34fb'  // Custom chip Trung Quốc
]

class BleTagService {
  constructor() {
    this.device = null
    this.server = null
    this.alertChar = null
    this.alertChars = []
    this.isConnected = false
    this.deviceName = ''
    this.listeners = new Set()
    this.alertTimer = null
    this._listeningDevice = null
    this._reconnectPromise = null
    this._autoReconnectPromise = null
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

  _attachDisconnectListener(device) {
    if (!device || this._listeningDevice === device) return
    this._listeningDevice = device
    device.addEventListener('gattserverdisconnected', () => {
      if (this.device !== device) return
      console.warn('⚠️ Thẻ BLE đã ngắt kết nối.')
      this.isConnected = false
      this.alertChar = null
      this.alertChars = []
      this.server = null
      this.notify()
    })
  }

  async _discoverAlertCharacteristics(server) {
    const found = []

    for (const target of ALERT_CHARACTERISTIC_TARGETS) {
      try {
        const service = await server.getPrimaryService(target.service)
        const char = await service.getCharacteristic(target.char)
        if (char && !found.includes(char)) {
          found.push(char)
        }
      } catch (err) {
        console.warn(`Không tìm thấy ${target.label}:`, err)
      }
    }

    if (found.length === 0) {
      throw new Error(
        'Đã kết nối Bluetooth nhưng không tìm thấy dịch vụ báo động (Immediate Alert) trên thẻ.'
      )
    }

    return found
  }

  async _writeCharacteristic(char, data) {
    // Characteristic Immediate Alert thường chỉ cho phép Write Without Response
    if (char.properties?.writeWithoutResponse && char.writeValueWithoutResponse) {
      await char.writeValueWithoutResponse(data)
    } else if (char.writeValueWithResponse) {
      await char.writeValueWithResponse(data)
    } else if (char.writeValue) {
      await char.writeValue(data)
    } else {
      throw new Error('Characteristic không hỗ trợ ghi dữ liệu')
    }
  }

  /**
   * Kết nối lại GATT Server trên thiết bị đã ghép đôi khi bị sleep / rớt kết nối
   */
  async reconnect() {
    if (!this.device) {
      throw new Error('Chưa có thiết bị Smart Tag để kết nối lại')
    }

    if (this._reconnectPromise) {
      return this._reconnectPromise
    }

    this._reconnectPromise = (async () => {
      try {
        const server = this.device.gatt.connected
          ? this.device.gatt
          : await this.device.gatt.connect()
        this.server = server

        const alertChars = await this._discoverAlertCharacteristics(server)
        this.alertChars = alertChars
        this.alertChar = alertChars[0]
        this.deviceName = this.device.name || this.deviceName || 'Thẻ Smart Tag'
        this.isConnected = true
        this.notify()

        return {
          success: true,
          deviceName: this.deviceName
        }
      } catch (err) {
        this.isConnected = false
        this.alertChar = null
        this.alertChars = []
        this.server = null
        this.notify()
        throw err
      } finally {
        this._reconnectPromise = null
      }
    })()

    return this._reconnectPromise
  }

  /**
   * Tự động kết nối lại với thiết bị đã được cấp quyền trước đó khi tải trang
   */
  async tryAutoReconnect() {
    if (!this.isSupported() || typeof navigator.bluetooth.getDevices !== 'function') {
      return { success: false, supported: false }
    }

    if (this.isConnected && this.device?.gatt?.connected && this.alertChars.length > 0) {
      return { success: true, deviceName: this.deviceName }
    }

    if (this._autoReconnectPromise) {
      return this._autoReconnectPromise
    }

    this._autoReconnectPromise = (async () => {
      try {
        const devices = await navigator.bluetooth.getDevices()
        if (!devices || devices.length === 0) {
          return { success: false, reason: 'no_devices' }
        }

        for (const device of devices) {
          try {
            const connectWithTimeout = Promise.race([
              device.gatt.connect(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Auto-reconnect timeout')), 6000)
              )
            ])
            const server = await connectWithTimeout
            const alertChars = await this._discoverAlertCharacteristics(server)

            this._attachDisconnectListener(device)
            this.device = device
            this.server = server
            this.alertChars = alertChars
            this.alertChar = alertChars[0]
            this.deviceName = device.name || 'Thẻ Smart Tag'
            this.isConnected = true
            this.notify()

            return {
              success: true,
              deviceName: this.deviceName
            }
          } catch (err) {
            console.warn(`Không thể tự kết nối lại thiết bị ${device.name || device.id}:`, err)
          }
        }

        return { success: false, reason: 'not_in_range' }
      } catch (err) {
        console.warn('Lỗi tryAutoReconnect:', err)
        return { success: false, reason: 'error', error: err }
      } finally {
        this._autoReconnectPromise = null
      }
    })()

    return this._autoReconnectPromise
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
        optionalServices: OPTIONAL_BLE_SERVICES
      })

      this.device = device
      this.deviceName = device.name || 'Thẻ Smart Tag'

      // Bắt sự kiện khi thiết bị bị ngắt kết nối (hết pin, xa sóng, tắt nguồn)
      this._attachDisconnectListener(device)

      // Kết nối GATT Server
      const server = await device.gatt.connect()
      this.server = server

      const alertChars = await this._discoverAlertCharacteristics(server)
      this.alertChars = alertChars
      this.alertChar = alertChars[0]
      this.isConnected = true
      this.notify()

      return {
        success: true,
        deviceName: this.deviceName
      }
    } catch (err) {
      this.isConnected = false
      this.alertChar = null
      this.alertChars = []
      this.server = null
      this.notify()
      throw err
    }
  }

  /**
   * Gửi byte điều khiển tới Characteristic (tự reconnect nếu GATT sleep và fallback đa characteristic)
   * @param {number} level - 0: Tắt, 1: Báo nhẹ, 2: Báo động mạnh (Còi + Nháy đèn)
   */
  async sendAlertByte(level = 2, _retried = false) {
    if (this.device && !this.device.gatt?.connected) {
      await this.reconnect()
    }

    const charsToTry = this.alertChars.length
      ? this.alertChars
      : this.alertChar
        ? [this.alertChar]
        : []

    if (charsToTry.length === 0) {
      throw new Error('Chưa kết nối thẻ Smart Tag')
    }

    const data = new Uint8Array([level])
    let lastErr = null

    for (const char of charsToTry) {
      try {
        await this._writeCharacteristic(char, data)
        this.alertChar = char
        return
      } catch (err) {
        lastErr = err
        console.warn('Ghi BLE characteristic thất bại, thử fallback tiếp theo:', err)
      }
    }

    if (!_retried && this.device) {
      await this.reconnect()
      return this.sendAlertByte(level, true)
    }

    throw lastErr || new Error('Không thể gửi lệnh tới thẻ Smart Tag')
  }

  /**
   * Kích hoạt còi & đèn trên thẻ trong thời gian chỉ định rồi tự động tắt
   * @param {number} durationMs - Thời gian kêu bíp (mặc định 4000ms = 4 giây)
   */
  async triggerAlert(durationMs = 4000) {
    if (this.device && !this.device.gatt?.connected) {
      try {
        await this.reconnect()
      } catch (err) {
        console.warn('Không thể tự động kết nối lại thẻ BLE:', err)
        return false
      }
    }

    if (!this.isConnected || (!this.alertChar && this.alertChars.length === 0)) {
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

    if (
      (this.isConnected && (this.alertChar || this.alertChars.length > 0)) ||
      (this.device && !this.device.gatt?.connected)
    ) {
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

    const device = this.device
    this.device = null
    this._listeningDevice = null

    if (device && device.gatt?.connected) {
      device.gatt.disconnect()
    }

    this.isConnected = false
    this.alertChar = null
    this.alertChars = []
    this.server = null
    this.notify()
  }
}

export const bleTagService = new BleTagService()
