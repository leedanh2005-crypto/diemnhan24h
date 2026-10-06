# Execution

Thư mục chứa các Python scripts — công cụ thực thi deterministic.

## Quy tắc
- Mỗi script xử lý **một nhiệm vụ cụ thể** (API calls, data processing, file operations)
- Scripts phải **deterministic** — cùng input cho cùng output
- Comment đầy đủ, dễ test, dễ debug
- Đọc config/secrets từ `.env`, KHÔNG hardcode
- Kiểm tra `execution/` trước khi viết script mới — tránh trùng lặp

## Cấu trúc tên file
- `snake_case.py`
- Tên mô tả rõ chức năng, ví dụ: `scrape_single_site.py`, `export_to_sheets.py`
