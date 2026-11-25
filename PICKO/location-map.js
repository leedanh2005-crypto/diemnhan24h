/* ==========================================================================
   PODO STATION – 2D INDOOR WAYFINDING MAP (location-map.js)
   Apple-grade 2D architectural floorplan & single-package turn-by-turn HUD
   Zero 3D logic. Integrates with PICKO/index.html globals.
   ========================================================================== */
(function (global) {
  'use strict';

  var KIOSK_ORIGIN = { x: 90, y: 350 };
  var AISLE_Y = 297;
  var METERS_PER_PX = 0.016;
  var WALK_SPEED_MPS = 0.85;

  var RACKS = {
    A: {
      id: 'A',
      name: 'Kệ A · Tiêu chuẩn',
      shortName: 'Kệ A',
      zoneName: 'Hàng tiêu chuẩn',
      x: 150,
      y: 50,
      w: 126,
      h: 176,
      aisleX: 213,
      entryY: 236,
      turnDir: 'trái',
      sideNote: 'Dãy kệ đầu tiên bên trái'
    },
    B: {
      id: 'B',
      name: 'Kệ B · Hàng nhỏ',
      shortName: 'Kệ B',
      zoneName: 'Túi thư & Hàng nhỏ',
      x: 318,
      y: 50,
      w: 126,
      h: 176,
      aisleX: 381,
      entryY: 236,
      turnDir: 'trái',
      sideNote: 'Dãy kệ thứ hai phía trên'
    },
    C: {
      id: 'C',
      name: 'Kệ C · Cồng kềnh',
      shortName: 'Kệ C',
      zoneName: 'Hàng kích thước lớn',
      x: 486,
      y: 50,
      w: 126,
      h: 176,
      aisleX: 549,
      entryY: 236,
      turnDir: 'trái',
      sideNote: 'Dãy kệ thứ ba phía trên'
    },
    D: {
      id: 'D',
      name: 'Kệ D · Gửi trả',
      shortName: 'Kệ D',
      zoneName: 'Khu vực thu gom gửi trả',
      x: 654,
      y: 50,
      w: 126,
      h: 176,
      aisleX: 717,
      entryY: 236,
      turnDir: 'trái',
      sideNote: 'Cuối hành lang phía trên'
    },
    E: {
      id: 'E',
      name: 'Kệ E · Hỏa tốc 2H',
      shortName: 'Kệ E',
      zoneName: 'Kiện ưu tiên hỏa tốc',
      x: 604,
      y: 356,
      w: 224,
      h: 98,
      aisleX: 716,
      entryY: 344,
      turnDir: 'phải',
      sideNote: 'Phía đối diện cuối hành lang'
    }
  };

  var CELLS = {
    'A-01': { rack: 'A', code: 'A-01', floor: 'Tầng 4', size: 'S', x: 158, y: 82, w: 51, h: 42 },
    'A-02': { rack: 'A', code: 'A-02', floor: 'Tầng 3', size: 'S', x: 217, y: 82, w: 51, h: 42 },
    'A-03': { rack: 'A', code: 'A-03', floor: 'Tầng 2', size: 'M', x: 158, y: 130, w: 51, h: 42 },
    'A-04': { rack: 'A', code: 'A-04', floor: 'Tầng 2', size: 'M', x: 217, y: 130, w: 51, h: 42 },
    'A-05': { rack: 'A', code: 'A-05', floor: 'Tầng 1', size: 'M', x: 158, y: 178, w: 51, h: 40 },
    'A-06': { rack: 'A', code: 'A-06', floor: 'Tầng 1', size: 'L', x: 217, y: 178, w: 51, h: 40 },

    'B-01': { rack: 'B', code: 'B-01', floor: 'Tầng 4', size: 'S', x: 326, y: 82, w: 51, h: 42 },
    'B-02': { rack: 'B', code: 'B-02', floor: 'Tầng 4', size: 'S', x: 385, y: 82, w: 51, h: 42 },
    'B-03': { rack: 'B', code: 'B-03', floor: 'Tầng 3', size: 'S', x: 326, y: 130, w: 51, h: 42 },
    'B-04': { rack: 'B', code: 'B-04', floor: 'Tầng 3', size: 'S', x: 385, y: 130, w: 51, h: 42 },
    'B-05': { rack: 'B', code: 'B-05', floor: 'Tầng 2', size: 'M', x: 326, y: 178, w: 51, h: 40 },
    'B-06': { rack: 'B', code: 'B-06', floor: 'Tầng 1', size: 'M', x: 385, y: 178, w: 51, h: 40 },

    'C-01': { rack: 'C', code: 'C-01', floor: 'Tầng 3', size: 'L', x: 494, y: 82, w: 51, h: 64 },
    'C-02': { rack: 'C', code: 'C-02', floor: 'Tầng 2', size: 'L', x: 553, y: 82, w: 51, h: 64 },
    'C-03': { rack: 'C', code: 'C-03', floor: 'Tầng 2', size: 'L', x: 494, y: 152, w: 51, h: 66 },
    'C-04': { rack: 'C', code: 'C-04', floor: 'Tầng 1', size: 'XL', x: 553, y: 152, w: 51, h: 66 },

    'D-01': { rack: 'D', code: 'D-01', floor: 'Tầng 4', size: 'S', x: 662, y: 82, w: 51, h: 42 },
    'D-02': { rack: 'D', code: 'D-02', floor: 'Tầng 3', size: 'M', x: 721, y: 82, w: 51, h: 42 },
    'D-03': { rack: 'D', code: 'D-03', floor: 'Tầng 3', size: 'M', x: 662, y: 130, w: 51, h: 42 },
    'D-04': { rack: 'D', code: 'D-04', floor: 'Tầng 2', size: 'M', x: 721, y: 130, w: 51, h: 42 },
    'D-05': { rack: 'D', code: 'D-05', floor: 'Tầng 2', size: 'M', x: 662, y: 178, w: 51, h: 40 },
    'D-06': { rack: 'D', code: 'D-06', floor: 'Tầng 1', size: 'L', x: 721, y: 178, w: 51, h: 40 },

    'E-01': { rack: 'E', code: 'E-01', floor: 'Tầng 4', size: 'S', x: 614, y: 384, w: 98, h: 28 },
    'E-02': { rack: 'E', code: 'E-02', floor: 'Tầng 3', size: 'M', x: 720, y: 384, w: 98, h: 28 },
    'E-03': { rack: 'E', code: 'E-03', floor: 'Tầng 2', size: 'M', x: 614, y: 418, w: 98, h: 28 },
    'E-04': { rack: 'E', code: 'E-04', floor: 'Tầng 1', size: 'L', x: 720, y: 418, w: 98, h: 28 }
  };

  var ORDER_SLOT_POOL = ['A-03', 'B-01', 'C-01', 'E-01', 'A-04', 'B-03', 'C-02', 'E-03'];
  var RETURN_SLOT_POOL = ['D-02', 'D-01', 'D-04', 'D-03'];

  var _pingTimers = {};

  function safeEsc(val) {
    var fn = typeof esc === 'function' ? esc : global.esc;
    if (typeof fn === 'function') return fn(val);
    return String(val == null ? '' : val).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeWhen(val) {
    var fn = typeof when === 'function' ? when : global.when;
    if (typeof fn === 'function') return fn(val);
    return val ? String(val) : '--';
  }

  function safeMkBadge(mk) {
    var fn = typeof mkBadge === 'function' ? mkBadge : global.mkBadge;
    if (typeof fn === 'function') return fn(mk);
    return '<span class="mk">' + safeEsc(mk || 'PODO') + '</span>';
  }

  function safeToast(msg, type) {
    var fn = typeof toast === 'function' ? toast : global.toast;
    if (typeof fn === 'function') fn(msg, type);
  }

  function safeBeep() {
    try {
      var fn = typeof playBeeperSound === 'function' ? playBeeperSound : global.playBeeperSound;
      if (typeof fn === 'function') fn();
    } catch (e) { /* ignore audio context errors */ }
  }

  function cleanSlotId(slotCode) {
    return String(slotCode || '').replace(/[^a-zA-Z0-9]/g, '');
  }

  function collectActivePackages() {
    var rawOrders = typeof orders !== 'undefined' ? orders : global.orders;
    var orderList = Array.isArray(rawOrders) ? rawOrders : [];
    var atFn = typeof isAtStation === 'function' ? isAtStation : global.isAtStation;
    var checkAtStation = typeof atFn === 'function'
      ? atFn
      : function (o) { return !!(o && (o.stationStatus === 'AT_STATION' || o.displayStatus === 'Tại trạm')); };

    var atStationOrders = orderList.filter(checkAtStation);
    var rawRt = typeof rt !== 'undefined' ? rt : global.rt;
    var activeReturns = (rawRt && Array.isArray(rawRt.list))
      ? rawRt.list.filter(function (r) { return r && r.status === 'AT_STATION'; })
      : [];

    var pkgs = [];

    atStationOrders.forEach(function (o, idx) {
      var slot = ORDER_SLOT_POOL[idx % ORDER_SLOT_POOL.length];
      var cell = CELLS[slot] || CELLS['A-03'];
      var chip = 'CP-018' + (6 + idx);
      var key = 'order:' + (o.orderId || o.orderCode || idx);
      pkgs.push({
        key: key,
        kind: 'order',
        actionId: String(o.orderId || ''),
        slot: slot,
        rackId: cell.rack,
        floor: cell.floor,
        chip: chip,
        title: o.product || 'Kiện hàng tại trạm',
        marketplace: o.marketplace || 'PODO',
        trackingCode: o.trackingCode || o.orderCode || '--',
        orderCode: o.orderCode || '--',
        apartment: o.apartment || '1204',
        timeText: safeWhen(o.updatedAt),
        statusLabel: 'Chờ cư dân nhận'
      });
    });

    activeReturns.forEach(function (r, idx) {
      var slot = RETURN_SLOT_POOL[idx % RETURN_SLOT_POOL.length];
      var cell = CELLS[slot] || CELLS['D-02'];
      var chip = r.chip || ('CP-304' + (8 + idx));
      var itemName = (r.items && r.items[0] && r.items[0].productName) || 'Kiện hàng gửi trả';
      var key = 'return:' + (r.id || r.orderCode || idx);
      pkgs.push({
        key: key,
        kind: 'return',
        actionId: String(r.id || ''),
        slot: slot,
        rackId: cell.rack,
        floor: cell.floor,
        chip: chip,
        title: itemName,
        marketplace: r.marketplace || 'PODO',
        trackingCode: r.trackingCode || '--',
        orderCode: r.orderCode || '--',
        apartment: '1204',
        timeText: 'Đã gửi tại trạm',
        statusLabel: 'Kiện gửi trả'
      });
    });

    return pkgs;
  }

  function getCellCenter(cell) {
    return {
      x: Math.round(cell.x + cell.w / 2),
      y: Math.round(cell.y + cell.h / 2)
    };
  }

  function roundedPolylinePath(points, radius) {
    if (!points || points.length < 2) return '';
    var d = ['M ' + points[0].x + ' ' + points[0].y];
    for (var i = 1; i < points.length - 1; i++) {
      var prev = points[i - 1];
      var curr = points[i];
      var next = points[i + 1];

      var dx1 = curr.x - prev.x;
      var dy1 = curr.y - prev.y;
      var len1 = Math.hypot(dx1, dy1);

      var dx2 = next.x - curr.x;
      var dy2 = next.y - curr.y;
      var len2 = Math.hypot(dx2, dy2);

      if (len1 < 1 || len2 < 1) {
        d.push('L ' + curr.x + ' ' + curr.y);
        continue;
      }

      var r = Math.min(radius, len1 / 2, len2 / 2);
      var ax = curr.x - (dx1 / len1) * r;
      var ay = curr.y - (dy1 / len1) * r;
      var bx = curr.x + (dx2 / len2) * r;
      var by = curr.y + (dy2 / len2) * r;

      d.push('L ' + ax.toFixed(1) + ' ' + ay.toFixed(1));
      d.push('Q ' + curr.x + ' ' + curr.y + ' ' + bx.toFixed(1) + ' ' + by.toFixed(1));
    }
    var last = points[points.length - 1];
    d.push('L ' + last.x + ' ' + last.y);
    return d.join(' ');
  }

  function computePathLength(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
  }

  function buildWayfindingRoute(pkg) {
    var cell = CELLS[pkg.slot] || CELLS['A-03'];
    var rack = RACKS[cell.rack] || RACKS.A;
    var dest = getCellCenter(cell);

    var points = [
      KIOSK_ORIGIN,
      { x: KIOSK_ORIGIN.x, y: AISLE_Y },
      { x: rack.aisleX, y: AISLE_Y }
    ];

    if (rack.id === 'E') {
      points.push({ x: rack.aisleX, y: rack.entryY });
      points.push({ x: dest.x, y: rack.entryY });
      points.push(dest);
    } else {
      points.push({ x: rack.aisleX, y: dest.y });
      points.push(dest);
    }

    // Deduplicate consecutive identical points
    var cleanPts = [points[0]];
    for (var i = 1; i < points.length; i++) {
      var prev = cleanPts[cleanPts.length - 1];
      if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) >= 2) {
        cleanPts.push(points[i]);
      }
    }

    var pathD = roundedPolylinePath(cleanPts, 14);
    var totalPx = computePathLength(cleanPts);
    var totalMeters = Math.max(2.5, Number((totalPx * METERS_PER_PX).toFixed(1)));
    var aislePx = Math.abs(rack.aisleX - KIOSK_ORIGIN.x);
    var aisleMeters = Math.max(1.5, Number((aislePx * METERS_PER_PX).toFixed(1)));
    var walkSeconds = Math.max(4, Math.round(totalMeters / WALK_SPEED_MPS));

    return {
      rack: rack,
      cell: cell,
      dest: dest,
      pathD: pathD,
      totalMeters: totalMeters,
      aisleMeters: aisleMeters,
      walkSeconds: walkSeconds
    };
  }

  function buildFloorplanSvg(activePkg, route) {
    var targetRackId = activePkg ? activePkg.rackId : null;
    var targetSlot = activePkg ? activePkg.slot : null;

    // Subtle background architectural grid (40px pitch inside room bounds)
    var gridLines = [];
    for (var gx = 68; gx < 892; gx += 40) {
      gridLines.push('<line x1="' + gx + '" y1="24" x2="' + gx + '" y2="476" />');
    }
    for (var gy = 64; gy < 476; gy += 40) {
      gridLines.push('<line x1="28" y1="' + gy + '" x2="892" y2="' + gy + '" />');
    }

    // Render 5 Racks and their individual cells
    var racksHtml = Object.keys(RACKS).map(function (rKey) {
      var r = RACKS[rKey];
      var isTargetRack = targetRackId === r.id;
      var rackCells = Object.keys(CELLS)
        .map(function (cKey) { return CELLS[cKey]; })
        .filter(function (c) { return c.rack === r.id; });

      var cellsHtml = rackCells.map(function (c) {
        var isTargetCell = targetSlot === c.code;
        var cellId = 'wf-cell-' + cleanSlotId(c.code);
        var cls = 'wf-cell' + (isTargetCell ? ' is-target' : '');
        var cx = c.x + c.w / 2;
        var cy = c.y + c.h / 2 + 4;
        return (
          '<g class="' + cls + '" id="' + cellId + '" data-slot="' + safeEsc(c.code) + '"' +
          (isTargetCell ? ' onclick="highlightShelfSlot(\'' + safeEsc(c.code) + '\')"' : '') + '>' +
            '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" rx="7" />' +
            '<text class="wf-cell-label" x="' + cx + '" y="' + cy + '" text-anchor="middle">' + safeEsc(c.code) + '</text>' +
          '</g>'
        );
      }).join('');

      var rackTitleX = r.x + r.w / 2;
      var rackTitleY = r.y + 20;

      return (
        '<g class="wf-rack' + (isTargetRack ? ' is-target' : '') + '" id="wf-rack-' + r.id + '">' +
          '<rect class="wf-rack-frame" x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="14" />' +
          '<text class="wf-rack-label" x="' + rackTitleX + '" y="' + rackTitleY + '" text-anchor="middle">' + safeEsc(r.name) + '</text>' +
          cellsHtml +
        '</g>'
      );
    }).join('');

    // Dynamic single-package route & beacon layer (ONLY when an active package is selected)
    var routeHtml = '';
    if (activePkg && route) {
      routeHtml =
        '<g class="wf-route-layer">' +
          '<path class="wf-route-glow" d="' + route.pathD + '" fill="none" />' +
          '<path class="wf-route-line" d="' + route.pathD + '" fill="none" />' +
          '<circle class="wf-route-start" cx="' + KIOSK_ORIGIN.x + '" cy="' + KIOSK_ORIGIN.y + '" r="7" />' +
          '<g class="wf-dest-marker" id="wfDestMarker" transform="translate(' + route.dest.x + ',' + route.dest.y + ')">' +
            '<circle class="wf-dest-ring" cx="0" cy="0" r="22" />' +
            '<circle class="wf-dest-pulse" cx="0" cy="0" r="14" />' +
            '<circle class="wf-dest-pin" cx="0" cy="0" r="7.5" />' +
          '</g>' +
        '</g>';
    }

    return (
      '<svg class="wf-svg" viewBox="0 0 920 500" role="img" aria-label="Bản đồ chỉ đường 2D trong trạm PODO Station">' +
        '<g class="wf-floor-layer">' +
          '<rect class="wf-room-bg" x="28" y="24" width="864" height="452" rx="22" />' +
          '<g class="wf-grid-lines">' + gridLines.join('') + '</g>' +
          '<rect class="wf-wall" x="28" y="24" width="864" height="452" rx="22" fill="none" />' +

          '<!-- Lối đi chính ngang sảnh -->' +
          '<rect class="wf-aisle" x="62" y="264" width="796" height="66" rx="16" />' +
          '<line class="wf-aisle-centerline" x1="88" y1="' + AISLE_Y + '" x2="836" y2="' + AISLE_Y + '" />' +
          '<text class="wf-svg-sub" x="460" y="301" text-anchor="middle">LỐI ĐI CHÍNH · SẢNH TRẠM PODO</text>' +

          '<!-- Cửa vào sảnh & Cánh cửa kiến trúc -->' +
          '<g class="wf-entrance">' +
            '<rect class="wf-entrance-pad" x="54" y="458" width="72" height="22" rx="6" />' +
            '<path class="wf-door-arc" d="M 60 474 A 34 34 0 0 1 94 440" fill="none" />' +
            '<line class="wf-door-leaf" x1="60" y1="474" x2="60" y2="440" />' +
            '<text class="wf-svg-label" x="90" y="473" text-anchor="middle">CỬA SẢNH</text>' +
          '</g>' +

          '<!-- Điểm Check-in Kiosk -->' +
          '<g class="wf-zone-kiosk">' +
            '<rect class="wf-kiosk-box" x="48" y="336" width="84" height="66" rx="14" />' +
            '<rect class="wf-kiosk-screen" x="64" y="346" width="52" height="10" rx="4" />' +
            '<text class="wf-svg-label" x="90" y="376" text-anchor="middle">KIOSK QR</text>' +
            '<text class="wf-svg-sub" x="90" y="392" text-anchor="middle">Điểm bắt đầu</text>' +
          '</g>' +

          '<!-- Khu vực bàn soạn / kiểm tra kiện hàng -->' +
          '<g class="wf-zone-bench">' +
            '<rect class="wf-bench-box" x="172" y="366" width="290" height="78" rx="16" />' +
            '<text class="wf-svg-label" x="317" y="402" text-anchor="middle">Khu vực nhận &amp; mở kiểm kiện hàng</text>' +
            '<text class="wf-svg-sub" x="317" y="421" text-anchor="middle">Bàn kiểm tra · Máy quét mã vạch tự động</text>' +
          '</g>' +
        '</g>' +

        '<!-- 5 dãy kệ thông minh A–E -->' +
        '<g class="wf-racks-layer">' + racksHtml + '</g>' +

        '<!-- Đường dẫn chỉ đường duy nhất đến kiện hàng đang chọn -->' +
        routeHtml +
      '</svg>'
    );
  }

  function buildPackageTabs(pkgs, activeKey) {
    if (pkgs.length <= 1) return '';
    return (
      '<div class="wf-pkg-tabs" role="tablist" aria-label="Chọn kiện hàng cần chỉ đường">' +
        pkgs.map(function (p) {
          var isActive = p.key === activeKey;
          var cls = 'wf-pkg-tab' + (isActive ? ' is-active' : '') + (p.kind === 'return' ? ' is-return' : '');
          return (
            '<button type="button" role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '" ' +
            'class="' + cls + '" onclick="selectWayfindingPackage(\'' + safeEsc(p.key) + '\')">' +
              '<span class="wf-tab-slot">' + safeEsc(p.slot) + '</span>' +
              '<span class="wf-tab-info">' +
                '<span class="wf-tab-name">' + safeEsc(p.title) + '</span>' +
                '<span class="wf-tab-sub">' + safeEsc(p.marketplace) + ' · ' + safeEsc(p.floor) + ' · ' + safeEsc(p.chip) + '</span>' +
              '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    );
  }

  function buildNavPanel(pkg, route) {
    var actionBtn = pkg.kind === 'return'
      ? '<button type="button" class="btn btn-p wf-btn-qr" data-rt-handover="' + safeEsc(pkg.actionId) + '">' +
          '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' +
          '<span>Lấy mã bàn giao shipper</span>' +
        '</button>'
      : '<button type="button" class="btn btn-p wf-btn-qr" data-pk-one="' + safeEsc(pkg.actionId) + '">' +
          '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' +
          '<span>Lấy mã QR nhận hàng</span>' +
        '</button>';

    return (
      '<aside class="wf-nav-panel" aria-label="Hướng dẫn chỉ đường đến kiện hàng">' +
        '<div class="wf-active-card">' +
          '<div class="wf-badge-row">' +
            safeMkBadge(pkg.marketplace) +
            '<span class="wf-slot-badge">📍 ' + safeEsc(route.rack.shortName) + ' · Ô ' + safeEsc(pkg.slot) + '</span>' +
            '<span class="wf-chip-badge">🏷️ ' + safeEsc(pkg.chip) + '</span>' +
          '</div>' +
          '<h3 class="wf-pkg-name">' + safeEsc(pkg.title) + '</h3>' +
          '<div class="wf-pkg-meta">' +
            '<span>Vận đơn: <b>' + safeEsc(pkg.trackingCode) + '</b></span>' +
            '<span>Căn hộ: <b>' + safeEsc(pkg.apartment) + '</b></span>' +
            '<span>Cập nhật: <b>' + safeEsc(pkg.timeText) + '</b></span>' +
          '</div>' +
        '</div>' +

        '<div class="wf-kpi-strip">' +
          '<div class="wf-kpi-item">' +
            '<span class="wf-kpi-label">Khoảng cách</span>' +
            '<strong class="wf-kpi-val">~' + route.totalMeters + ' m</strong>' +
          '</div>' +
          '<div class="wf-kpi-item">' +
            '<span class="wf-kpi-label">Thời gian đi bộ</span>' +
            '<strong class="wf-kpi-val">~' + route.walkSeconds + ' giây</strong>' +
          '</div>' +
          '<div class="wf-kpi-item">' +
            '<span class="wf-kpi-label">Độ cao ô kệ</span>' +
            '<strong class="wf-kpi-val">' + safeEsc(pkg.floor) + '</strong>' +
          '</div>' +
        '</div>' +

        '<ol class="wf-steps">' +
          '<li class="wf-step">' +
            '<span class="wf-step-num">1</span>' +
            '<div class="wf-step-body">' +
              '<div class="wf-step-title">Từ Cửa Sảnh / Kiosk đi thẳng ' + route.aisleMeters + 'm</div>' +
              '<div class="wf-step-desc">Bước qua máy quét Kiosk, tiến vào Lối đi chính và đi dọc hành lang sảnh trạm.</div>' +
            '</div>' +
          '</li>' +
          '<li class="wf-step">' +
            '<span class="wf-step-num">2</span>' +
            '<div class="wf-step-body">' +
              '<div class="wf-step-title">Rẽ ' + safeEsc(route.rack.turnDir) + ' vào ' + safeEsc(route.rack.name) + '</div>' +
              '<div class="wf-step-desc">' + safeEsc(route.rack.sideNote) + ' (' + safeEsc(route.rack.zoneName) + ').</div>' +
            '</div>' +
          '</li>' +
          '<li class="wf-step">' +
            '<span class="wf-step-num">3</span>' +
            '<div class="wf-step-body">' +
              '<div class="wf-step-title">Lấy tại Ô ' + safeEsc(pkg.slot) + ' · ' + safeEsc(pkg.floor) + ' · Chip ' + safeEsc(pkg.chip) + '</div>' +
              '<div class="wf-step-desc">Nhấn phát tín hiệu bíp bíp bên dưới để đèn LED tại ô ' + safeEsc(pkg.slot) + ' nhấp nháy xác nhận.</div>' +
            '</div>' +
          '</li>' +
        '</ol>' +

        '<div class="wf-actions">' +
          '<button type="button" class="btn wf-btn-ping" onclick="pingLocationChip(\'' + safeEsc(pkg.chip) + '\', \'' + safeEsc(pkg.slot) + '\')">' +
            '<svg class="ic" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>' +
            '<span>Bíp bíp &amp; Nháy đèn</span>' +
          '</button>' +
          '<button type="button" class="btn btn-o wf-btn-locate" onclick="highlightShelfSlot(\'' + safeEsc(pkg.slot) + '\')">' +
            '<span>📍 Định vị ô ' + safeEsc(pkg.slot) + '</span>' +
          '</button>' +
          actionBtn +
        '</div>' +
      '</aside>'
    );
  }

  function buildEmptyPanel() {
    return (
      '<aside class="wf-empty-panel" aria-label="Trạng thái trống tại trạm">' +
        '<div class="wf-empty-icon" aria-hidden="true">' +
          '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>' +
        '</div>' +
        '<h3 class="wf-empty-title">Chưa có kiện hàng đang chờ tại trạm</h3>' +
        '<p class="wf-empty-desc">Căn hộ 1204 hiện chưa có kiện hàng nào tại PODO Station. Khi shipper giao kiện đến trạm, tuyến đường 2D và mã chip định vị sẽ tự động hiển thị.</p>' +
        '<button type="button" class="btn btn-p" onclick="resetDemoPkg()">🔄 Tạo kiện mẫu tại trạm</button>' +
      '</aside>'
    );
  }

  function pulseCellVisual(slotCode) {
    var code = cleanSlotId(slotCode);
    var cellEl = document.getElementById('wf-cell-' + code);
    var destEl = document.getElementById('wfDestMarker');
    if (cellEl) {
      cellEl.classList.add('is-pinging');
      if (_pingTimers[code]) clearTimeout(_pingTimers[code]);
      _pingTimers[code] = setTimeout(function () {
        var elNow = document.getElementById('wf-cell-' + code);
        if (elNow) elNow.classList.remove('is-pinging');
      }, 4000);
    }
    if (destEl) {
      destEl.classList.add('is-pinging');
      if (_pingTimers.__dest) clearTimeout(_pingTimers.__dest);
      _pingTimers.__dest = setTimeout(function () {
        var dNow = document.getElementById('wfDestMarker');
        if (dNow) dNow.classList.remove('is-pinging');
      }, 4000);
    }
  }

  function renderLocationView(forceRender) {
    var root = document.getElementById('locationRoot');
    if (!root) return;

    var pkgs = collectActivePackages();
    var totalAt = pkgs.length;

    // Update sidebar/nav badge
    var badgeEl = document.getElementById('locCount');
    if (badgeEl) {
      badgeEl.textContent = totalAt;
      badgeEl.hidden = !totalAt;
    }

    var activePkg = null;
    if (totalAt > 0) {
      var savedKey = global._activeWayfindingKey;
      activePkg = pkgs.find(function (p) { return p.key === savedKey; }) || pkgs[0];
      global._activeWayfindingKey = activePkg.key;
    } else {
      global._activeWayfindingKey = null;
    }

    var signature = (activePkg ? activePkg.key : 'empty') + '::' + pkgs.map(function (p) {
      return [p.key, p.slot, p.title, p.trackingCode, p.timeText].join('|');
    }).join(';');

    if (!forceRender && root.dataset.wfSig === signature && root.querySelector('.wf-shell')) {
      return;
    }
    root.dataset.wfSig = signature;

    var route = activePkg ? buildWayfindingRoute(activePkg) : null;
    var stateAttr = totalAt > 0 ? 'active' : 'empty';
    var kindAttr = activePkg ? activePkg.kind : 'none';

    var headerHtml =
      '<div class="wf-header">' +
        '<div class="wf-header-copy">' +
          '<div class="wf-live-pill">' +
            '<span class="wf-live-dot"></span>' +
            '<span>PODO Indoor Wayfinding · Sảnh Tháp Diamond</span>' +
          '</div>' +
          '<h2 class="wf-title">Bản đồ chỉ đường đến kiện hàng</h2>' +
          '<p class="wf-subtitle">' +
            (activePkg
              ? 'Tuyến đường trực tiếp từ máy quét Kiosk tới đúng ô kệ chứa kiện hàng đang chọn của Căn hộ 1204.'
              : 'Sơ đồ mặt bằng 2D trạm PODO Station — sẵn sàng dẫn đường ngay khi có kiện hàng đến trạm.') +
          '</p>' +
        '</div>' +
        '<div class="wf-header-actions">' +
          (totalAt > 0
            ? '<span class="wf-count-pill">' + totalAt + ' kiện tại trạm</span>' +
              '<button type="button" class="btn btn-o" onclick="pingAllChips()">' +
                '<svg class="ic" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>' +
                '<span>Bíp bíp toàn bộ</span>' +
              '</button>'
            : '<button type="button" class="btn btn-o" onclick="resetDemoPkg()">🔄 Thử nghiệm kiện hàng mẫu</button>') +
        '</div>' +
      '</div>';

    var tabsHtml = buildPackageTabs(pkgs, activePkg ? activePkg.key : '');

    var mapTopbar = activePkg
      ? '<div class="wf-map-topbar">' +
          '<span class="wf-map-heading">Mặt bằng trạm 2D · Lối đi từ Kiosk</span>' +
          '<div class="wf-map-chips">' +
            '<span class="wf-target-chip">Đích: ' + safeEsc(route.rack.shortName) + ' · Ô ' + safeEsc(activePkg.slot) + ' · ' + safeEsc(activePkg.floor) + '</span>' +
            '<span class="wf-metric-chip">~' + route.totalMeters + 'm · ' + route.walkSeconds + 's</span>' +
          '</div>' +
        '</div>'
      : '<div class="wf-map-topbar">' +
          '<span class="wf-map-heading">Mặt bằng trạm 2D · Tổng quan 5 dãy kệ</span>' +
          '<div class="wf-map-chips">' +
            '<span class="wf-metric-chip">5 dãy kệ A–E · Chờ kiện mới</span>' +
          '</div>' +
        '</div>';

    var legendHtml =
      '<div class="wf-map-legend">' +
        '<span class="wf-legend-item"><i class="wf-legend-swatch is-kiosk"></i><span>Điểm bắt đầu (Kiosk)</span></span>' +
        '<span class="wf-legend-item"><i class="wf-legend-swatch is-route"></i><span>Tuyến đường đang dẫn</span></span>' +
        '<span class="wf-legend-item"><i class="wf-legend-swatch is-target"></i><span>Ô kệ đích đang chọn</span></span>' +
        '<span class="wf-legend-item"><i class="wf-legend-swatch is-rack"></i><span>Các dãy kệ khác</span></span>' +
      '</div>';

    var mainGridHtml =
      '<div class="wf-grid">' +
        '<section class="wf-map-card" aria-label="Bản đồ mặt bằng 2D">' +
          mapTopbar +
          '<div class="wf-map-stage">' + buildFloorplanSvg(activePkg, route) + '</div>' +
          legendHtml +
        '</section>' +
        (activePkg ? buildNavPanel(activePkg, route) : buildEmptyPanel()) +
      '</div>';

    root.innerHTML =
      '<div class="wf-shell" data-wf-state="' + stateAttr + '" data-wf-kind="' + kindAttr + '">' +
        headerHtml +
        tabsHtml +
        mainGridHtml +
      '</div>';
  }

  function selectWayfindingPackage(pkgKey) {
    global._activeWayfindingKey = pkgKey;
    renderLocationView(true);
  }

  function highlightShelfSlot(cellCode) {
    var slot = String(cellCode || '').trim();
    if (!slot) return;
    var pkgs = collectActivePackages();
    var match = pkgs.find(function (p) { return p.slot === slot; });
    if (match && global._activeWayfindingKey !== match.key) {
      global._activeWayfindingKey = match.key;
      renderLocationView(true);
    }
    pulseCellVisual(slot);
    safeBeep();
    safeToast('📍 Đã định vị Ô kệ ' + slot + '. Đèn LED định vị đang nhấp nháy!', 'ok');
  }

  function pingLocationChip(chipCode, slotName) {
    var slot = String(slotName || '').trim();
    var chip = String(chipCode || '').trim();
    if (slot) {
      var pkgs = collectActivePackages();
      var match = pkgs.find(function (p) { return p.slot === slot; });
      if (match && global._activeWayfindingKey !== match.key) {
        global._activeWayfindingKey = match.key;
        renderLocationView(true);
      }
      pulseCellVisual(slot);
    }
    safeBeep();
    safeToast('🔊 Đang phát tín hiệu đến chip ' + chip + ' tại Ô kệ ' + slot + '! Đèn LED thẻ iTag đang nhấp nháy.', 'ok');
  }

  function pingAllChips() {
    var pkgs = collectActivePackages();
    safeBeep();
    if (!pkgs.length) {
      safeToast('Hiện chưa có kiện hàng nào tại trạm để phát tín hiệu.', 'info');
      return;
    }
    pkgs.forEach(function (p) { pulseCellVisual(p.slot); });
    safeToast('🔊 Đang phát tín hiệu tìm kiếm ' + pkgs.length + ' kiện hàng của Căn hộ 1204!', 'ok');
  }

  // Expose public globals expected by PICKO/index.html
  global.renderLocationView = renderLocationView;
  global.selectWayfindingPackage = selectWayfindingPackage;
  global.highlightShelfSlot = highlightShelfSlot;
  global.pingLocationChip = pingLocationChip;
  global.pingAllChips = pingAllChips;

  // Render immediately if user is already on the location view when script loads
  if (document.body && document.body.dataset && document.body.dataset.view === 'location') {
    renderLocationView(true);
  }
})(window);
