# THÔNG BÁO

## Dự án này

Mã nguồn gốc trong kho lưu trữ này (logic trò chơi, bộ điều hợp
(adapter), máy chủ, hình ảnh overlay và kết xuất (rendering), chủ đề
(theme), kiểm thử và tài liệu) là tác phẩm gốc, được cấp phép theo
GNU Affero General Public License v3.0. Xem LICENSE để đọc toàn văn.
Không sao chép thương hiệu, logo hay thành phần giao diện nào của
TikTok. Toàn bộ hình ảnh, tên gọi và cơ chế trò chơi đều là sáng
tạo gốc.

## Tệp âm thanh — giấy phép riêng của chúng (không phải AGPL)

Các tệp âm thanh trong `assets/audio/` là tác phẩm của bên thứ ba và
giữ giấy phép riêng của chúng: năm đoạn nhạc nền là của Kevin MacLeod
(incompetech.com) theo giấy phép CC BY 3.0, và bốn hiệu ứng âm thanh
lấy từ gói Interface Sounds của Kenney theo giấy phép CC0 1.0. Thông
tin ghi công đầy đủ, URL nguồn, ghi chú thay đổi theo từng tệp và mã
kiểm tra (checksum) có trong `assets/audio/ATTRIBUTION.md` và
`assets/audio/MANIFEST.json`, và các mục âm thanh được liệt kê trong
THIRD-PARTY-LICENSES.md. Không có âm thanh nào trong gói này được tổng
hợp hay tạo ra bằng mã nguồn.

## Thư viện sự kiện — AGPL-3.0 đã sửa đổi (đã xác minh trong các phiên bản đã ghim)

Dự án này phụ thuộc, ở dạng không sửa đổi và dưới dạng các gói npm
đã ghim phiên bản, vào:

- `tiktok-live-connector` 2.5.0 (kho lưu trữ (repository):
  https://github.com/zerodytrash/TikTok-Live-Connector, trường giấy
  phép (license field) trên npm là `AGPL-3.0-only`)
- `tiktok-live-proto` 0.2.4 (kho lưu trữ (repository):
  https://github.com/isaackogan/TikTok-Webcast-Protobuf, trường giấy
  phép (license field) trên npm là `AGPL-3.0-only`)

**Đã xác minh ngày 2026-11-19:** tệp LICENSE đi kèm trong mỗi gói đã
cài đặt đã được đọc toàn văn (mỗi tệp 720 dòng; hai tệp giống hệt nhau
từng byte). Cả hai đều là văn bản GNU AGPL-3.0 kèm theo mục
"Additional Permissions & Exceptions (Pursuant to Section 7)":

- **Section 18 (Library Integration Permissions)** cho phép liên kết,
  nhập (import) hoặc tích hợp chương trình vào các tác phẩm phái sinh,
  kể cả tác phẩm thương mại, mà không cần áp dụng AGPL-3.0, và nêu rõ
  tên các dịch vụ overlay TikTok LIVE, trò chơi TikTok LIVE và bot
  stream TikTok LIVE — với điều kiện Section 19 không bị kích hoạt.
- **Section 19 (WebSocket Servers, SaaS APIs, and Cloud Hosting
  Restrictions)** thu hồi ngoại lệ đó khi chương trình vận hành một
  nền tảng SaaS thương mại, mã nguồn đóng hoặc được lưu trữ (hosted)
  (bao gồm dịch vụ chuyển tiếp websocket, API thu thập dữ liệu
  (data-scraping API) hoặc giải pháp lưu trữ được quản lý (managed
  hosting solution) cung cấp cho bên thứ ba) mà không công khai toàn
  bộ mã nguồn phía máy chủ theo AGPL-3.0.
- **Section 20** thu hồi các quyền bổ sung khi không tuân thủ.
- **Section 21 (Excepted Parties)** miễn trừ TikFinity / STV GmbH và
  Euler Stream Inc. khỏi các hạn chế của Section 19.

Dự án này là một chương trình cục bộ dành cho một streamer duy nhất,
không phải dịch vụ được lưu trữ (hosted service), và mã nguồn gốc của
chính dự án được cấp phép AGPL-3.0, tương thích với cả hai cách hiểu
về Section 18/19. Bản sao nguyên văn của tệp LICENSE của cả hai thư
viện được đính kèm trong `licenses/`:
`licenses/tiktok-live-connector-LICENSE.txt` và
`licenses/tiktok-live-proto-LICENSE.txt`. Các thư viện được sử dụng ở
dạng không sửa đổi; không có mã nguồn thư viện nào được sao chép vào
kho lưu trữ này.

**Ghi chú về sự không khớp:** một bản tóm tắt nghiên cứu trước đó mô
tả các tệp LICENSE này có 1,095 dòng. Các tệp trong các phiên bản đã
ghim đã cài đặt có 720 dòng. Nội dung thực chất của Section 18/19/21
khớp với mô tả trong nghiên cứu; chỉ số dòng là khác nhau. Hãy đọc lại
LICENSE trong bất kỳ phiên bản nào trước khi nâng cấp dependency đã
ghim.

**Đây không phải là tư vấn pháp lý.** Hãy xin ý kiến rà soát pháp lý
trước bất kỳ việc sử dụng dự án này hoặc các thư viện sự kiện nào dưới
dạng hosted, đa streamer hoặc thương mại mã nguồn đóng.

## Dependency trực tiếp khác

- `ws` 8.23.0, giấy phép MIT (kho lưu trữ (repository):
  https://github.com/websockets/ws). Toàn văn trong
  `licenses/ws-LICENSE.txt`.

## Dependency bắc cầu (transitive dependencies)

Toàn bộ cây dependency đã ghim (60 gói, lấy từ `package-lock.json`)
kèm mã định danh giấy phép được liệt kê trong THIRD-PARTY-LICENSES.md.
Tất cả các gói bắc cầu, ngoại trừ hai gói AGPL-3.0-only nêu trên, đều
sử dụng giấy phép khoan dung (permissive) (MIT, BSD, Apache-2.0, 0BSD,
CC0-1.0 hoặc kép MIT/CC0). Client ký của Euler Stream mà thư viện sự
kiện sử dụng (`tiktok-live-api-sdk` 0.4.0-beta1, MIT) cũng có trong
danh sách đó; xem README để biết thông tin công bố về việc ký bởi bên
thứ ba.
