# BÁO CÁO KIỂM THỬ — TikTok LIVE Games

Ngày: 2026-11-19. Môi trường: Node.js v24.22.1, npm 10.9.4, Linux.
Lệnh: `npm test` (trình chạy kiểm thử tích hợp sẵn của Node, không dùng framework kiểm thử).
Kiểm thử tải kéo dài (soak): `npm run soak` (xem các mục Soak).

## Tóm tắt

- **141 kiểm thử tự động, 141 đạt, 0 lỗi** (12 tệp kiểm thử): 132
  kiểm thử dưới đây cộng thêm 9 kiểm thử mới từ vòng sửa lỗi theo
  đánh giá vòng 2 của Claude (5 kiểm thử về trạng thái game: hậu tố
  tên trùng, hậu tố sau khi khởi động lại, !hide giữa các tên trùng,
  !hide sau khi khởi động lại, gắn lại (rebind) khi tặng quà; 1 kiểm thử
  quét câu chữ kêu gọi hành động (CTA); 2 kiểm thử chống nhấp nháy;
  1 kiểm thử hiển thị văn bản toast). Các khẳng định (assertion) về
  bố cục chân trang (footer) và tái tạo câu chữ đã được
  cập nhật, không bị bỏ: chân trang nay còn có thêm dòng ghi công
  nhạc trên màn hình, và các kiểm thử xác minh câu chữ chính xác bằng
  cách tái tạo lại.
- **Kiểm thử tự động không thay thế kiểm tra thực tế.** 141/141 đạt
  nghĩa là bộ kiểm thử tự động đạt — đó không phải là bằng chứng game
  đã được xác minh đầy đủ. Việc kiểm tra trên trình duyệt/OBS thực tế,
  việc kiểm tra kết nối trực tiếp (live), và lần chạy 8 giờ trong mục
  "CHƯA kiểm thử" vẫn còn bỏ ngỏ. Các lần soak 15 phút chạy ở tốc độ
  khoảng 5 sự kiện mỗi giây; tải đó **không** đại diện cho các đợt
  spam dồn dập hay các lần chạy 8 giờ.
- Cả 5 biến thể đều hoàn chỉnh và đã được kiểm thử (không biến thể nào bị cắt).
- Bộ chuyển đổi trực tiếp (live adapter): **CHƯA XÁC MINH (UNVERIFIED)** — chỉ được kiểm thử với một connector giả lập (mocked connector).
- `npm audit` **không** chạy được trong môi trường build (xem bên dưới).
- Không có lần soak 8 giờ nào được chạy. Các lần soak dưới đây là các lần soak thực tế đã thực hiện.
- Kiểm tra nghe-nhìn trên trình duyệt/OBS thực tế: **CHƯA THỰC HIỆN** — vẫn cần streamer thực hiện (xem mục "CHƯA kiểm thử").

## Vòng bổ sung âm thanh + hình ảnh (2026-11-19)

### Danh mục âm thanh (các tệp đã xác minh, đều là bản ghi thật)

Tổng âm thanh: **5,247,058 bytes (~5.0 MiB)**, dưới ngân sách ~15 MB.
Mọi tệp đều đã được xác minh bằng ffprobe (thời lượng, codec, giải mã
sạch) và kiểm tra độ lớn âm thanh; mức trung bình (mean) của nhạc nền (BGM)
nằm trong khoảng −18.1 đến −20.5 dB với đỉnh ở mức −1.3 dB trở xuống
(không bị vỡ tiếng/clipping). Mã kiểm tra (checksum) trong
`assets/audio/MANIFEST.json`; nguồn và giấy phép trong
`assets/audio/ATTRIBUTION.md`.

| Tệp | Nguồn | Giấy phép | Kích thước | Thời lượng |
|---|---|---|---|---|
| `bgm-lake.mp3` | "Meditation Impromptu 01", Kevin MacLeod (incompetech.com) | CC BY 3.0 | 1,041,687 B | 65.0 s |
| `bgm-garden.mp3` | "Cherry Blossom", Kevin MacLeod (incompetech.com) | CC BY 3.0 | 1,041,645 B | 65.0 s |
| `bgm-observatory.mp3` | "Frozen Star", Kevin MacLeod (incompetech.com) | CC BY 3.0 | 1,041,645 B | 65.0 s |
| `bgm-cafe.mp3` | "Memory Lane", Kevin MacLeod (incompetech.com) | CC BY 3.0 | 1,041,606 B | 65.0 s |
| `bgm-sky.mp3` | "Clear Air", Kevin MacLeod (incompetech.com) | CC BY 3.0 | 1,041,646 B | 65.0 s |
| `sfx-follow.ogg` | `confirmation_001`, Kenney Interface Sounds 1.0 | CC0 1.0 | 8,968 B | 0.29 s |
| `sfx-gift.ogg` | `glass_004`, Kenney Interface Sounds 1.0 | CC0 1.0 | 8,323 B | 0.69 s |
| `sfx-milestone.ogg` | `confirmation_002`, Kenney Interface Sounds 1.0 | CC0 1.0 | 14,169 B | 0.54 s |
| `sfx-command.ogg` | `toggle_001`, Kenney Interface Sounds 1.0 | CC0 1.0 | 7,369 B | 0.14 s |

Các tệp BGM là đoạn trích 65 giây (đã làm mờ dần (fade) + cân bằng mức
âm lượng; các thay đổi được ghi lại theo từng tệp trong manifest, như
CC BY 3.0 yêu cầu). Các tệp SFX là các thành viên Kenney nguyên bản,
không chỉnh sửa, chỉ đổi tên cho rõ ràng. Giấy phép của từng bản nhạc
đã được xác minh trên trang tệp Wikimedia Commons của nó (trang này
tái hiện danh mục incompetech và văn bản CC BY 3.0); giấy phép CC0
của Kenney đã được xác minh cả trên trang gói âm thanh và trong tệp
`License.txt` đi kèm trong tệp zip đã tải xuống. Mixkit đã được đánh
giá và loại bỏ: giấy phép của Mixkit cấm phân phối lại kèm theo tệp
nguồn và loại trừ trò chơi điện tử (video games). Không có âm thanh
nào được tổng hợp hay tạo ra bằng mã.

### Kiểm thử mới (31)

