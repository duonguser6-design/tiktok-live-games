# Ghi công âm thanh (Audio attribution)

Tất cả âm thanh trong gói này đều là các tệp ghi âm thật từ các nguồn đã xác minh giấy phép. **Không có âm thanh nào được tổng hợp hay tạo ra bằng mã**: trò chơi chỉ phát lại các tệp này bằng các phần tử HTML `<audio>`, và bộ kiểm thử (test suite) sẽ thất bại nếu bất kỳ mã tạo âm (tone-generation) nào xuất hiện trong `src/`, `public/` hoặc `scripts/`.

Mã kiểm tra (checksum), kích thước chính xác, thời lượng và công thức tái tạo cho mọi tệp đều nằm trong [`MANIFEST.json`](MANIFEST.json). Các tệp nhạc nền là các đoạn trích đã cắt ngắn (một hình thức chuyển thể mà giấy phép của chúng cho phép, với các thay đổi được ghi chú cho từng tệp bên dưới). Các tệp hiệu ứng âm thanh được giao nguyên vẹn, không chỉnh sửa.

## Nhạc nền — Kevin MacLeod (incompetech.com)

Cả năm bản nhạc đều của Kevin MacLeod, được cấp phép theo
**Creative Commons Ghi công 3.0 Quốc tế (Creative Commons Attribution 3.0 Unported, CC BY 3.0)** —
https://creativecommons.org/licenses/by/3.0/ — cho phép chia sẻ và
chuyển thể, kể cả sử dụng thương mại, với điều kiện ghi công và nêu rõ
các thay đổi. Giấy phép của từng bản nhạc đã được xác minh trên trang tệp
Wikimedia Commons của bản nhạc đó, nơi tái hiện danh mục incompetech và
giấy phép; các tệp MP3 gốc được tải xuống từ incompetech.com (nguồn chính
thức được nêu trên các trang đó). Mỗi đoạn trích dưới đây dài 65.0 giây,
MP3 128 kbps, 44.1 kHz stereo, với hiệu ứng tăng âm (fade-in) 0.5 s và
giảm âm (fade-out) 2.5 s.

| Tệp | Bản nhạc | Dùng cho | Trang nguồn | MP3 gốc | Thay đổi so với bản gốc |
| --- | --- | --- | --- | --- | --- |
| `bgm-lake.mp3` | Meditation Impromptu 01 | sunrise-lake | https://commons.wikimedia.org/wiki/File:Meditation_Impromptu_01_(ISRC_USUAN1100163).mp3 | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%2001.mp3 | Đoạn trích 65 s bắt đầu từ 1.6 s; mức +8 dB với bộ giới hạn (limiter) −1 dB; mã hoá lại |
| `bgm-garden.mp3` | Cherry Blossom | firefly-garden | https://commons.wikimedia.org/wiki/File:Cherry_Blossom_(ISRC_USUAN1100382).mp3 | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cherry%20Blossom.mp3 | Đoạn trích 65 s bắt đầu từ 0 s; không thay đổi mức âm; mã hoá lại |
| `bgm-observatory.mp3` | Frozen Star | starlight-observatory | https://commons.wikimedia.org/wiki/File:Frozen_Star_(ISRC_USUAN1100356).mp3 | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Frozen%20Star.mp3 | Đoạn trích 65 s bắt đầu từ 0.3 s; mức +16 dB với bộ giới hạn (limiter) −1 dB (bản gốc (master) rất nhỏ); mã hoá lại |
| `bgm-cafe.mp3` | Memory Lane | cozy-corner-cafe | https://commons.wikimedia.org/wiki/File:Memory_Lane_(ISRC_USUAN1100485).mp3 | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Memory%20Lane.mp3 | Đoạn trích 65 s bắt đầu từ 1.0 s; mức +1.2 dB với bộ giới hạn (limiter) −1 dB; mã hoá lại |
| `bgm-sky.mp3` | Clear Air | balloon-sky | https://commons.wikimedia.org/wiki/File:Clear_Air_(ISRC_USUAN1100626).mp3 | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Clear%20Air.mp3 | Đoạn trích 65 s bắt đầu từ 0 s; mức +1 dB với bộ giới hạn (limiter) −1 dB; mã hoá lại |

Dòng ghi công cho từng bản nhạc, như bên cấp phép yêu cầu:

> "<Track>" — Kevin MacLeod (incompetech.com), licensed under CC BY 3.0
> (https://creativecommons.org/licenses/by/3.0/). Excerpted and loudness-adjusted
> for use as a background-music loop; see MANIFEST.json.

## Hiệu ứng âm thanh — Kenney, Interface Sounds 1.0

Cả bốn hiệu ứng đều từ gói **Interface Sounds** (phiên bản 1.0,
phát hành ngày 11 February 2020) của Kenney (www.kenney.nl), được cấp phép theo
**Creative Commons Zero v1.0 Universal (CC0 1.0)** —
https://creativecommons.org/publicdomain/zero/1.0/ — đưa tác phẩm vào
phạm vi công cộng (public domain) cho mọi mục đích sử dụng, kể cả thương mại,
mà không yêu cầu ghi công. Giấy phép đã được xác minh bằng hai cách: trang của gói
(https://kenney.nl/assets/interface-sounds) ghi "CC0 licensed" và liên kết tới
văn bản CC0, còn tệp `License.txt` đi kèm trong tệp zip đã tải xuống ghi
"License: (Creative Commons Zero, CC0)". Dù vậy, ghi công vẫn được nêu ở đây,
vì Kenney mong muốn được hỗ trợ thông qua việc ghi công tự nguyện.

| Tệp | Thành viên gốc | Dùng cho | Thời lượng | Thay đổi |
| --- | --- | --- | --- | --- |
| `sfx-follow.ogg` | `Audio/confirmation_001.ogg` | khi có người follow | 0.29 s | Không có; chỉ đổi tên cho rõ ràng |
| `sfx-gift.ogg` | `Audio/glass_004.ogg` | trang trí khi có quà tặng | 0.69 s | Không có; chỉ đổi tên cho rõ ràng |
| `sfx-milestone.ogg` | `Audio/confirmation_002.ogg` | cột mốc của đồng hồ đo (meter) | 0.54 s | Không có; chỉ đổi tên cho rõ ràng |
| `sfx-command.ogg` | `Audio/toggle_001.ogg` | xác nhận lệnh | 0.14 s | Không có; chỉ đổi tên cho rõ ràng |

Nguồn của gói: https://kenney.nl/assets/interface-sounds — mã SHA-256 của tệp zip
được ghi trong `MANIFEST.json` dưới mục `kenneyZip`. Kenney phục vụ tệp zip qua
một liên kết có chữ ký (signed link) được tạo riêng cho mỗi lần truy cập, nên
không có URL trực tiếp ổn định tới tệp zip;
`scripts/fetch-audio.sh` tái hiện đúng quy trình tải xuống của chính trang web
đó và kiểm tra mã kiểm tra (checksum).

## Các nguồn đã cố ý không dùng

Mixkit đã được đánh giá và bị loại: giấy phép hiệu ứng âm thanh của Mixkit cấm
phân phối lại một âm thanh riêng lẻ hoặc kèm theo các tệp nguồn, còn giấy phép
âm nhạc của Mixkit loại trừ trò chơi điện tử (video games) — cả hai đều xung đột
với mô hình phân phối của gói này (một tệp zip trên Drive và một kho GitHub giao
các tệp kèm theo mã nguồn). Không có tệp nào trong gói này đến từ Mixkit.
