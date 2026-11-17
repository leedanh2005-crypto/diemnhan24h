/**
 * File này đóng vai trò là "Phiên dịch viên"
 * Dịch từ các cột Tiếng Việt (trên Supabase) sang Tiếng Anh (cho giao diện index.html cũ)
 */

// Hàm băm (hash) chuỗi thành số nguyên dương để chọn dữ liệu ngẫu nhiên nhưng cố định
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const MARKETS = ['Shopee', 'TikTok Shop', 'Lazada', 'Tiki'];
const FAKE_PRODUCTS = [
  { name: 'Áo thun nam/nữ form rộng', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=150&q=80', price: 125000 },
  { name: 'Balo laptop nam nữ thời trang', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=150&q=80', price: 215000 },
  { name: 'Áo khoác đi mưa cao cấp', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=150&q=80', price: 299000 },
  { name: 'Tai nghe Bluetooth chống ồn', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&q=80', price: 1450000 },
  { name: 'Giày thể thao siêu nhẹ', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&q=80', price: 350000 },
  { name: 'Đồng hồ thời trang nam/nữ', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&q=80', price: 2100000 },
  { name: 'Điện thoại thông minh cao cấp', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=150&q=80', price: 8500000 },
  { name: 'Son môi cao cấp chính hãng', image: 'https://images.unsplash.com/photo-1596462502278-27bf85033e5a?w=150&q=80', price: 950000 },
];

// 2 đơn hàng cố định tuyệt đối theo phiếu giao hàng Shopee Express (PODO.png)
const DEMO_EXACT_PACKAGES = {
  'SPXVN091234567': {
    recipient: 'Lê Minh Quân',
    phone: '090*****67',
    apartment: '1204',
    address: '45/7 Trần Phú, Phường Thạch Thang, Quận Hải Châu, Thành phố Đà Nẵng',
    shopName: 'CÔNG TY GIA DỤNG AN PHÁT',
    senderAddress: '128 Nguyễn Hữu Thọ, Phường Hòa Cường, Quận Hải Châu, Thành phố Đà Nẵng',
    orderCode: 'SHP260911A58',
    mainProduct: 'ĐÈN BÀN LED & KỆ NHỎ ĐỂ BÀN',
    totalQuantity: 2,
    totalAmount: 58000,
    carrier: 'Shopee Express (SPX)',
    payment: 'Thanh toán khi nhận hàng (COD)',
    instruction: 'Được đồng kiểm',
    deliveryRoute: 'DN-45-21-TK15-P · E-LẠNH',
    items: [
      {
        productName: 'ĐÈN BÀN LED',
        image: 'https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?w=150&q=80',
        quantity: 1,
        price: 35000,
        variant: 'Ánh sáng trắng'
      },
      {
        productName: 'KỆ NHỎ ĐỂ BÀN',
        image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=150&q=80',
        quantity: 1,
        price: 23000,
        variant: 'Gỗ mini'
      }
    ]
  },
  'SPXVN086888204': {
    recipient: 'Phạm Thu Hằng',
    phone: '098*****04',
    apartment: '1204',
    address: '122/8 Lê Duẩn, Phường Cửa Nam, Quận Hoàn Kiếm, Thành phố Hà Nội',
    shopName: 'CỬA HÀNG MỸ PHẨM LAVINA',
    senderAddress: '85 Nguyễn Trãi, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh',
    orderCode: 'SHP261011C47',
    mainProduct: 'SON TINT CAO CẤP & KEM CHỐNG NẮNG SPF50',
    totalQuantity: 2,
    totalAmount: 126000,
    carrier: 'Shopee Express (SPX)',
    payment: 'Thanh toán khi nhận hàng (COD)',
    instruction: 'Được đồng kiểm',
    deliveryRoute: 'HN-12-08-LV22-H · E-LẠNH',
    items: [
      {
        productName: 'SON TINT CAO CẤP',
        image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=150&q=80',
        quantity: 1,
        price: 68000,
        variant: 'Màu đỏ cam'
      },
      {
        productName: 'KEM CHỐNG NẮNG SPF50',
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=150&q=80',
        quantity: 1,
        price: 58000,
        variant: 'Chống thấm nước 50ml'
      }
    ]
  }
};

const mapToFrontendOrder = (row) => {
  const trackingCode = row["Mã vận đơn"] || row.id || "";
  const hash = hashString(trackingCode);
  const demoPkg = DEMO_EXACT_PACKAGES[trackingCode];
  
  // Sinh dữ liệu fake nhất quán dựa vào mã vận đơn
  const isFakeMarket = !row["Sàn TMĐT"] || row["Sàn TMĐT"] === "Khác" || row["Sàn TMĐT"] === "";
  const market = isFakeMarket ? MARKETS[hash % MARKETS.length] : row["Sàn TMĐT"];
  
  const fakeProd = FAKE_PRODUCTS[hash % FAKE_PRODUCTS.length];
  const orderCode = row["Mã đơn hàng trên sàn"] || (demoPkg ? demoPkg.orderCode : ("ORD" + trackingCode.substring(0, 6).toUpperCase()));
  const shopName = demoPkg ? demoPkg.shopName : "Gian hàng chính hãng";
  const mainProductName = demoPkg ? demoPkg.mainProduct : fakeProd.name;

  let qty = row["Tổng số sản phẩm"] || (demoPkg ? demoPkg.totalQuantity : 1);
  let amt = row["Tổng tiền đơn"] || (demoPkg ? demoPkg.totalAmount : (fakeProd.price * qty));

  const items = demoPkg ? demoPkg.items : [{
    productName: fakeProd.name,
    image: fakeProd.image,
    quantity: qty,
    price: fakeProd.price,
    variant: "Tiêu chuẩn"
  }];

  return {
    orderId: row["ID nội bộ PICKO"] || row.id, // Fallback dùng uuid
    marketplace: market,
    shopName: shopName,
    senderAddress: demoPkg ? demoPkg.senderAddress : "",
    recipient: demoPkg ? demoPkg.recipient : (row["Tên người nhận"] || "Cư dân"),
    phone: demoPkg ? demoPkg.phone : (row["Số điện thoại"] || "09********"),
    address: demoPkg ? demoPkg.address : (row["Địa chỉ nhận"] || `Căn hộ ${row["Số căn hộ"] || "1204"}`),
    instruction: demoPkg ? demoPkg.instruction : "Được đồng kiểm",
    deliveryRoute: demoPkg ? demoPkg.deliveryRoute : "",
    orderCode: orderCode,
    trackingCode: trackingCode,
    carrier: demoPkg ? demoPkg.carrier : "Giao hàng chuẩn", 
    payment: demoPkg ? demoPkg.payment : "Đã thanh toán trước",
    status: row["Trạng thái đơn trên sàn"] || "Giao thành công",
    
    // Ánh xạ trạng thái trạm PICKO thành enum tiếng Anh mà giao diện hiểu
    stationStatus: mapStationStatus(row["Trạng thái tại trạm PICKO"]),
    
    apartment: row["Số căn hộ"] || (demoPkg ? demoPkg.apartment : "1204"),
    residentId: row["ID cư dân"] || "",
    totalQuantity: qty,
    totalAmount: amt,
    amount: amt,
    createdAt: row["Thời gian đặt đơn"] || row.created_at,
    updatedAt: row["Cập nhật gần nhất"] || row.created_at,
    product: mainProductName,
    productName: mainProductName,
    items: items
  };
};

const mapStationStatus = (vietnameseStatus) => {
  switch (vietnameseStatus) {
    case 'Hàng đã được giao đến trạm':
      return 'AT_STATION';
    case 'Đang yêu cầu lấy hàng':
      return 'PICKUP_REQUESTED';
    case 'Đã nhận':
      return 'RECEIVED';
    case 'Chưa nhận':
    default:
      return 'NOT_ARRIVED';
  }
};

module.exports = {
  mapToFrontendOrder
};