| Lĩnh vực | Kiểm thử | Kết quả |
|---|---|---|
| Xác thực manifest (tồn tại, định dạng, kích thước hợp lý, tổng < 15 MB) | `test/audio.test.js` | Đạt |
| Mã kiểm tra SHA-256 trong manifest khớp với các tệp trên đĩa | `test/audio.test.js` | Đạt |
| Thời lượng vòng lặp/hiệu ứng hợp lý (30–90 giây / < 2 giây) | `test/audio.test.js` | Đạt |
| Mỗi chủ đề có một vòng lặp BGM riêng; mỗi loại hiệu ứng đều được ánh xạ | `test/audio.test.js` | Đạt |
| Các hàm trợ giúp ánh xạ dự phòng an toàn; toast vẫn im lặng | `test/audio.test.js` | Đạt |
| Chuẩn hóa cài đặt (mặc định, giới hạn (clamping), ép kiểu (coercion), khóa không xác định) | `test/audio.test.js` | Đạt |
| Quét chống tổng hợp trên `src/`, `public/`, `scripts/`; overlay dùng `new Audio()` | `test/audio.test.js` | Đạt |
| Tính đầy đủ của ghi công (giấy phép/tác giả/nguồn/thay đổi cho mỗi tệp) | `test/audio.test.js` | Đạt |
| Các route HTTP âm thanh (manifest, tệp, byte ranges, `/audio.js`) | `test/audio.test.js` | Đạt |
| Các route âm thanh từ chối tệp không xác định và các lần cố gắng truy cập trái phép qua đường dẫn (traversal) | `test/audio.test.js` | Đạt |
| Thiếu âm thanh: các route trả về 404, trạng thái báo không khả dụng, game vẫn chạy | `test/audio.test.js` | Đạt |
| `setAudio` hợp nhất các cài đặt đã xác thực, phát tới overlay + control | `test/audio.test.js` | Đạt |
| Script tải về có thể thực thi, xác minh mã kiểm tra, không có nguồn bị từ chối | `test/audio.test.js` | Đạt |
| Hồ sơ chuyển động (motion profiles) (đầy đủ so với giảm chuyển động) | `test/visual.test.js` | Đạt |
| Vị trí các spot đứng yên khi hệ số chuyển động bằng 0 | `test/visual.test.js` | Đạt |
| Giảm chuyển động: tên, thanh đo (meter), thông tin công bố giống hệt (cả 5 chủ đề) | `test/visual.test.js` | Đạt |
| Giảm chuyển động vẽ ít hình dạng hạt (particle) hơn (cả 5 chủ đề) | `test/visual.test.js` | Đạt |
| Giảm chuyển động hiển thị được ở cả 7 giai đoạn của thanh đo (cả 5 chủ đề) | `test/visual.test.js` | Đạt |
| Hiệu ứng xuất hiện: chuyển động đầy đủ có vòng + bay lên, giảm chuyển động chỉ mờ dần tại chỗ | `test/visual.test.js` | Đạt |
| Chân trang (footer): mọi dòng đều nằm trong bảng, câu chữ chính xác được giữ nguyên (cả 5 chủ đề) | `test/visual.test.js` | Đạt |

### Thay đổi hình ảnh trong vòng này

- **Tất cả các chủ đề:** ba lớp dãy núi có hiệu ứng thị sai (parallax) (trước đây là một lớp), tia sáng chậm từ thiên thể, hiệu ứng ánh sáng theo giai đoạn, hình các spot phong phú hơn (cần câu/phao/gợn sóng, cỏ/nụ/đom đóm bay quanh, vòng quỹ đạo/lấp lánh, râu ria/hơi nước/đĩa lót, cờ đuôi bện/bao cát), hiệu ứng xuất hiện khi follow mượt hơn (bay lên + quầng sáng + vòng), bảng màu tinh chỉnh qua các khóa tùy chọn mới (`farHill`, `midHill`, `glow`, `foreground`, `cloud`) kèm giá trị dự phòng (fallback).
- **Sunrise Lake:** cột ánh sáng mặt trời phản chiếu lấp lánh trên mặt nước, lá sen, bóng ván cầu tàu, lau sậy ở tiền cảnh, sương sớm tan dần.
- **Firefly Garden:** bóng cây ở đường chân trời, mô đất, bụi cỏ, tia lấp lánh của sương từ giai đoạn 2, bóng hoa ở tiền cảnh.
- **Starlight Observatory:** dải Ngân Hà từ giai đoạn 3, mái vòm có khe sáng, bóng kính thiên văn, ánh tím ban đêm ở các giai đoạn cuối.
- **Cozy Corner Cafe:** dây đèn dưới cửa sổ camera, ván sàn, thảm, chậu cây, chồng sách, vùng sáng nến.
- **Balloon Sky:** hai dải mây trôi, chim ở xa từ giai đoạn 4, gò đồi có cây, mây ở tiền cảnh, cầu vồng ở giai đoạn 6.
- **Giảm chuyển động (reduced motion):** công tắc trong bảng điều khiển (control panel) + tôn trọng `prefers-reduced-motion` của hệ điều hành; ít hạt hơn, không trôi, không có sao băng, hiệu ứng xuất hiện chỉ mờ dần; tên/thanh đo/thông tin công bố không thay đổi.

### Xác minh script tải về (fetch script)

`scripts/fetch-audio.sh` đã được kiểm thử theo hai cách: (1) tại chỗ, cả 9
tệp đã có sẵn → tất cả đều được bỏ qua vì đã xác minh, mã thoát 0; (2) phòng
sạch (clean room) (thư mục trống + chỉ có manifest) → tải xuống cả 5 bản
gốc từ incompetech.com (mã kiểm tra SHA-256 của nguồn đã xác minh), cắt
ngắn bằng ffmpeg, tái hiện quy trình tải liên kết có chữ ký (signed-link)
của Kenney (mã kiểm tra SHA-256 của tệp zip đã xác minh), giải nén 4 thành
viên — cả 9 tệp tái tạo đều **giống hệt từng byte** với các tệp đã giao
trên bản build ffmpeg của máy này. (Việc mã hóa lại MP3 có thể khác nhau
từng byte giữa các bản build ffmpeg; script xác minh chặt chẽ các bản
gốc đã tải xuống và xác minh các đầu ra đã cắt ngắn theo thời lượng +
khả năng giải mã, đồng thời cảnh báo khi mã kiểm tra bị lệch.)

## Vòng sửa lỗi theo đánh giá vòng 2 của Claude (2026-11-19)

Kết luận vòng 2 của Claude là **CHƯA DUYỆT** (không phê duyệt), còn
5 mục nhỏ. Claude chỉ xem xét một bản tóm tắt bằng văn bản, không xem
mã, vì vậy từng điểm đều được đối chiếu với mã/tài liệu thực tế trước;
hai điểm phụ trong đó hóa ra đã hoàn thành. Những gì đã thay đổi:

| Mục của Claude | Kết luận | Nội dung đã thực hiện |
|---|---|---|
| (1) Tên hiển thị trùng nhau | Đã sửa | Các spot nay mang một `baseName` cộng với một `displayName` có hậu tố: người xem đầu tiên giữ tên trần, các người xem cùng tên sau đó hiển thị "Name 2", "Name 3" (xác định theo phiên, ổn định sau khi khởi động lại — tên có hậu tố được lưu trong bản chụp nhanh (snapshot)). Danh tính vẫn dựa theo id người xem. Hạn chế, nêu trung thực: sau khi khởi động lại, chỉ riêng tên không thể phân biệt hai người xem cùng tên, vì vậy một người xem cùng tên quay lại sẽ gắn lại (rebind) vào spot cùng tên chưa được gắn sớm nhất (theo thứ tự slot). |
| (2) Ghi công CC BY trên màn hình | Đã sửa | Chân trang nay vẽ dòng "Music: Kevin MacLeod (incompetech.com), CC BY 3.0" làm dòng cuối cùng (hình học chân trang đã kiểm tra lại: mọi dòng vẫn vừa trong bảng ở kích thước 1080×1920). README cũng hướng dẫn streamer đặt cùng dòng đó trong phần mô tả LIVE, và cảnh báo rằng CC BY không ngăn được hệ thống kiểm tra nội dung tự động của TikTok gắn cờ nhạc. |
| (3) Kiểm tra trên trình duyệt thực + nghe SFX | Chỉ streamer làm được, vẫn còn bỏ ngỏ | Không thể thực hiện trong môi trường build (không có trình duyệt/OBS trực tiếp, không có tai nghe). Đã thêm "Danh sách kiểm tra diễn tập (Rehearsal checklist)" vào README, liệt kê chính xác những gì streamer phải làm: xem cả 5 chủ đề trên trình duyệt thực, nghe cả 4 SFX, kiểm tra định tuyến âm thanh/bộ trộn (mixer) của OBS, kiểm tra khả năng đọc của chân trang, theo dõi hiện tượng nhấp nháy, chạy `npm audit`. |
| (4) npm audit | Đã thử lại, vẫn bị chặn | Đã thử lại ngày 2026-11-19: vẫn lỗi HTTP 403 `policy_denied`. Không khẳng định có kết quả nào. README/TEST-REPORT vẫn giữ hướng dẫn chạy lệnh này trên máy của chính streamer trước lần dùng trực tiếp đầu tiên. |
| (5) Hành vi sau 48 spot đã được công bố | Đã sửa | Toast tràn nay ghi "All 48 spots are full — thank you!" (hiển thị từ chính văn bản của toast, không phải từ dòng cảm ơn chung). Mục dung lượng (capacity) trong README mô tả chính xác những gì người follow thứ 49 nhìn thấy. |

Các điểm khác của Claude, đã xác minh trước:

- **Quét CTA:** kiểm thử từ cấm trước đây chỉ bao phủ các chuỗi của chủ đề.
  Đã mở rộng thành tệp `test/cta-scan.test.js` chuyên biệt, quét mọi chuỗi
  giao diện người dùng (UI) (chuỗi chủ đề, thông tin công bố, ghi công nhạc,
  văn bản hiển thị của bảng điều khiển, trang overlay, và các chuỗi ký tự
  (string literal) trong `control.js` / `overlay.js` / `render.js`) để tìm
  các mẫu kêu gọi hành động (CTA)/giải thưởng/gây áp lực. Các thẻ kích hoạt
  của Simulator/Manual được loại khỏi phạm vi quét: nhãn của chúng
  ("Send gift", "Fake follow") là các nút mà streamer bấm, không bao giờ
  là câu chữ hiển thị cho người xem. Một dòng nhật ký chẩn đoán
  ("streak partials skipped") đã được viết lại thành "partial gifts
  skipped" để không còn ngôn ngữ về streak trong bất kỳ chuỗi giao diện người dùng nào.
- **!hide sau khi khởi động lại:** thực sự bị lỗi và đã sửa. Spot được
  khôi phục vẫn giữ cờ ẩn, nhưng tập hợp chuyển đổi (toggle set)
  `hiddenUsers` trong bộ nhớ trống sau khi khởi động lại, vì vậy lệnh
  `!hide` đầu tiên lại ẩn thay vì bỏ ẩn. Việc gắn một spot đã khôi phục
  nay gắn lại lựa chọn ẩn vào id người xem. Các spot đã khôi phục cũng
  gắn lại trên BẤT KỲ sự kiện nào (follow, lệnh, quà tặng), không chỉ
  khi follow lại. Hạn chế: một lệnh ẩn thực hiện *trước khi từng follow*
  (chưa có spot nào tồn tại) sẽ không tồn tại sau khi khởi động lại — id
  người dùng không bao giờ được ghi ra đĩa, nên không có gì để gắn lại.
- **Công bố Euler khi khởi động live:** README đã công bố điều này;
  tiêu đề bảng điều khiển đã công bố giao diện không chính thức nhưng
  không nêu tên Euler. Đã bổ sung: một câu về Euler trong cảnh báo
  luồng trực tiếp (live-feed) của bảng điều khiển, và một dòng công bố
  Euler trong nhật ký khởi động máy chủ khi `MODE=live`.
- **Trỏ tới AGPL:** LICENSE, `licenses/`, NOTICE.md và
  THIRD-PARTY-LICENSES.md đều đã có và đúng (đã xác minh).
  Mục Giấy phép (License) trong README nay nêu rõ cách lấy mã nguồn
  (toàn bộ mã nguồn đi kèm trong tệp zip trên Drive / kho lưu trữ (repository)).
- **Tính hiển thị của sự đồng ý về rủi ro (risk consent):** đã hoàn thành
  — tiêu đề bảng điều khiển đã có dòng đồng ý về rủi ro ngắn (người sáng
  tạo phải ở trên camera; giao diện không chính thức bị điều khoản của
  TikTok cấm; xem phần đồng ý về rủi ro trong README). Đã xác minh,
  không thay đổi.
- **Âm lượng:** BGM mặc định giảm từ 40% → 30% (rõ giọng nói và đỡ mỏi
  tai khi lặp nhiều giờ); SFX giữ ở 70%; nút tắt tiếng vẫn nổi bật.
  Đã ghi trong README.
- **fetch-audio.sh đóng khi lỗi (fail-closed):** đã xác minh bằng kiểm tra
  — một tệp zip Kenney không khớp sẽ dừng trước khi giải nén, một bản
  gốc incompetech không khớp sẽ dừng trước khi cắt ngắn, và `curl -f` /
  `set -e` sẽ dừng khi tải xuống thất bại. Một lỗ hổng đã được tìm thấy
  và sửa: một tệp đã cắt ngắn bị lỗi (thời lượng/giải mã không tốt)
  hoặc một thành viên SFX không khớp trước đây vẫn bị để lại trên đĩa,
  nơi máy chủ có thể phục vụ nó; script nay xóa mục tiêu khi bất kỳ
  lần xác minh nào thất bại. Kiểm thử đường dẫn lỗi: chạy trên một
  thư mục tạm với một manifest mang các giá trị SHA-256 cố ý sai — script
  thoát với mã 1 và không để lại tệp lỗi nào (xem bên dưới).
- **Nhấp nháy:** đã kiểm tra mọi dao động độ sáng theo thời gian trong
  `render.js`. Nhanh nhất là hiệu ứng nhấp nháy (twinkle) của hạt:
  `sin(wt * 1.4 * speed)` với speed ≤ 1.0 → chu kỳ ≥ 4.5 giây (0.22/giây).
  Chu kỳ đu đưa/lắc/hơi nước/nước ở trạng thái chờ (idle) đều ≥ 4.4 giây;
  các biểu ngữ theo giai đoạn của thanh đo/toast và hiệu ứng xuất hiện
  khi follow là các lần mờ dần hình sin một nửa (half-sine) trong
  2.6–3.2 giây, không bao giờ là chớp lặp lại; sao băng xuất hiện một
  lần mỗi 16 giây. Không có gì gần 3 lần nhấp nháy/giây. Các kiểm thử
  mới cố định giới hạn tốc độ hạt và khẳng định văn bản đã vẽ không bao
  giờ nhấp nháy trong 96 khung hình của cảnh bận rộn nhất.

### Kiểm thử mới (9)

| Lĩnh vực | Kiểm thử | Kết quả |
|---|---|---|
| Các tên trùng nhận hậu tố "Name 2", "Name 3"; danh tính vẫn dựa theo id người xem | `test/gameState.test.js` | Đạt |
| Hậu tố tồn tại sau khi lưu/khôi phục snapshot; người xem cùng tên mới thứ ba nhận "Name 3" | `test/gameState.test.js` | Đạt |
| `!hide` nhắm đúng người xem giữa các tên trùng | `test/gameState.test.js` | Đạt |
| `!hide` tồn tại sau khi khởi động lại nhờ gắn lại bằng lệnh; bỏ ẩn hoạt động sau khi khởi động lại | `test/gameState.test.js` | Đạt |
| Quà tặng gắn lại một spot đã khôi phục sau khi khởi động lại | `test/gameState.test.js` | Đạt |
| Toast tràn ghi "All 48 spots are full — thank you!" | `test/gameState.test.js` | Đạt |
| Quét câu chữ CTA/giải thưởng/gây áp lực trên mọi chuỗi giao diện người dùng | `test/cta-scan.test.js` | Đạt |
| Không nhấp nháy: giới hạn chu kỳ twinkle + văn bản đã vẽ ổn định trong 96 khung hình | `test/visual.test.js` | Đạt |
| Toast hiển thị văn bản tường minh của nó, hoặc văn bản cảm ơn dự phòng | `test/render.test.js` | Đạt |

### Kiểm thử đường dẫn lỗi của fetch script

Thư mục tạm + một bản sao của manifest với các giá trị SHA-256 cố ý
sai cho một tệp BGM (sai `sourceSha256`) và một tệp SFX (sai `sha256`
của tệp): script đã tải xuống các bản gốc, báo cả hai lần không khớp,
thoát với mã 1, và **không** để lại tệp lỗi nào trong thư mục đích.
(Hai lần tải xuống là cùng các nguồn mà lần tải lại trong phòng sạch
đã dùng; không có hoạt động mạng nào khác.)

### Một lần kiểm thử lỗi thoáng qua (không tái hiện được)

Trong vòng này, một lần chạy toàn bộ bộ kiểm thử cho thấy một lỗi duy
nhất trong `test/adapters.test.js` ("live adapter backs off and pauses…",
`delays.includes(5000)` tại dòng 159) — một khẳng định nhạy cảm với thời
gian về khoảng chờ 60 ms trong thời gian thực. Nó đã đạt trong lần chạy
ngay trước đó và trong ba lần chạy toàn bộ liên tiếp sau đó (mỗi lần
141/141). Không có thay đổi mã nào đối với adapter; ghi lại ở đây như
một lỗi không ổn định (flake), không phải một bản sửa.

## Kết quả V1 (không thay đổi)

Bộ kiểm thử V1 dưới đây vẫn đạt không thay đổi (99/99).

## Kết quả lõi dùng chung (shared-core)

| Lĩnh vực | Kiểm thử | Kết quả |
|---|---|---|
| Chuẩn hóa sự kiện (loại, msgId, giới hạn (caps), repeatEnd) | `test/events.test.js` (5) | Đạt |
| Loại trùng theo id tin nhắn (message-id dedupe) (loại bỏ FIFO) | `test/dedupeReconnect.test.js` | Đạt |
| Lùi lại khi kết nối lại (reconnect backoff) + jitter + cầu dao (circuit breaker) | `test/dedupeReconnect.test.js` | Đạt |
| Khoảng cách hàng đợi hoạt ảnh (animation queue), mức ưu tiên, chính sách loại bỏ | `test/dedupeReconnect.test.js` | Đạt |
| Lọc tên hiển thị (ký tự hai chiều (bidi), zalgo, emoji, thông tin cá nhân (PII), mạo danh, từ cấm) | `test/nameFilter.test.js` (9) | Đạt |
| Quy tắc follow 1 spot, follow trùng, toast tràn dung lượng | `test/gameState.test.js` | Đạt |
| Lệnh: lệnh không xác định bị bỏ qua, thời gian chờ (cooldown), 1 lệnh chờ xử lý mỗi người xem | `test/gameState.test.js` | Đạt |
| `!hide` chuyển đổi tức thì, miễn thời gian chờ, ẩn trước khi follow | `test/gameState.test.js` | Đạt |
| Delta lượt thích (like) từ tổng số, xử lý đặt lại (reset), giới hạn lô (batch cap) | `test/gameState.test.js` | Đạt |
| Các ngưỡng của thanh đo (meter) kích hoạt mỗi ngưỡng một lần | `test/gameState.test.js` | Đạt |
| Quà tặng chỉ tính khi kết thúc chuỗi (streak-end-only), ánh xạ xác định, mặc định khi không xác định, giới hạn trang trí | `test/gameState.test.js` | Đạt |
| Đổi chủ đề giữ các spot/thanh đo, xóa hàng đợi, áp dụng lệnh mới | `test/gameState.test.js` | Đạt |
| Khôi phục snapshot + gắn lại theo tên đã lọc | `test/gameState.test.js` | Đạt |
| Khôi phục snapshot từ chối chủ đề không xác định, giới hạn/loại trùng các slot | `test/gameState.test.js` | Đạt |
| Các bản tin phát (broadcast)/snapshot không chứa id người dùng hay văn bản thô | `test/gameState.test.js` | Đạt |
| Chia sẻ/tham gia không có tác dụng | `test/gameState.test.js` | Đạt |
| Lưu/tải snapshot, hết hạn TTL, xử lý tệp hỏng/không hợp lệ, xóa | `test/snapshot.test.js` (4) | Đạt |
| Simulator + bộ chuyển đổi thủ công (manual adapter) dùng chung một giao diện đã chuẩn hóa | `test/adapters.test.js` | Đạt |
| Ánh xạ tin nhắn của live adapter (connector giả lập) | `test/adapters.test.js` | Đạt |
| Live adapter lùi lại/tạm dừng khi thất bại lặp lại (giả lập) | `test/adapters.test.js` | Đạt |
| Live adapter dừng sẽ ngắt kết nối; sendMessage không bao giờ được gọi | `test/adapters.test.js` | Đạt |
| Tùy chọn kết nối trực tiếp không chứa thông tin xác thực/mật khẩu (credentials/auth) | `test/adapters.test.js` | Đạt |
| Các route HTTP, xử lý 404/truy cập trái phép qua đường dẫn (traversal), endpoint kiểm tra sức khỏe (health endpoint) | `test/server.test.js` | Đạt |
| Snapshot qua WS khi kết nối + gửi lại sau khi kết nối lại | `test/server.test.js` | Đạt |
| Điều khiển qua WS: đổi chủ đề, dừng/tiếp tục (kill/resume), đặt lại (reset) | `test/server.test.js` | Đạt |
| Phát hoạt ảnh qua WS; yêu cầu chủ đề từ overlay | `test/server.test.js` | Đạt |

## Kết quả theo từng biến thể

Mọi biến thể đều đạt: bộ lệnh cố định gồm `!hide`, 6 ngưỡng của thanh
đo kèm nhãn giai đoạn, ánh xạ quà tặng xác định với một dự phòng mặc
định, danh từ của spot/cách hoạt động/bảng màu có mặt, hiển thị cảnh
trống, hiển thị cảnh có người (tên, thanh đo, thông tin công bố),
hiển thị khi tạm dừng/dừng, hiển thị mọi ký hiệu hiệu ứng quà tặng,
và hiển thị ở cả 7 giai đoạn của thanh đo (0–6). `!hide`, tiến trình
thanh đo và hiệu ứng trang trí của quà tặng đã được thử trên từng biến
thể thông qua trạng thái game dùng chung. Các kiểm tra câu chữ bị cấm
(kêu gọi hành động, ngôn ngữ giải thưởng/cờ bạc, ngôn ngữ tôn giáo,
áp lực giữ chân) đều đạt trên mọi chuỗi chủ đề hướng tới người dùng.

| Biến thể | Kiểm thử cấu hình | Kiểm thử hiển thị | Kiểm thử quy tắc game | Trạng thái |
|---|---|---|---|---|
| Sunrise Lake | Đạt | Đạt | Đạt | Hoàn thành |
| Firefly Garden | Đạt | Đạt | Đạt | Hoàn thành |
| Starlight Observatory | Đạt | Đạt | Đạt | Hoàn thành |
| Cozy Corner Cafe | Đạt | Đạt | Đạt | Hoàn thành |
| Balloon Sky | Đạt | Đạt | Đạt | Hoàn thành |

Không biến thể nào bị cắt. Cả năm biến thể đều sẵn sàng bàn giao dựa
trên các kiểm thử trên cộng với lần soak dưới đây (với điều kiện live
adapter CHƯA XÁC MINH và các mục chưa kiểm thử liệt kê ở cuối).

## Soak (tải kéo dài mô phỏng)

Lần chạy: `SOAK_MINUTES=15 node scripts/soak.js`, 2026-11-18 20:14–20:29 UTC
(03:14–03:29 +07). Máy chủ thật + trạng thái game + simulator adapter +
một client overlay qua WebSocket hiển thị mọi khung hình với một ngữ cảnh
canvas giả (stub canvas context) (thời gian khung hình dưới đây là chi phí
hiển thị phía JavaScript, **không phải** thời gian của trình duyệt/GPU).
Lưu lượng hỗn hợp mỗi 200ms (follow, lệnh, lô lượt thích kèm tổng số,
chuỗi quà tặng), thỉnh thoảng có đợt 120 follow dồn dập để gây áp lực
cho hàng đợi, đổi chủ đề mỗi 3 phút qua cả năm biến thể, bật lưu snapshot.

| Chỉ số | Thực tế |
|---|---|
| Thời lượng | 15 phút (thực tế, liên tục) |
| Số sự kiện được đưa vào (simulator ticks) | 4,496 |
| Số sự kiện đã chuẩn hóa mà trạng thái game nhận được | 14,182 (gồm các phần streak + đợt dồn dập) |
| Số sự kiện được áp dụng | 3,331 |
| Số lần loại bỏ khỏi hàng đợi (chính sách loại bỏ đã ghi, dưới tải dồn dập) | 5,645 |
| Số phần streak đã bỏ qua | 1,766 |
| Số follow trùng đã bỏ qua | 2,511 |
| Số toast cảm ơn khi tràn (vượt 48 spot) | 6,252 |
| Số tin nhắn WS mà client overlay nhận được | 5,182 |
| Số khung hình đã hiển thị (giới hạn 30fps) | 21,415 |
| Thời gian khung hình, ngữ cảnh giả (trung bình / p95 / tối đa) | 0.52ms / 0.66ms / 21.0ms |
| RSS lúc bắt đầu → lúc kết thúc | 65.7 MB → 58.3 MB |
| Heap lúc bắt đầu → lúc kết thúc | 9.6 MB → 16.3 MB |
| Số lần lưu snapshot | 1,330 |
| Các chủ đề đã thử | Cả 5 (đổi mỗi 3 phút) |
| Spot cuối cùng / thanh đo | 48 (giới hạn) / 58,792 |

Bộ nhớ theo từng phút (RSS MB / heap MB): 0: 65.7/9.6, 1: 88.6/13.6,
2: 90.1/13.7, 3: 96.1/13.3, 4: 96.2/15.6, 5: 85.7/11.4, 6: 88.9/12.4,
7: 89.6/11.3, 8: 90.1/12.2, 9: 91.6/13.9, 10: 65.6/11.7, 11: 54.2/11.8,
12: 53.6/16.7, 13: 56.3/16.3, 14: 57.3/13.8, 15: 58.3/16.3.

Nhận xét: không có tăng trưởng bộ nhớ đơn điệu trong 15 phút — RSS kết
thúc thấp hơn lúc bắt đầu, heap dao động trong khoảng 11–17 MB (hành vi
của bộ thu gom rác (GC)), và tiến trình vẫn phản hồi trong suốt thời gian
chạy. Điều này **không** chứng minh không có rò rỉ chậm trong nhiều giờ;
lần soak 8 giờ vẫn còn bỏ ngỏ (xem mục "CHƯA kiểm thử"). Số lần loại bỏ
khỏi hàng đợi và số toast tràn cao là các chính sách đã ghi đang hoạt động
dưới tải dồn dập cố ý gây ra, không phải lỗi: giới hạn hàng đợi được giữ,
các spot giới hạn ở 48, và không có lỗi nào bị ném ra. Toàn bộ số liệu
đọc được bằng máy: `soak-report.json` (tệp build bị git bỏ qua (git-ignored);
các số trên được sao từ đó).

## Soak chạy lại (vòng bổ sung)

Lần chạy: `SOAK_MINUTES=15 node scripts/soak.js`, 2026-11-18 21:03–21:18 UTC
(04:03–04:18 +07). Cùng bộ công cụ (harness) như lần soak V1 (máy chủ thật
+ trạng thái game + simulator adapter + client overlay qua WebSocket hiển
thị mọi khung hình với một ngữ cảnh canvas giả), nay với trình hiển thị
đã được làm phong phú. Thời gian khung hình là chi phí hiển thị phía
JavaScript, **không phải** thời gian của trình duyệt/GPU.

| Chỉ số | Thực tế |
|---|---|
| Thời lượng | 15 phút (thực tế, liên tục) |
| Số sự kiện được đưa vào (simulator ticks) | 4,495 |
| Số sự kiện đã chuẩn hóa mà trạng thái game nhận được | 14,181 (gồm các phần streak + đợt dồn dập) |
| Số sự kiện được áp dụng | 3,330 |
| Số lần loại bỏ khỏi hàng đợi (chính sách loại bỏ đã ghi, dưới tải dồn dập) | 5,642 |
| Số phần streak đã bỏ qua | 1,766 |
| Số follow trùng đã bỏ qua | 2,511 |
| Số toast cảm ơn khi tràn (vượt 48 spot) | 6,252 |
| Số tin nhắn WS mà client overlay nhận được | 5,178 |
| Số khung hình đã hiển thị (giới hạn 30fps) | 23,443 |
| Thời gian khung hình, ngữ cảnh giả (trung bình / p95 / tối đa) | 0.72ms / 0.87ms / 21.0ms |
| RSS lúc bắt đầu → lúc kết thúc | 66.6 MB → 76.7 MB |
| Heap lúc bắt đầu → lúc kết thúc | 9.3 MB → 13.1 MB |
| Số lần lưu snapshot | 1,329 |
| Các chủ đề đã thử | Cả 5 (đổi mỗi 3 phút) |
| Spot cuối cùng / thanh đo | 48 (giới hạn) / 58,792 |

Bộ nhớ theo từng phút (RSS MB / heap MB): 0: 66.6/9.3, 1: 89.4/12.5,
2: 91.3/13.4, 3: 93.7/13.0, 4: 62.3/10.6, 5: 61.6/12.7, 6: 58.7/12.5,
7: 63.9/14.2, 8: 64.1/14.5, 9: 71.3/14.5, 10: 72.1/14.3, 11: 72.1/13.7,
12: 72.6/14.9, 13: 64.1/19.5, 14: 76.2/13.7, 15: 76.7/13.1.

Nhận xét: không có tăng trưởng bộ nhớ đơn điệu — RSS và heap dao động
theo GC trong cùng các khoảng như lần soak V1, và tiến trình vẫn phản
hồi trong suốt thời gian chạy. Chi phí khung hình trung bình tăng từ
0.52ms lên 0.72ms với đồ họa phong phú hơn, vẫn thấp hơn nhiều so với
ngân sách khung hình 33ms. Điều này **không** chứng minh không có rò rỉ
chậm trong nhiều giờ; lần soak 8 giờ vẫn còn bỏ ngỏ (xem mục
"CHƯA kiểm thử"). Toàn bộ số liệu đọc được bằng máy: `soak-report.json`
(tệp build bị git bỏ qua (git-ignored); các số trên được sao từ đó).

## Xác minh giấy phép

- Các tệp LICENSE của `tiktok-live-connector` 2.5.0 và `tiktok-live-proto`
  0.2.4 đã được đọc đầy đủ từ các gói đã cài đặt: mỗi tệp 720 dòng,
  giống hệt từng byte, GNU AGPL-3.0 cộng Quyền Bổ sung (Additional
  Permissions) với Điều 18 (quyền liên kết, gồm game/overlay LIVE),
  Điều 19 (thu hồi đối với SaaS/lưu trữ (hosted)), Điều 20 (thu hồi khi
  không tuân thủ), và Điều 21 (TikFinity/STV GmbH và Euler Stream Inc.
  được ngoại lệ). Nội dung khớp với mô tả nghiên cứu trước đó; số dòng
  trong ghi chú nghiên cứu (1,095) khác với các tệp đã cài đặt (720).
  Các bản sao nguyên văn đi kèm trong `licenses/`. Xem NOTICE.md.
- `ws` 8.23.0: MIT. Danh mục đầy đủ các gói phụ thuộc gián tiếp (60 gói)
  trong THIRD-PARTY-LICENSES.md.

## npm audit — không chạy được

`npm audit` thất bại trong môi trường build: endpoint kiểm tra (audit)
của registry trả về HTTP 403 `policy_denied`
(`POST /-/npm/v1/security/audits/quick not permitted by policy`).
Đã thử lại ngày 2026-11-19 trong vòng sửa lỗi theo đánh giá vòng 2 của
Claude: vẫn lỗi 403 như cũ. Không khẳng định có kết quả kiểm tra nào.
Các dependency được ghim (phiên bản chính xác + lockfile) và giới hạn
ở 2 gói trực tiếp. **Hãy chạy `npm audit` trên máy của chính streamer
trước lần dùng trực tiếp đầu tiên**, và kiểm tra lại trước khi nâng cấp
bất kỳ phiên bản đã ghim nào.

## Các điểm khác biệt và quyết định (so với bản tóm tắt gốc / đánh giá)

Không có điểm khác biệt nào so với năm điều kiện của Claude. Các quyết
định sau được đưa ra ở những chỗ bản tóm tắt để ngỏ lựa chọn:

1. **Không có ảnh đại diện (avatar) trong V1.** Các spot chỉ hiển thị
   hình vẽ gốc kèm tên đã lọc. Điều này tránh việc tải ảnh ngoài từ
   overlay và các vấn đề mạo danh avatar. Avatar là một phần của các
   mẫu nghiên cứu nhưng bản tóm tắt không yêu cầu ("named" visuals).
   Chỉ xem xét lại khi có đánh giá riêng tư rõ ràng.
2. **Snapshot lưu tên hiển thị đã lọc + slot** (theo hướng gọn nhẹ của
   Claude), TTL 24 giờ, tệp cục bộ, tự hết hạn. Không có id người dùng
   hay văn bản bình luận.
3. **Ánh xạ quà tặng theo từ khóa trong tên quà tặng đã chuẩn hóa** với
   một dự phòng mặc định cho mỗi biến thể. Id quà tặng không được coi
   là khóa ổn định: không có bảng id đã xác minh nào trong các nguồn
   đã tham khảo, vì vậy việc bịa ra một bảng sẽ là ngụy tạo. Ánh xạ
   là xác định với mọi đầu vào.
4. **`!hide` chuyển đổi qua lại** (gửi lại để hiện tên). Nó tức thì và
   miễn thời gian chờ (cooldown), nên việc ẩn luôn có hiệu lực ngay.
5. **Chia sẻ và tham gia không có tác dụng trong game.** Chỉ follow mới
   tạo spot, giữ nghĩa đen của follow.
6. **Tổng lượt thích (like) thấy lần đầu thiết lập đường cơ sở (baseline)**
   (chỉ số lượng của lô đó được tính); các delta sau đó dùng tổng số.
   Điều này ngăn lịch sử chạm trước khi kết nối của một người xem làm
   phồng thanh đo (meter).
7. **Thanh đo (meter) hiển thị tiến trình theo đoạn** (sáu đoạn bằng nhau,
   mỗi đoạn một ngưỡng) kèm tổng số đang chạy và nhãn nhịp (beat) tiếp
   theo, thay vì một thanh lấp đầy tuyến tính 0–10000 sẽ che giấu tiến
   trình ban đầu.
8. **Không thực hiện soak 8 giờ.** Lần soak thực tế đã chạy được báo cáo
   ở trên. Đề xuất kiểm thử soak 8 giờ của Claude được ghi là còn bỏ ngỏ
   cho streamer (hoặc một lần chạy dài không giám sát) trước khi dựa vào
   các khẳng định về độ ổn định nhiều giờ.
9. **Hậu tố tên trùng.** Hai người xem có cùng tên đã lọc hiển thị "Name"
   và "Name 2" (rồi "Name 3"), đếm theo các spot đang có. Sau khi khởi
   động lại, một người xem cùng tên quay lại sẽ gắn lại vào spot cùng tên
   chưa được gắn sớm nhất — chỉ riêng tên không thể phân biệt hai người
   xem cùng tên nếu không lưu id người dùng, điều mà các quy tắc riêng tư
   cấm.
10. **`!hide` sau khi khởi động lại.** Một lệnh ẩn thực hiện sau khi người
    xem đã có spot sẽ tồn tại sau khi khởi động lại (cờ ẩn của spot gắn
    lại khi rebind). Một lệnh ẩn thực hiện *trước khi từng follow* sẽ
    không tồn tại sau khi khởi động lại: khi không có spot, không có gì
    để gắn lại.
11. **BGM mặc định 30%.** Giảm từ 40% trong vòng sửa lỗi vòng 2: vòng lặp
    chạy nhiều giờ, nên nó nằm dưới giọng của người sáng tạo.
12. **Fetch script xóa các tệp lỗi.** Khi bất kỳ lần xác minh nào thất bại
    sau khi một tệp đã được ghi, `scripts/fetch-audio.sh` nay xóa
    mục tiêu để máy chủ không bao giờ phục vụ một tệp không khớp.

## Các ý tưởng giữ chân đã cắt vì lý do chính sách

Các ý tưởng sau đã được cân nhắc và cố ý **không** triển khai, theo
các điều kiện chính sách: đồng hồ đếm ngược/bộ hẹn giờ tạo sự gấp gáp;
câu chữ sợ mất mát ("leave and lose it"); chuỗi quà tặng (gift streak)
hay bảng xếp hạng; kết quả quà tặng ngẫu nhiên hay hiếm; gợi ý giải
thưởng; cách diễn đạt "follow to unlock"; lời hứa tâm linh; phần
thưởng khi chia sẻ/tham gia; mã QR hay liên kết bên thứ ba trên màn
hình. Việc giữ chân trong bản build này chỉ đến từ cảnh dùng chung
đang phát triển, sự ghi nhận bền bỉ qua snapshot của phiên, và nhịp
độ nền êm dịu.

## CHƯA kiểm thử

- **Kết nối TikTok trực tiếp (live).** Không có kết nối trực tiếp nào
  được thực hiện. Live adapter CHƯA XÁC MINH (UNVERIFIED) và chỉ được
  kiểm thử với một connector giả lập.
- **OBS / trình duyệt thực (hình ảnh + âm thanh).** Overlay đã được thử
  qua các kiểm thử HTTP/WS và hiển thị bằng ngữ cảnh giả (stub-context),
  không phải trong OBS hay trình duyệt thực. Hành vi của trình duyệt/
  Canvas (phông chữ, `roundRect`, bộ nhớ đệm gradient (gradient caching)),
  phát lại `<audio>` thực tế, hiệu ứng chuyển đổi chủ đề (crossfade),
  hành vi tự phát (autoplay), và định tuyến bộ trộn âm thanh (audio-mixer)
  của OBS vẫn cần streamer kiểm tra trên trình duyệt/OBS thực. Bốn hiệu
  ứng âm thanh đã được chọn theo tên tệp và phân tích mức âm lượng, không
  được nghe thử bằng tai — streamer nên nghe thử chúng khi diễn tập qua
  simulator.
- **Soak 8 giờ.** Chỉ các lần soak trên đã được chạy.
- **Liệu có tồn tại công cụ/API TikTok LIVE chính thức nào** cho mục đích
  này hay không. Nghiên cứu không tìm thấy công cụ nào (thư viện/câu hỏi
  thường gặp của Euler); không có xác nhận chính thức nào.
- **npm audit.** Xem ở trên — endpoint bị từ chối trong môi trường build.
- **Id/tên quà tặng thực.** Ánh xạ quà tặng đã được kiểm thử với các tên
  đại diện và không xác định; danh mục quà tặng trực tiếp chưa được tải
  (việc đó sẽ cần một kết nối trực tiếp).

## Sunrise Lake 3D rebuild (2026-11-19)

Bản dựng lại Sunrise Lake thành cảnh 3D thật (chỉ trò chơi chủ lực;
bốn trò chơi còn lại giữ nguyên 2D). Các số dưới đây lấy từ
`src/lake3d-config.js` (nguồn duy nhất cho các số của bản dựng lại).

### Three.js đóng gói sẵn trong dự án

- Three.js **0.187.0** (MIT), bản build trình duyệt được đóng gói sẵn
  bằng `scripts/vendor-three.js` (`npm run vendor:three`) từ gói npm
  đã ghim vào `public/vendor/`; lớp phủ không tải gì từ CDN.
  SHA-256 đầy đủ (chạy lại ngày 2026-11-19, khớp giữa nguồn và bản
  sao đã đóng gói):
  - `public/vendor/three.module.js`:
    `104f56145899722094556490d787aae0617cc2fc3382f31df02d724ea1aee341`
  - `public/vendor/three.core.js`:
    `613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578`
- Giấy phép: mục three trong THIRD-PARTY-LICENSES.md đã đúng
  (0.187.0, MIT, `licenses/three-LICENSE.txt`) — đã xác minh, không
  cần sửa.
- `three.module.js` import `./three.core.js`, nên cả hai tệp phải đi
  cùng nhau; máy chủ chỉ phục vụ đúng hai tệp này dưới `/vendor/`
  (một tệp khác, ví dụ `/vendor/three.cjs`, trả 404 — đã kiểm thử).

### Kiểm thử: 202/202 (141 cũ + 61 mới)

`npm test` ngày 2026-11-19: **202 kiểm thử, 202 đạt, 0 lỗi**.
61 kiểm thử mới: 33 trong `test/gameState3d.test.js` (thời gian chờ
theo lệnh, 16 ghế, hình dạng lặng lẽ, ánh xạ quà 5 loại, chu kỳ like
và đoạn kết + nghỉ 2 phút, sự kiện nhóm, lịch cảnh, bình chọn `!bait`,
dòng cảm ơn, phím nóng qua máy chủ, khôi phục từ tệp, rủi ro trùng
tên), 26 trong `test/render3d.test.js` (bố cục ghế, màu cảnh, phao
theo phiếu, bảng HOW TO PLAY, vệ sinh nguồn), 1 kiểm thử vòng lặp
tệp bản chụp nhanh trong `test/snapshot.test.js`, 1 kiểm thử tuyến
máy chủ 3D trong `test/server.test.js`. Không có kiểm thử cũ nào bị
bỏ hay sửa để đạt.

### Sửa lỗi bản chụp nhanh (snapshot whitelist)

`src/snapshot.js` (`loadSnapshot`) trước đây chỉ giữ các trường chung
và loại bỏ mọi trường riêng của chế độ lake, nên một lần khởi động
lại từ tệp thật sẽ lặng lẽ mất chu kỳ like, cảnh, phiếu bình chọn,
dòng cảm ơn và các hình dạng — dù `GameState.persistData` →
`restore` ở tầng bộ nhớ vẫn đúng. Nay `loadSnapshot` giữ lại các
trường lake khi chúng có hình dạng đúng (`cycleTotal`, `cycleHit`,
`restingUntil`, `restBank`, `sceneIndex`, `sceneStartedAt`,
`baitVote`, `ticker`, `tickerCursor`, `lastLargeLikeEventAt`,
`pendingFinale`, cùng `baseName` và `visualStates` của từng vị trí);
`restore()` vẫn xác thực lại mọi giá trị (loại bỏ giá trị lệch, kẹp
vào giới hạn). Kiểm thử hồi quy:
`test/snapshot.test.js` — "lake file roundtrip keeps cycle, scene,
vote, ticker and visual states" (ghi tệp thật → tải lại → khôi phục →
xác minh chu kỳ, cảnh, phiếu, dòng cảm ơn, hình dạng, và vị trí đã ẩn
khôi phục ẩn ngay lập tức). Tệp bản chụp nhanh vẫn không bao giờ chứa
id người dùng (đã khẳng định trong kiểm thử).

### Tuyến máy chủ mới

`src/server.js` thêm các tuyến tĩnh: `/render3d.js`,
`/vendor/three.module.js`, `/vendor/three.core.js` và
`/lake3d-config.js` (cấu hình được phục vụ để lớp phủ trình duyệt
import trực tiếp). Các tuyến cũ không đổi.

### Hai điểm khác biệt trong cách nối dây (deviation)

1. **Bản sao cấu hình mặc định trong renderer.** `public/render3d.js`
   có một `DEFAULT_CONFIG` — bản sao của một phần `LAKE_3D` /
   `SCENE_PALETTES` / `HOW_TO_PLAY` mà renderer cần — để dùng trực
   tiếp và trong kiểm thử. Lớp phủ trình duyệt luôn truyền cấu hình
   thật đã import vào `createLakeRenderer`; `src/lake3d-config.js`
   vẫn là nguồn duy nhất đáng tin cậy. Kiểm thử ghim bản sao này bằng
   với cấu hình thật (`test/render3d.test.js`: `DEFAULT_CONFIG`
   khớp `SCENES`, `SCENE_PALETTES` và `HOW_TO_PLAY`).
2. **Cách overlay import render3d.js.** `public/overlay.js` import
   tĩnh từ `./render3d.js` cả `createLakeRenderer` lẫn các hàm trợ
   giúp thuần túy (`anglerPosition`, `sceneColorsAt`, `baitColorFor`,
   `meterFillFraction`, `tickerText`, `toastText`,
   `howToPlayBoardData`) — không chỉ các hàm trợ giúp. Riêng THREE
   thì không import tĩnh: `overlay.js` tải động
   `./vendor/three.module.js` và truyền THREE vào
   `createLakeRenderer`; `render3d.js` không bao giờ import THREE
   (THREE được tiêm vào), và không import renderer 2D. (Ghi chú này
   sửa lại cách diễn đạt "chỉ import các hàm trợ giúp" trong bản mô
   tả công việc — mã thực tế import cả `createLakeRenderer`.)

### Rủi ro trùng tên còn tồn tại (đã ghi trong README)

Kiểm thử `RESIDUAL SAME-NAME RISK` trong
`test/gameState3d.test.js` ghi lại hành vi đã biết: sau khi khởi động
lại, một người xem khác cùng tên hiển thị sẽ gắn vào vị trí đã khôi
phục của người đã ẩn tên, thừa hưởng trạng thái ẩn, và lần `!hide`
tiếp theo của họ sẽ hiện vị trí đó lên. Đây là hành vi đã ghi, không
phải lỗi chưa sửa; README mô tả đầy đủ.

### Soak cho bản 3D

Chạy 15 phút ngày 2026-11-19 (`scripts/soak3d.js`, bắt đầu 02:11 UTC):
máy chủ thật + trạng thái lake3D + bộ điều hợp mô phỏng + máy khách
overlay WebSocket + trình kết xuất 3D chạy bằng THREE giả (stub) và
ngữ cảnh WebGL giả — đo chi phí JavaScript, **không phải** hiệu năng
GPU của trình duyệt hay tải khi OBS đang mã hoá. Kết quả đầy đủ trong
`soak-report-3d.json`.

- 4.493 sự kiện tiêm vào, 14.179 sự kiện nhận (gồm các đợt bùng nổ
  follow), 5.234 tin nhắn WebSocket, 25.516 khung hình.
- Chi phí khung hình (JS, stub): trung bình 0,12 ms, p95 0,18 ms,
  tối đa 18,53 ms.
- Bộ nhớ: RSS 67,5 → 60,8 MB; heap 10,3 → 12,9 MB; các mẫu mỗi phút
  dao động 11–15 MB, không tăng đơn điệu — không có dấu hiệu rò rỉ.
- Sự kiện ambient nổ 114 lần (trung bình ~1 lần/7,9 giây, đúng mục
  tiêu ~8 giây). Chất lượng ở tầng 0 suốt 15 phút (không cần hạ cấp),
  60 hạt.
- Trình kết xuất được huỷ + tạo lại một lần ở phút 8 (kiểm thử vòng
  đời dispose/re-init): thành công; tài nguyên stub được giải phóng
  (62 geometry, 53 material, 5 instanced, 1 renderer).
- Cuối soak: 16/16 ghế đầy, 12/16 cần thủ đã có hình dạng; chu kỳ
  like 11.330, tổng like 58.771, cảnh số 1 (buổi trưa), lựa chọn
  `!bait` đang thắng là worm, dòng cảm ơn đã chạy tới 134/180 tên.
  Các hoạt ảnh đã phát: follow 16, command 432, gift 166,
  gift-scene 713, school 12 (sự kiện nhóm đã nổ), finale 5, toast
  131, ticker 6. Lưu bản chụp nhanh 1.330 lần.

Hai quan sát dưới lưu lượng dồn dập của soak (khoảng 3.900 like/phút
và các đợt 120 follow cùng lúc — cao hơn nhiều so với live thật; không
phải lỗi sập, mà là hai quy tắc tương tác với nhau):

- **Chu kỳ like vượt mốc 1.200.** Sau mỗi lần nghỉ 2 phút, số like
  tích trong lúc nghỉ trở thành chu kỳ mới (đã thiết kế như vậy); nếu
  số tích đó đã vượt 1.200, đoạn kết (finale) phải chờ đủ 3 phút kể
  từ đoạn kết trước (giới hạn sự kiện lớn), nên chu kỳ tiếp tục tăng
  tới ~10.000 trước khi nghỉ. Chu kỳ vẫn đặt lại sau mỗi lần nghỉ
  (5 đoạn kết trong 15 phút). Ở tốc độ like thực tế, mức vượt sẽ nhỏ.
- **Dòng cảm ơn bị chèn ép khi bùng nổ follow.** Chỉ 6/≈45 hoạt ảnh
  ticker tới được máy khách overlay; phần còn lại bị các follow ưu
  tiên cao đẩy khỏi hàng đợi (chính sách loại bỏ cũ nhất — hoạt động
  đúng thiết kế). Phía máy chủ vẫn theo dõi đúng (con trỏ 134/180).
  Ở tốc độ thực tế dòng cảm ơn sẽ chạy qua được; nếu kiểm thử live
  thật cho thấy dòng cảm ơn đứng yên trong lúc bùng nổ follow, cân
  nhắc giữ một chỗ riêng cho ticker trong hàng đợi.
- Hàng đợi đã loại 8.207 mục dưới các đợt bùng nổ (chủ yếu là các
  nhịp ambient/thước ưu tiên thấp bị follow ưu tiên cao đẩy ra) —
  đúng chính sách loại bỏ; không có trùng lặp, không vượt giới hạn
  tốc độ, không tạm dừng nào.

### CHƯA kiểm thử (bản 3D)

- **Hiển thị thật trên trình duyệt/OBS.** Chưa xem cảnh 3D trong một
  tab trình duyệt thật hay trong OBS, chưa xác minh cửa sổ camera,
  bảng HOW TO PLAY, dòng cảm ơn và chân trang ở 1080×1920.
- **Tải GPU thật khi mã hóa (encoding).** Chưa đo tải GPU/CPU của
  WebGL trong khi OBS đang mã hóa buổi phát.
- **Soak 8 giờ.** Chưa chạy; xem mục Soak cho bản 3D ở trên.
- **npm audit.** Vẫn bị chặn trong môi trường build (403
  `policy_denied`); chạy trên máy của chính streamer (xem ở trên).
- **Nghe SFX bằng tai.** Bốn hiệu ứng vẫn chỉ được chọn theo tên tệp
  và phân tích mức âm lượng, chưa nghe thử bằng tai.
- **WebGL mất ngữ cảnh trong trình duyệt thật.** Mã có xử lý mất/khôi
  phục ngữ cảnh (chuyển sang cảnh tĩnh rồi quay lại 3D), nhưng chưa
  thử trong trình duyệt thật.
