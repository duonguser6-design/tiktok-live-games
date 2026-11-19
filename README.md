# TikTok LIVE Games — Năm lớp phủ (overlay) gốc chạy cục bộ

Năm trò chơi lớp phủ tương tác gốc dùng chung một lõi cục bộ:
**Sunrise Lake**, **Firefly Garden**, **Starlight Observatory**,
**Cozy Corner Cafe** và **Balloon Sky**. **Sunrise Lake** là trò chơi
chủ lực, đã được dựng lại thành cảnh 3D thật (Three.js, 16 ghế quanh
hồ); bốn trò chơi còn lại vẫn là cảnh 2D, nhịp độ chậm, 48 vị trí mỗi
phiên. Một lượt follow sẽ thêm một hình ảnh trực quan bền vững, mang
tên của người xem đó. Bình luận sẽ kích hoạt các hành động nhỏ cố
định. Lượt like sẽ làm đầy một thước cảnh chung. Quà tặng sẽ thêm một
vật trang trí cố định. Mỗi hành động chỉ làm đúng những việc đó, và
lớp phủ cũng ghi rõ điều này trên màn hình.

Bản build này được thiết kế **thận trọng về chính sách
(policy-cautious)**. Không bao giờ mô tả bản build này là "fully compliant" — cách diễn đạt đó là sai. Hãy đọc phần đồng thuận về rủi ro bên dưới trước bất kỳ lần sử dụng trực tiếp nào.

## Đồng thuận về rủi ro — đọc trước khi lên sóng trực tiếp

> **Streamer risk consent.** The game mechanics in this package are
> designed to avoid prizes, gambling-like outcomes, and engagement bait:
> no prizes, no currency, no random outcomes tied to gifts, no
> leaderboards, no follow/gift calls-to-action, and gifts change nothing
> about gameplay. **However, reading LIVE events uses an unofficial
> interface.** There is no official public TikTok LIVE events API for
> this purpose. The event library connects to TikTok's internal Webcast
> service with reverse-engineered protocol handling and third-party
> request signing, which TikTok's Community Guidelines and Terms
> prohibit (unauthorised access, reverse engineering, and automation
> tools designed to bypass TikTok's systems). **Account-enforcement risk
> remains, including content removal, loss of recommendations, LIVE
> restrictions, or account bans.** By running the live feed, the
> streamer accepts that risk. The manual/mod mode and the simulator
> need no TikTok connection at all and carry no such feed risk; they
> are the recommended way to rehearse and the fallback if the live
> feed stops working.
>
> This package is not legal advice. The streamer should re-check
> TikTok's current Community Guidelines, LIVE policies, and Terms
> before each use, because they change.

> **Bản dịch tiếng Việt** (bản tiếng Anh ở trên là bản gốc):
>
> **Đồng thuận rủi ro của streamer.** Cơ chế trò chơi trong gói này được thiết kế để tránh giải thưởng, kết quả kiểu cờ bạc và mồi nhử tương tác: không giải thưởng, không tiền tệ, không kết quả ngẫu nhiên gắn với quà tặng, không bảng xếp hạng, không lời kêu gọi follow/tặng quà, và quà tặng không thay đổi gì trong cách chơi. **Tuy nhiên, việc đọc sự kiện LIVE dùng một giao diện không chính thức.** Không có API công khai chính thức của TikTok LIVE cho mục đích này. Thư viện sự kiện kết nối tới dịch vụ Webcast nội bộ của TikTok bằng cách xử lý giao thức đảo ngược và ký yêu cầu qua bên thứ ba, điều mà Community Guidelines và Điều khoản của TikTok cấm (truy cập trái phép, đảo ngược kỹ thuật và công cụ tự động nhằm vượt qua hệ thống của TikTok). **Rủi ro bị xử lý tài khoản vẫn còn, bao gồm gỡ nội dung, mất đề xuất, hạn chế LIVE hoặc cấm tài khoản.** Khi chạy nguồn cấp live, streamer chấp nhận rủi ro đó. Chế độ thủ công/mod và trình mô phỏng hoàn toàn không cần kết nối TikTok và không mang rủi ro nguồn cấp như vậy; chúng là cách nên dùng để tập dượt và là phương án dự phòng nếu nguồn cấp live ngừng hoạt động.
>
> Gói này không phải tư vấn pháp lý. Streamer nên kiểm tra lại Community Guidelines, chính sách LIVE và Điều khoản hiện hành của TikTok trước mỗi lần sử dụng, vì chúng thay đổi.

**Trạng thái bộ chuyển đổi live: CHƯA ĐƯỢC XÁC MINH (UNVERIFIED).** Bộ chuyển đổi sự kiện live chưa từng được chạy với một phiên TikTok LIVE thật. Nó được nối dây theo API đã được ghi chép của thư viện và chỉ được kiểm thử bằng các kết nối giả lập (mock) và các sự kiện mô phỏng. Hãy coi những lần chạy LIVE thật đầu tiên như các lần kiểm thử: diễn tập ở chế độ mô phỏng (simulator), rồi kiểm thử trực tiếp khi bảng điều khiển đang mở và công tắc ngắt (kill-switch) đã sẵn sàng.

**Quy tắc người sáng tạo phải xuất hiện trên camera (bắt buộc).** Người sáng tạo phải có mặt và xuất hiện trên màn hình trong suốt bất kỳ buổi phát trực tiếp nào sử dụng các lớp phủ này. Không yêu cầu phải nói — chỉ cần xuất hiện trên camera. Không bao giờ chạy trò chơi mà không có người trông coi, chạy lặp lại, hoặc phát trên đoạn phim quay sẵn rồi trình bày như đang phát trực tiếp. Lớp phủ chừa một cửa sổ camera ở phía trên cho nguồn camera của người sáng tạo (xem phần thiết lập OBS).

## Năm trò chơi

Cả năm trò chơi dùng chung một lõi, cùng các thông báo công khai, cùng
công tắc ngắt và cùng một trình mô phỏng. Chuyển trò chơi từ bảng điều
khiển hoặc bằng `?theme=` trong URL của lớp phủ. Các vị trí (spot) và thước
chung được giữ nguyên khi chuyển đổi; các hoạt ảnh đang xếp hàng thì không.

| Trò chơi | Follow thêm | Thước like | Trang trí từ quà tặng |
|---|---|---|---|
| Sunrise Lake | Một ghế câu mang tên quanh hồ (tối đa 16 ghế, cảnh 3D) | Chu kỳ like 50/150/300/500/800/1200, lặp lại sau mỗi lần nghỉ 2 phút | Đèn lồng (Lantern), hoa (blossom), mũ nắng (sun hat), cờ (flag), charm hình cá (fish charm) |
| Firefly Garden | Một bông hoa phát sáng mang tên, có một con đom đóm | Thước ánh trăng | Bướm (Butterfly), đèn lồng (lantern), giọt sương (dew drop), nấm (mushroom), bông hoa (bloom), đom đóm (firefly) |
| Starlight Observatory | Một ngôi sao mang tên trong chòm sao | Thước cực quang | Sao chổi (Comet), vệ tinh (satellite), charm hình mặt trăng (moon charm), đèn lồng hình sao (star lantern), dải cực quang (aurora ribbon) |
| Cozy Corner Cafe | Một chú mèo mang tên ở chỗ ngồi bên cửa sổ, kèm một tách đồ uống | Thước hơi ấm | Cây cảnh (Plant), nến (candle), bảng thực đơn (menu board), tách trà (teacup), ngôi sao cửa sổ (window star) |
| Balloon Sky | Một khinh khí cầu mang tên trong đội bay trên bầu trời | Thước gió | Đám mây (Cloud), chim (bird), dải ruy băng (ribbon), diều (kite), charm hình mặt trời (sun charm) |

### Cốt truyện & hình ảnh

Mỗi trò chơi kể một câu chuyện hình ảnh nhỏ. Các nhịp (beat) chỉ thay
đổi khi thước like chung chạm một ngưỡng đã công bố, hoặc khi có lượt
follow mới đến. Giữa các sự kiện, khung cảnh chuyển động chậm rãi: ba lớp gờ núi trôi
dạt tạo hiệu ứng thị sai (parallax), sự sống trên bầu trời theo từng
chủ đề (dải mây, hàng cây, dải Ngân Hà, đèn dây của quán cà phê),
các hạt được tái sử dụng (pooled), và chuyển động đu đưa nhẹ nhàng
giữ cho khung cảnh sống động mà không đòi hỏi sự chú ý. Các hình ảnh
mới xuất hiện nhẹ nhàng với một vòng sáng và một quầng hào quang; tên
nằm trên các viên thuốc tối dễ đọc; không có chỗ nào nhấp nháy. Ở bốn
trò chơi 2D, bầu trời thay đổi theo giai đoạn của thước (0–6) — tia
trăng trong vườn sáng hơn, cực quang của đài quan sát mạnh hơn, ánh
đèn quán cà phê ấm dần, một vòng cầu vồng xuất hiện trên đội khinh khí
cầu ở mốc cuối cùng. Ở Sunrise Lake 3D, bầu trời thay đổi theo lịch
cảnh 12 phút một cảnh (xem mục Sunrise Lake bên dưới). Không có đếm
ngược, không có cảnh báo mất mát, không có chuỗi liên tiếp (streak),
và không có gì hàm ý rằng việc ở lại, follow hay tặng quà sẽ thay đổi
bất cứ điều gì có thật.

**Giảm chuyển động (Reduced motion).** Bảng điều khiển có một nút bật/tắt
giảm chuyển động, và lớp phủ cũng tự động tuân theo thiết lập
`prefers-reduced-motion` của hệ điều hành. Khi giảm chuyển động, khung
cảnh vẫn giữ mọi tên, thước đo và thông báo công khai hoàn toàn dễ đọc,
nhưng chuyển động nhẹ nhàng hơn: ít hạt hơn, không có lớp trôi dạt,
không có sao băng, và các hình ảnh mới mờ dần tại chỗ thay vì bay lên
cùng một vòng sáng.

**Sunrise Lake — cảnh 3D thật quanh một mặt hồ (trò chơi chủ lực).**
Cảnh được vẽ bằng Three.js 0.187.0, bản build được đóng gói sẵn trong
`public/vendor/` và phục vụ từ máy chủ cục bộ — không tải gì từ CDN.
16 ghế câu xếp quanh hồ; một lượt follow thêm một ghế mang tên người
đó. Khung cảnh luôn có việc đang diễn ra, ngay cả khi chưa có ai:
nước chuyển động, cá bơi, gợn sóng, chim bay qua, ánh sáng đổi theo
giờ trong ngày; ghế trống vẫn có một cần câu tựa sẵn, như đang chờ
người ngồi; người câu đã ngồi thì vẫn cử động chậm theo vòng lặp
(cần đung đưa, phao nhấp nhô, thỉnh thoảng quăng câu rồi thu dây).
Lệnh: `!cast`, `!bait`, `!wave`, `!hide`.

- **Thời gian chờ theo từng lệnh:** `!cast` 8 giây, `!wave` 8 giây,
  `!bait` 10 giây; mỗi lệnh có thời gian chờ riêng, và mỗi người chỉ
  có một lệnh đang chờ xử lý. Lệnh gửi trong thời gian chờ bị bỏ qua
  lặng lẽ. Người xem chưa có ghế vẫn dùng được cả ba lệnh.
- **Ba hình dạng cố định, thay đổi lặng lẽ:** lần đầu một người dùng
  `!cast` trong phiên, cần câu của họ đổi sang hình dạng khác — cần
  đẹp hơn, có guồng màu vàng; lần đầu dùng `!bait`, phao của họ phát
  sáng kèm một xô mồi đặt cạnh ghế; lần đầu dùng `!wave`, một ô dù
  sọc xuất hiện trên ghế của họ. Ba hình dạng này chỉ là ba vẻ ngoài
  cố định, khác nhau khi nhìn thoáng qua; không có chữ, không có
  thông báo, không có đếm số nào đi kèm. Follow không làm xuất hiện
  hình dạng nào; like cũng không.
- **Quà tặng:** mỗi người có một ô trang trí, quà mới thay ô cũ, giữ
  trong suốt phiên. Chỉ có 5 loại được ánh xạ, theo loại quà (không
  theo giá trị xu): đèn lồng, hoa, mũ nắng, cờ, charm hình cá; quà
  không thuộc 5 loại này dùng đèn lồng mặc định. Phao câu không phải
  một loại quà — phao là một phần của hình dạng `!bait` và đổi màu
  theo kết quả bình chọn `!bait` (xem dưới).
- **Chu kỳ like chung:** các mốc 50, 150, 300, 500, 800, 1200. Tới
  1200 thì diễn ra đoạn kết (finale), sau đó cảnh nghỉ 2 phút rồi chu
  kỳ lặp lại từ đầu. Like đến trong lúc nghỉ vẫn được cộng vào tổng
  chung và được giữ lại để tính cho chu kỳ tiếp theo, không làm chạy
  hiệu ứng mốc nào trong lúc nghỉ. Đoạn kết chạy tối đa một lần mỗi
  3 phút; nếu đã tới mốc 1200 mà chưa đủ 3 phút kể từ đoạn kết trước,
  đoạn kết được giữ lại một lần rồi chạy khi đủ thời gian.
- **Sự kiện theo nhóm:** 3 người khác nhau cùng `!cast` trong 30 giây
  thì một đàn cá bơi qua; mỗi người chỉ tính một lần trong một cửa sổ
  30 giây, sau đó khóa 60 giây.
- **Sự kiện nền:** trung bình một sự kiện hình ảnh nhỏ khoảng mỗi
  8 giây (trong khoảng 6–10 giây), chỉ là hình ảnh, không gắn với
  người xem nào.
- **Lịch cảnh:** bình minh → buổi trưa → hoàng hôn → đêm đầy sao, mỗi
  cảnh 12 phút (vòng 48 phút), chuyển cảnh mờ dần trong 20 giây.
- **Bình chọn `!bait`:** 3 lựa chọn (Worm, Corn, Berry), mỗi vòng 90
  giây. Mỗi `!bait` chuyển lá phiếu duy nhất của người đó sang lựa
  chọn tiếp theo theo thứ tự (worm → corn → berry → worm…). Hết vòng,
  lựa chọn được nhiều phiếu nhất thắng; hòa thì giữ lựa chọn hiện tại.
  Kết quả chỉ đổi màu phao và đèn lồng.
- **Dòng cảm ơn (thank-you ticker):** cứ 20 giây hiện tối đa 3 tên
  mỗi lượt, theo thứ tự đến, mỗi người một lần trong mỗi phiên, kể cả
  người follow khi đã hết ghế; tên đã ẩn được bỏ qua.
- **Bảng HOW TO PLAY trên lớp phủ:** bốn dòng chữ, mô tả đúng nghĩa
  đen của từng lệnh kèm thời gian chờ (`!cast`: cast your line, 8s;
  `!bait`: vote for bait, 10s; `!wave`: wave, 8s; `!hide`: hides your
  name, không chờ). Bảng không nhắc tới follow hay quà tặng.
- **4 phím nóng của người sáng tạo (chỉ là nút bấm thêm, không bắt
  buộc):** phím 1 đàn cá, phím 2 cảnh tiếp theo, phím 3 tạm dừng/tiếp
  tục, phím 4 tắt/bật tiếng; chung một giới hạn 1 thao tác mỗi 10
  giây, bấm quá sớm bị bỏ qua. Mọi sự kiện trên đều có nhịp tự động
  riêng, nên trò chơi chạy trọn vẹn mà không cần bấm phím nào.
- **Hết 16 ghế:** người follow thứ 17 chỉ thấy dòng toast "All 16
  seats are full — thank you!" và không có hình ảnh nào khác; tên của
  họ vẫn vào dòng cảm ơn.
- **Dự phòng tĩnh khi không có WebGL:** nếu trình duyệt không có
  WebGL, tải mô-đun Three.js thất bại, hoặc ngữ cảnh WebGL bị mất
  giữa buổi, lớp phủ vẽ một cảnh tĩnh 2D (dải màu trời, mặt hồ, lau
  sậy, ghế với tên) và vẽ lại mỗi khi có bản chụp nhanh mới; bảng HOW
  TO PLAY, dòng cảm ơn, toast, thước đo và chân trang vẫn hoạt động.

### Vận hành tự động — streamer không cần nói hay bấm gì

Sunrise Lake 3D tự chạy hoàn toàn: sự kiện nền theo hẹn giờ, sự kiện
nhóm theo lệnh của người xem, lịch cảnh theo giờ, vòng bình chọn theo
giờ, dòng cảm ơn theo giờ, hình dạng đổi lặng lẽ theo lệnh đầu tiên
của từng người. Streamer không cần nói gì — không có lời mời nói ra
nào trong bản build này — và không cần bấm phím nóng nào. Yêu cầu duy
nhất còn lại đối với streamer là **xuất hiện trên camera trong suốt
buổi phát** (xem quy tắc ở đầu README này); không có yêu cầu phải nói.
Sự chú ý của người xem đến từ chính những gì đang diễn ra trên màn
hình, không phải từ lời nói của streamer. Các phím nóng chỉ là nút
bấm thêm khi streamer muốn can thiệp; trò chơi không chờ chúng.

**Firefly Garden — một khu vườn đang ngủ bừng nở thành ánh sáng.** Vườn
đêm, đom đóm, sương đọng. Bảng màu: đêm chàm ấm dần thành xanh lá của
bình minh. Các nhịp của thước: đom đóm thức dậy (100), sương đọng xuống
(500), ánh trăng sáng hơn (1000), hoa nở (2500), khu vườn phát sáng
(5000), ánh bình minh (10000). Các hạt: đom đóm lang thang với ánh nhấp
nháy chậm. Lệnh: `!bloom`, `!glow`, `!wave`, `!hide`.

**Starlight Observatory — một chòm sao đã mất đang được nhớ lại.**
Các ngôi sao tham gia từng ngôi một và các đường chòm sao nối chúng lại.
Bảng màu: xanh dương gần như đen với các dải cực quang mạnh dần theo
thước đo. Các nhịp của thước: sao sắc nét hơn (100), kính viễn vọng lấy
nét (500), cực quang lấp lánh (1000), mưa sao băng (2500), Ngân Hà sáng
hơn (5000), cực quang trọn vẹn (10000). Các hạt: sao nhấp nháy và một
sao băng xác định (deterministic) khoảng mỗi 16 giây. Lệnh: `!wish`,
`!zoom`, `!wave`, `!hide`.

**Cozy Corner Cafe — một buổi tối mưa dần đầy những vị khách quen.** Ánh
sáng ấm từ cửa sổ, mèo với tách đồ uống, hơi nước bốc lên. Bảng màu: nâu
ấm và hổ phách. Các nhịp của thước: ấm đun nóng lên (100), hơi nước bốc
lên (500), nến được thắp (1000), cửa sổ phát sáng (2500), căn phòng ấm
lên (5000), buổi tối vàng (10000). Các hạt: làn hơi nước bốc lên và hạt
bụi li ti. Lệnh: `!sip`, `!stir`, `!wave`, `!hide`.

**Balloon Sky — một đội bay đang tập hợp cho chuyến bay lúc bình minh.**
Khinh khí cầu trôi trên những ngọn đồi dưới bầu trời đang sáng dần.
Bảng màu: xanh da trời chuyển sang bình minh nhạt. Các nhịp của thước:
một cơn gió nhẹ nổi lên (100), mây trôi (500), gió mạnh lên (1000),
chim cùng bay (2500), mặt trời ló ra (5000), đội bay đầy đủ trên bầu
trời (10000). Các hạt: mây trôi. Lệnh: `!float`, `!drift`, `!wave`,
`!hide`.

`!hide` hoạt động giống hệt nhau trong mọi trò chơi: nó ẩn ngay lập tức
tên của chính người xem đó trên màn hình (gửi lại lần nữa để hiện tên
trở lại). Nó được miễn thời gian chờ (cooldown) nên việc ẩn tên luôn
có hiệu lực ngay lập tức.

**`!hide` và rủi ro trùng tên sau khi khởi động lại (đã biết, còn tồn
tại).** Một vị trí đã ẩn sẽ khôi phục lại ở trạng thái ẩn ngay khi tải
bản chụp nhanh, không cần người xem làm gì thêm. Nhưng sau khi khởi
động lại, chỉ riêng tên không thể phân biệt hai người xem cùng tên —
id người dùng không bao giờ được ghi ra đĩa — nên rủi ro sau vẫn còn:
nếu A đã ẩn tên rồi máy chủ khởi động lại, và B (người xem khác, cùng
tên hiển thị với A) gửi một hành động, B sẽ gắn vào vị trí đã khôi
phục của A theo khớp tên, B thừa hưởng trạng thái ẩn đó, và lần
`!hide` tiếp theo của B sẽ **hiện** vị trí đó lên thay vì ẩn. Đây là
hạn chế còn tồn tại của việc khớp theo tên, đã được ghi lại bằng một
kiểm thử đặt tên rõ ràng (`RESIDUAL SAME-NAME RISK` trong
`test/gameState3d.test.js`); cách duy nhất để gỡ nó là lưu id người
dùng, điều mà các quy tắc riêng tư của bản build này không cho phép.

### Mỗi hành động làm gì (cũng hiển thị trên màn hình)

Các điểm dưới đây mô tả bốn trò chơi 2D. Sunrise Lake 3D dùng các số
riêng đã ghi trong mục Sunrise Lake ở trên: 16 ghế thay vì 48 vị trí,
thời gian chờ riêng theo từng lệnh (`!cast` 8 giây / `!wave` 8 giây /
`!bait` 10 giây), chu kỳ like 50/150/300/500/800/1200 lặp lại, và một
ô trang trí cho mỗi người.

- **Follow:** hình ảnh mang tên của người follow tham gia khung cảnh
  với một hoạt ảnh cảm ơn ngắn. Một hình ảnh cho mỗi người xem trong
  mỗi phiên, ngay cả khi họ follow rồi hủy follow nhiều lần. Không hứa
  hẹn gì ngoài khoảnh khắc trên màn hình, và không có câu chữ nào trên
  màn hình yêu cầu bất kỳ ai follow. Hai người xem có cùng tên sẽ không
  bao giờ trông giống hệt nhau: người đầu tiên giữ tên trần, những
  người sau hiển thị thêm hậu tố ("Maya 2", "Maya 3").
- **Bình luận:** chỉ bốn lệnh cố định của trò chơi đang hoạt động mới
  có tác dụng (xem ở trên). Một lệnh đang chờ cho mỗi người xem, thời
  gian chờ 10 giây cho mỗi người xem, văn bản không xác định sẽ bị bỏ
  qua. Không lệnh nào tiêu tốn bất cứ thứ gì hay kích hoạt tính ngẫu
  nhiên.
- **Like:** mọi lượt like đều đổ vào một thước chung, dùng phần chênh
  lệch (delta) của tổng số like theo từng người xem (không bao giờ cộng
  dồn thô). Tại sáu ngưỡng cố định, đã công bố ở trên, toàn bộ khung
  cảnh thay đổi về mặt trang trí. Không có lợi thế cho từng người xem,
  không có bảng xếp hạng, không có câu chữ nào yêu cầu chạm màn hình.
- **Quà tặng:** mỗi món quà được ánh xạ tới một vật trang trí
  cố định, xác định cho hình ảnh của người gửi (hoặc một món trang trí
  nổi nếu họ chưa có hình ảnh). Quà tặng không xác định sẽ dùng một món
  trang trí mặc định cho mỗi trò chơi. Chỉ sự kiện cuối cùng của một
  chuỗi quà (gift streak) mới có tác dụng. Quà tặng không bao giờ thay
  đổi lối chơi, không bao giờ quay ra kết quả ngẫu nhiên, và không bao
  giờ được kêu gọi: không có bảng giá, không có ngưỡng xu, không có câu
  chữ về quà tặng yêu cầu tặng quà.
- **Chia sẻ và tham gia:** không có hiệu ứng trò chơi, theo thiết kế.

Các thông báo công khai luôn hiển thị trên mọi lớp phủ:

> No prizes. Gifts are cosmetic only, non-refundable, and give no gameplay advantage.
> This game is not affiliated with or endorsed by TikTok.

### Dung lượng và chính sách hàng đợi

- **48 vị trí (spot)** cho mỗi phiên ở bốn trò chơi 2D. Khi cả 48 vị trí đã đầy, một lượt
  follow tiếp theo sẽ **không có hình ảnh** — lớp phủ hiển thị một
  thông báo ngắn (toast) với nội dung "All 48 spots are full — thank you!" và không gì khác. Người follow thứ
  49 không được hứa hẹn một chiếc thuyền, bông hoa, ngôi sao, chỗ ngồi
  hay khinh khí cầu, trên màn hình hay ở bất cứ nơi nào khác. Số lượng
  vị trí hiển thị trong bảng điều khiển.
- **Sunrise Lake 3D: 16 ghế.** Khi cả 16 ghế đã đầy, người follow
  tiếp theo chỉ thấy dòng toast "All 16 seats are full — thank you!"
  và không có hình ảnh nào khác; tên của họ vẫn vào dòng cảm ơn
  (thank-you ticker).
- **Giới hạn hàng đợi hoạt ảnh là 100.** Khi đầy, một hoạt ảnh mới sẽ
  thay thế hoạt ảnh cũ có mức ưu tiên thấp nhất (follow > gift >
  command > ambient); nếu mục mới không có mức ưu tiên cao hơn, nó sẽ
  bị loại bỏ. Số lần bị loại được đếm và hiển thị trong bảng điều khiển
  và điểm cuối kiểm tra tình trạng (health endpoint).
- **Giới hạn tốc độ cho mỗi người xem:** 30 sự kiện đã chuẩn hóa mỗi
  phút; các sự kiện thừa sẽ bị loại bỏ (phần chênh lệch like không bị
  mất: tổng số tiếp theo sẽ bù lại khoảng trống).
- **Hoạt ảnh** được giãn cách ít nhất 600ms và không bao giờ phụ thuộc
  vào thời gian thực; độ trễ sự kiện nhiều giây chỉ làm chậm khung
  cảnh, không bao giờ phá vỡ nó.

## Âm thanh

Mỗi trò chơi có vòng nhạc nền êm dịu riêng, và bốn hiệu ứng âm thanh
nhỏ đánh dấu các khoảnh khắc trong trò chơi: một lượt follow đến, một
món trang trí từ quà tặng, một cột mốc của thước đo, và một xác nhận
lệnh. Mọi âm thanh đều là **tệp đã thu âm thật** — không có gì được
tổng hợp hay tạo ra bằng mã. Lớp phủ chỉ phát chúng bằng các phần tử
HTML Audio, và bộ kiểm thử sẽ thất bại nếu xuất hiện bất kỳ mã tạo âm
(tone-generation) nào.

**Nguồn và giấy phép** (chi tiết đầy đủ, URL nguồn và tổng kiểm
(checksum) trong `assets/audio/ATTRIBUTION.md` và
`assets/audio/MANIFEST.json`):

- Vòng nhạc nền: năm bản nhạc của Kevin MacLeod từ incompetech.com,
  mỗi bản được cắt thành một đoạn trích 65 giây với hiệu ứng mờ dần
  (fade) và cân bằng mức âm lượng, được cấp phép **CC BY 3.0** kèm ghi
  công và ghi chú về các thay đổi: *Meditation Impromptu 01* (Sunrise
  Lake), *Cherry Blossom* (Firefly Garden), *Frozen Star* (Starlight
  Observatory), *Memory Lane* (Cozy Corner Cafe), *Clear Air*
  (Balloon Sky).
- Hiệu ứng âm thanh: bốn âm thanh không chỉnh sửa từ gói *Interface
  Sounds* của Kenney, được cấp phép **CC0 1.0** (phạm vi công cộng).

**Điều khiển** (bảng điều khiển, mục "Sound & motion"): một nút tắt
tiếng nổi bật, âm lượng nhạc nền (mặc định 30%), âm lượng hiệu ứng âm
thanh (mặc định 70%), và nút bật/tắt giảm chuyển động. Nhạc mặc định ở
mức 30% là có chủ ý: vòng nhạc chạy trong nhiều giờ, nên nó nằm dưới
giọng nói của người sáng tạo và không gây mỏi tai; chỉ tăng lên nếu
bản phối vẫn nghe quá mỏng. Các thiết lập áp dụng ngay lập tức cho
mọi lớp phủ đã kết nối và có hiệu lực trong suốt phiên máy chủ.
Vòng nhạc chuyển đổi mượt mà (crossfade) khi đổi trò chơi. Âm thanh
hoạt động ở chế độ mô phỏng, chế độ thủ công và chế độ live, vì vậy
buổi diễn tập nghe giống như buổi diễn thật.

**Ghi công âm nhạc — hãy đặt ở nơi người xem có thể thấy.** CC BY 3.0
yêu cầu ghi công trong khi nhạc đang phát, và chỉ một tệp trong gói
thôi thì chưa đủ. Lớp phủ hiển thị dòng ghi công ở chân trang (footer)
của mọi trò chơi ("Music: Kevin MacLeod (incompetech.com), CC BY 3.0").
Hãy đặt cùng một dòng đó trong **mô tả LIVE** nữa, để người xem tham
gia giữa buổi phát vẫn tìm thấy: `Music: Kevin MacLeod (incompetech.com),
CC BY 3.0`. Phần ghi công đầy đủ (các bản nhạc, các thay đổi, các nguồn)
nằm trong `assets/audio/ATTRIBUTION.md`.

**Cảnh báo bị gắn cờ trên nền tảng.** Giấy phép CC BY không ngăn được
các hệ thống kiểm tra nội dung tự động của chính TikTok gắn cờ nhạc,
vì vậy một bản nhạc vẫn có thể bị tắt tiếng hoặc bị gắn cờ trên nền
tảng dù giấy phép hoàn toàn hợp lệ. Hãy giữ nút tắt tiếng (và các
thanh trượt âm lượng) trong tầm tay, và sẵn sàng chạy im lặng nếu một
bản nhạc bị gắn cờ.

**Tự động phát (Autoplay).** Trình duyệt chỉ bắt đầu phát âm thanh sau
khi người dùng tương tác với trang. Trong lúc diễn tập, hãy nhấp một
lần vào trang lớp phủ (hoặc vào cửa sổ tương tác (interact) của nguồn
trình duyệt trong OBS) thì nhạc sẽ bắt đầu; lớp phủ cũng thử lại sau
mỗi sự kiện trò chơi, vì vậy âm thanh sẽ bắt đầu ngay khi trình duyệt
cho phép. Trong OBS, các nguồn trình duyệt thường cho phép tự động
phát — hãy kiểm tra trong lúc diễn tập: nếu lớp phủ im lặng trong OBS,
hãy mở hộp thoại **Interact** của nguồn và nhấp một lần, rồi kiểm tra
bộ trộn âm thanh (audio mixer) của OBS cho thấy nguồn trình duyệt.

**Thiết lập âm thanh OBS.** Âm thanh của nguồn trình duyệt đi vào bộ
trộn âm thanh của OBS như một nguồn bình thường:

1. Trong OBS, chọn Nguồn Trình duyệt (Browser Source) của lớp phủ và
   xác nhận **Audio Monitoring** được đặt ở *Monitor Off* (mặc định)
   nếu âm thanh của buổi phát nên mang tiếng trò chơi mà người phát
   không nghe thấy hai lần, hoặc *Monitor and Output* để nghe trong
   khi phát trực tiếp.
2. Trong **Audio Mixer** của OBS, nguồn trình duyệt xuất hiện dưới dạng
   kênh riêng: đặt mức âm lượng sao cho nhạc nằm dưới giọng nói của
   người sáng tạo, và dùng nút tắt tiếng trong bảng điều khiển để tắt
   ngay lập tức.
3. Diễn tập với trình mô phỏng và lắng nghe bản phối trước khi lên
   sóng trực tiếp. Người phát nên nghe thử bốn hiệu ứng trong lúc diễn
   tập: chúng được chọn dựa trên phân tích tên tệp và mức âm lượng,
   chứ không phải nghe bằng tai, trong môi trường build.

**Ghi chú giao hàng.** Các tệp âm thanh không thể đi qua lần đẩy bản
chụp nhanh (snapshot) GitHub (chỉ UTF-8). **Gói Drive giao các tệp âm
thanh trực tiếp**; một **bản sao GitHub chạy `scripts/fetch-audio.sh`**,
tập lệnh này tải lại mọi tệp từ nguồn gốc đã xác minh của chúng và
kiểm tra tổng kiểm SHA-256 trước khi máy chủ phục vụ âm thanh. Nếu
không có các tệp, trò chơi chạy im lặng và bảng điều khiển sẽ báo như
vậy — không có gì khác thay đổi. Tập lệnh tải về tái tạo quy trình tải
xuống bằng liên kết đã ký của Kenney, vì vậy nếu Kenney thay đổi quy
trình đó, việc tải âm thanh của bản sao GitHub có thể bị hỏng trong khi
gói Drive (giao kèm các tệp âm thanh) không bị ảnh hưởng.

## Cách hoạt động

```
TikTok LIVE --(unofficial Webcast websocket + Euler signing)--> live adapter --\
Simulator buttons --------------------------------------------------> simulator --+--> normalized events --> game state --> ws --> overlay (OBS)
Manual / mod control panel ------------------------------------------> manual ---/
```

- **Bộ chuyển đổi (adapter)** (`src/adapters/`): các bộ chuyển đổi live,
  mô phỏng và thủ công đều phát ra một dạng sự kiện đã chuẩn hóa duy
  nhất. Bộ chuyển đổi live có thể thay thế mà không cần chạm vào logic
  trò chơi.
- **Trạng thái trò chơi** (`src/gameState.js`): loại trùng lặp theo id
  tin nhắn, lọc tên, thời gian chờ, lệnh đang chờ cho mỗi người xem,
  phần chênh lệch like, quà tặng ở cuối chuỗi, hàng đợi, thước đo,
  chuyển đổi chủ đề, tạm dừng/dừng hẳn/đặt lại.
- **Bản chụp nhanh (snapshot)** (`data/session-snapshot.json`): chỉ tên
  hiển thị đã lọc + vị trí (slot) + trang trí + thước đo + chủ đề, thời
  gian sống (TTL) 24 giờ, tệp cục bộ, tự hết hạn. Hình ảnh của một
  người follow quay lại vẫn còn đó sau khi khởi động lại trong thời
  gian TTL, được gắn lại theo khớp tên đã lọc khi họ follow, gửi lệnh
  hoặc tặng quà lần tiếp theo. `!hide` vẫn hoạt động sau khi khởi động
  lại theo cùng cách. Ở Sunrise Lake 3D, bản chụp nhanh còn giữ chu kỳ
  like, cảnh đang chạy, lựa chọn bình chọn `!bait` đang thắng, dòng cảm
  ơn (kể cả vị trí đã đọc tới đâu) và ba hình dạng của từng người — tất
  cả đều khôi phục qua một lần khởi động lại từ tệp thật. Id người dùng và văn bản bình luận không bao giờ
  được ghi vào đĩa, không bao giờ được ghi nhật ký, và không bao giờ
  được phát đi.
- **Máy chủ** (`src/server.js`): Node `http` + `ws`, chỉ liên kết với
  `127.0.0.1`. Phục vụ lớp phủ, bảng điều khiển và một điểm cuối kiểm
  tra tình trạng. Lớp phủ nhận lại toàn bộ bản chụp nhanh mỗi khi
  socket của nó (tái) kết nối, vì vậy việc làm mới một nguồn OBS sẽ vẽ
  lại khung cảnh hiện tại.
- **Lớp phủ** (`public/`): hình ảnh HTML/Canvas gốc, 1080×1920, nền
  trong suốt, giới hạn 30fps. Mọi hình ảnh được vẽ bằng mã (các gradient
  được lưu vào bộ nhớ đệm; các hạt được tái sử dụng), vì vậy các phiên
  dài không làm tích lũy bộ nhớ trong trang. Sunrise Lake 3D vẽ bằng
  WebGL qua Three.js đã đóng gói sẵn trong `public/vendor/` (không CDN);
  khi WebGL không có sẵn, lớp phủ vẽ cảnh tĩnh 2D thay thế và HUD vẫn
  hoạt động. Các tệp âm thanh được phục vụ bởi cùng một máy chủ cục bộ (`/audio/*`, chỉ cho phép theo danh
  sách trong manifest) — lớp phủ không tải gì từ internet khi chạy.
- **Âm thanh** (`assets/audio/`, `src/audio.js`): manifest là nguồn duy
  nhất đáng tin cậy cho các tệp, ánh xạ chủ đề→vòng nhạc và sự
  kiện→hiệu ứng, giấy phép và tổng kiểm. Máy chủ giữ các thiết lập âm
  lượng/tắt tiếng/giảm chuyển động (chỉ trong phiên, không bao giờ lưu
  bền) và phát chúng tới các lớp phủ và bảng điều khiển.

## Bắt đầu nhanh

Yêu cầu: Node.js 20+.

```sh
npm ci
npm start
```

Sau đó mở bảng điều khiển tại <http://127.0.0.1:3000/control> và lớp
phủ tại <http://127.0.0.1:3000/overlay?theme=sunrise-lake>.

Diễn tập trước ở chế độ mô phỏng (chế độ mặc định): dùng các nút của
trình mô phỏng để thêm follow, lệnh, like và quà tặng, và quan sát lớp
phủ. Hãy thử mọi trò chơi, công tắc ngắt và `!hide` trước bất kỳ lần
sử dụng trực tiếp nào. `npm test` chạy bộ kiểm thử tự động; `npm run
soak` chạy kiểm thử chịu tải mô phỏng 15 phút (xem TEST-REPORT.md).

### Danh sách kiểm tra diễn tập (làm trước bất kỳ lần sử dụng trực tiếp nào)

Đây là phần không kiểm thử tự động nào có thể làm thay bạn — mất vài
phút, trong trình duyệt thật và trong OBS:

- [ ] Xem **cả 5 chủ đề** trong một tab trình duyệt thật (không chỉ OBS):
  tên, thước đo, các thông báo công khai và dòng ghi công âm nhạc có
  thể đọc được ở chân trang, và không có gì tràn khỏi bảng.
- [ ] **Nghe cả 4 hiệu ứng âm thanh** (follow, quà tặng, cột mốc,
  lệnh) qua trình mô phỏng, và nghe mỗi vòng nhạc nền một lần.
  Kiểm tra nhạc nằm dưới giọng nói của bạn ở mức mặc định 30%.
- [ ] Trong OBS, xác nhận nguồn trình duyệt xuất hiện trong **Audio
  Mixer**, đặt mức âm lượng dưới giọng nói của bạn, và kiểm tra
  Monitor/Output đúng như bạn mong đợi. Nếu lớp phủ im lặng, hãy nhấp
  một lần trong cửa sổ Interact của nguồn.
- [ ] Kích hoạt một lượt follow, một lệnh, like và một món quà; thử
  **Pause**, **công tắc ngắt (kill-switch)** + Resume, và `!hide` hai lần.
- [ ] Xem một cột mốc của thước đo và một hoạt ảnh quà tặng: không có
  gì được nhấp nháy hay chớp nhanh (không nhanh hơn một lần mờ dần chậm).
- [ ] Chạy `npm audit` trên máy của chính bạn (nó không thể chạy trong
  môi trường build — xem phần Khắc phục sự cố).

### Thiết lập OBS

1. Trong OBS, thêm một **Browser Source** với URL
   `http://127.0.0.1:3000/overlay?theme=sunrise-lake` (thay `theme=` để
   chọn trò chơi), chiều rộng 1080, chiều cao 1920. Để nền trang trong
   suốt (trang lớp phủ có nền trong suốt).
2. Đặt **nguồn camera bên dưới** nguồn lớp phủ. Lớp phủ chừa một cửa sổ
   camera bo tròn ở phía trên; camera hiển thị xuyên qua đó. Giữ người
   sáng tạo trong khung cửa sổ đó và xuất hiện trên camera trong suốt
   buổi phát.
3. Nếu TikTok LIVE Studio từ chối `localhost` cho nguồn Link, hãy dùng
   `http://localtest.me:3000/overlay?theme=...` thay thế (nó phân giải
   thành 127.0.0.1). Máy chủ vẫn chỉ lắng nghe cục bộ.
4. Giữ bảng điều khiển mở trên màn hình thứ hai hoặc tab trình duyệt
   khác để tạm dừng, dùng công tắc ngắt, chuyển chủ đề và kích hoạt
   thủ công.
5. **Âm thanh:** kiểm tra Audio Mixer của OBS cho thấy nguồn trình
   duyệt và đặt mức âm lượng dưới giọng nói của người sáng tạo (xem
   phần Âm thanh ở trên). Nhấp một lần trong cửa sổ Interact của nguồn
   trong lúc diễn tập nếu tính năng tự động phát cần được kích hoạt.
6. Làm mới khóa luồng RTMP mỗi lần phát sóng nếu phát qua RTMP,
   hoặc dùng OBS Virtual Camera vào LIVE Studio. Không bao giờ để lộ
   máy chủ cục bộ hay bất kỳ websocket OBS nào ra internet.

### Máy tính không có camera — dùng điện thoại làm webcam

Nếu máy tính không có camera, dùng điện thoại làm nguồn camera: cài
một ứng dụng biến điện thoại thành webcam (DroidCam, Camo hoặc Iriun
— đều có bản dùng không mất phí), nối điện thoại với máy tính theo
hướng dẫn của ứng dụng, rồi thêm nguồn webcam đó vào OBS và đặt bên
dưới nguồn lớp phủ như ở bước 2. TikTok LIVE yêu cầu 1.000 người theo
dõi trở lên và đủ 18 tuổi (có thể khác nhau theo khu vực) thì mới mở
được phát trực tiếp.

### Chọn trò chơi

- URL lớp phủ: `?theme=sunrise-lake|firefly-garden|starlight-observatory|cozy-corner-cafe|balloon-sky`.
- Bảng điều khiển: các nút trò chơi chuyển chủ đề chung cho mọi lớp
  phủ đã kết nối.
- Mặc định khi khởi động: `THEME=...` (xem phần Cấu hình).

## Chế độ live

```sh
TIKTOK_USERNAME=yourname MODE=live npm start
```

- Chỉ tên người dùng. Không đăng nhập, không cookie, không token,
  không gửi chat. Mã không có chỗ nào để dán thông tin đăng nhập, và
  các biến môi trường trông giống thông tin đăng nhập sẽ bị bỏ qua kèm
  cảnh báo nếu có.
- Bộ chuyển đổi live **CHƯA ĐƯỢC XÁC MINH (UNVERIFIED)** (xem đầu
  README này). Hãy dự kiến nó sẽ hỏng mà không báo trước nếu TikTok
  thay đổi giao thức nội bộ hoặc cơ chế ký của họ. Nếu nó ngừng hoạt
  động: lớp phủ hiển thị trạng thái kết nối, bộ chuyển đổi lùi lại và
  tạm dừng thay vì thử lại dồn dập, và chế độ thủ công vẫn giữ cho buổi
  diễn tiếp tục.
- **Phụ thuộc ký bởi bên thứ ba (Euler Stream).** "Chỉ chạy cục bộ"
  mô tả nơi trò chơi chạy, không phải toàn bộ chuỗi phụ thuộc: cơ chế
  ký mặc định của thư viện sự kiện đi qua dịch vụ ký của Euler Stream,
  một bên thứ ba. Điều đó có nghĩa là sự phụ thuộc về tính khả dụng,
  quyền riêng tư và chuỗi cung ứng vào Euler Stream: nếu dịch vụ ký của
  họ ngừng hoạt động, bị giới hạn tốc độ hoặc thay đổi, nguồn cấp live
  sẽ dừng; siêu dữ liệu kết nối đi qua dịch vụ của họ; và phiên bản
  thư viện đã ghim sẽ ghim luôn sự phụ thuộc đó. Các phiên bản đã được
  ghim (`package.json` + `package-lock.json`); hãy kiểm toán lại các
  phụ thuộc trước khi cập nhật chúng. Gói này không cấu hình khóa API
  Euler nào, và không bao giờ gửi thông tin đăng nhập phiên tới bất kỳ
  dịch vụ ký nào.
- Hành vi kết nối lại: lùi dần theo cấp số nhân (2s→32s, dao động ±30%,
  5 lần thử) rồi tạm dừng bằng cầu dao (circuit-breaker) (60s) với các
  lần thăm dò đơn lẻ. Các lỗi ký/chặn lặp lại sẽ tạm dừng trò chơi thay
  vì thử lại quyết liệt. Các sự kiện được loại trùng lặp theo id tin
  nhắn sau khi kết nối lại.

## Điều khiển

Bảng điều khiển (`/control`):

- **Nút trò chơi** — chuyển chủ đề (vị trí + thước đo được giữ nguyên).
- **Sound & motion** — nút tắt tiếng, thanh trượt âm lượng nhạc nền và
  hiệu ứng (mặc định 30% / 70%), nút bật/tắt giảm chuyển động. Hiển thị
  thông báo khi không có tệp âm thanh.
- **Nguồn sự kiện** — trình mô phỏng, chỉ thủ công/người điều hành
  (manual/mod), hoặc nguồn cấp live.
- **Pause / Resume** — tạm dừng sẽ dừng việc tiếp nhận sự kiện; chuyển
  động nền vẫn vẽ dưới một lớp phủ mờ kèm biểu ngữ Paused.
- **Công tắc ngắt (Kill-switch)** — dừng hoàn toàn việc tiếp nhận sự
  kiện (không chỉ hình ảnh) và xóa hàng đợi. Resume sẽ khởi động lại
  việc tiếp nhận.
- **Đặt lại phiên (Reset session)** — xóa các vị trí, thước đo, hàng đợi
  và phiên; tệp bản chụp nhanh cục bộ bị xóa rồi được tạo lại trống bởi
  lần lưu theo lịch tiếp theo (~500 ms sau).
- **Lưu lượng demo tự động (Auto demo traffic)** — lưu lượng giả chậm
  cho diễn tập (mặc định tắt).
- **Các mục Trình mô phỏng / Thủ công** — kích hoạt follow, lệnh, like
  và quà tặng bằng tay. Các kích hoạt thủ công là phương án dự phòng
  không cần kết nối.
- **Hoạt động gần đây** — chỉ số lượng và tên đã lọc.

Điểm cuối kiểm tra tình trạng: `GET /healthz` trả về chế độ, chủ đề,
trạng thái, số lượng và các bộ đếm (không có dữ liệu người xem).

## Cấu hình

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `MODE` | `simulator` | `simulator`, `manual` hoặc `live`. |
| `TIKTOK_USERNAME` | — | Tên người dùng công khai cho chế độ live (`@` không bắt buộc). |
| `PORT` | `3000` | Cổng cục bộ. Máy chủ luôn là `127.0.0.1`. |
| `THEME` | `sunrise-lake` | Chủ đề khởi đầu (xem id trò chơi ở trên). |
| `DATA_DIR` | `./data` | Thư mục bản chụp nhanh cục bộ. |
| `BANNED_WORDS` | — | Các từ cấm bổ sung cho tên hiển thị, phân tách bằng dấu phẩy. |

Xem `config.example`. Không có thiết lập, tài khoản hay khóa nào khác.

## Các quy tắc bản build này tuân theo

Gói này được xây dựng theo một đợt đánh giá có điều kiện với năm điều
kiện, được triển khai như sau:

1. **Không kêu gọi follow/tặng quà (call-to-action).** Không có câu chữ
   nào trên màn hình, trong bảng điều khiển hay trong README này yêu cầu
   bất kỳ ai follow, tặng quà hay chạm màn hình. Các lượt follow được
   cảm ơn sau khi chúng xảy ra; quà tặng không bao giờ được kêu gọi;
   thước like là thụ động.
2. **`!hide` + lọc tên.** Tên hiển thị đi qua `src/nameFilter.js`:
   ký tự điều khiển/ký tự hai chiều/ký tự chiều rộng bằng không bị
   loại bỏ, chuỗi dấu kết hợp được làm dịu, chuỗi emoji bị giới hạn,
   giới hạn 24 ký tự, các mẫu email/URL/chuỗi số dài bị chặn, các mẫu
   mạo danh bị chặn, danh sách từ cấm khởi đầu (+ `BANNED_WORDS`).
   Nội dung chat thô không bao giờ được lặp lại. `!hide` ẩn ngay lập
   tức tên của chính người xem đó.
3. **Công khai việc ký bởi bên thứ ba.** Xem "Chế độ live" ở trên.
4. **Giao hàng AGPL.** Mã gốc trong kho này được cấp phép AGPL-3.0
   (xem LICENSE). Các thư viện sự kiện được dùng nguyên vẹn dưới dạng
   phụ thuộc đã ghim; thông báo bản quyền và toàn văn giấy phép của
   chúng được giao kèm trong `licenses/` và được liệt kê trong NOTICE.md
   và THIRD-PARTY-LICENSES.md. Không có relay lưu trữ (hosted relay),
   không có SaaS: đây là một chương trình cục bộ cho một người phát
   trực tiếp. Hãy xin đánh giá pháp lý trước bất kỳ việc sử dụng nào
   được lưu trữ (hosted) hoặc cho nhiều người phát — các điều khoản
   AGPL đã sửa đổi của các thư viện sẽ thu hồi ngoại lệ liên kết của
   chúng đối với các dịch vụ lưu trữ thương mại mã nguồn đóng (xem
   NOTICE.md).
5. **"Thận trọng về chính sách (Policy-cautious)", kèm đồng thuận về
   rủi ro bằng văn bản.** Cách diễn đạt được dùng nhất quán trong
   README này, bảng điều khiển và báo cáo bàn giao. Phần đồng thuận
   về rủi ro ở đầu README này là tuyên bố bằng văn bản; người phát
   nên đọc nó trước khi sử dụng trực tiếp.

**Đã cắt vì lý do chính sách (cố tình không có):** đếm ngược và bộ
hẹn giờ gây gấp gáp; câu chữ sợ mất mát (loss-aversion); chuỗi quà
tặng/bảng xếp hạng; kết quả quà tặng ngẫu nhiên hoặc hiếm; gợi ý về
giải thưởng; cách diễn đạt follow-đổi-follow hoặc like-đổi-like; lời
hứa tâm linh hoặc câu chữ và hình ảnh tôn giáo; phần thưởng chia sẻ/
tham gia; mã QR và liên kết bên thứ ba trên màn hình; lặp lại chat;
hình đại diện (avatar) (V1 vẽ các hình gốc chỉ với tên đã lọc, tránh
tải hình ảnh bên ngoài và mạo danh avatar).

## Khắc phục sự cố

- **Lớp phủ trống trong OBS:** kiểm tra máy chủ đang chạy, URL khớp
  với cổng, và kích thước Browser Source là 1080×1920. Mở cùng URL
  đó trong một tab trình duyệt: nếu nó hiển thị ở đó, hãy thêm lại
  nguồn OBS.
- **Không thấy camera qua cửa sổ:** nguồn camera phải nằm *bên dưới*
  nguồn lớp phủ trong OBS, và nguồn lớp phủ phải giữ nền trong suốt.
- **Khung cảnh bị đóng băng / "Paused":** kiểm tra trạng thái trong
  bảng điều khiển. Nếu bộ chuyển đổi live đã tạm dừng sau nhiều lỗi
  lặp lại, hãy chờ chu kỳ thăm dò hoặc chuyển sang chế độ thủ công.
  Công tắc ngắt yêu cầu Resume một cách rõ ràng.
- **Vị trí biến mất sau khi khởi động lại:** bản chụp nhanh hết hạn
  sau 24 giờ, và Reset sẽ xóa nó. Trong thời gian TTL, các vị trí
  được khôi phục và gắn lại theo tên đã lọc khi người xem follow, gửi
  lệnh hoặc tặng quà lần tiếp theo.
- **Nguồn cấp live kết nối được nhưng không có sự kiện nào đến:** người
  phát có thể chưa phát trực tiếp, phòng có thể không phát ra một số
  loại sự kiện, hoặc giao thức có thể đã thay đổi. Hãy diễn tập cùng
  các hành động đó ở chế độ mô phỏng để xác nhận trò chơi tự nó hoạt
  động, rồi kiểm tra trạng thái kết nối trong bảng điều khiển. Hãy nhớ
  bộ chuyển đổi live CHƯA ĐƯỢC XÁC MINH (UNVERIFIED).
- **Lớp phủ im lặng:** kiểm tra mục "Sound & motion" trong bảng điều
  khiển — nếu nó hiển thị thông báo thiếu âm thanh, hãy chạy
  `scripts/fetch-audio.sh` và khởi động lại máy chủ (chỉ bản sao
  GitHub; gói Drive giao kèm các tệp). Nếu không, hãy kiểm tra nút tắt
  tiếng và các thanh trượt âm lượng, rồi nhấp một lần vào trang lớp
  phủ hoặc cửa sổ Interact của nguồn OBS (cổng tự động phát), và xác
  nhận Audio Mixer của OBS cho thấy nguồn trình duyệt.
- **CPU cao trong OBS:** lớp phủ giới hạn ở 30fps và không dùng tài
  nguyên bên ngoài. Nếu máy vẫn gặp khó khăn, hãy đóng các nguồn trình
  duyệt khác trước; bản thân lớp phủ chỉ vẽ một canvas.
- **`npm audit`:** chạy nó trên máy của chính người phát trước lần sử
  dụng đầu tiên. (Nó không thể chạy trong môi trường build — điểm cuối
  kiểm toán bị từ chối theo chính sách registry. Xem TEST-REPORT.md.)

## Kiểm thử

- `npm test` — 202 kiểm thử tự động: chuẩn hóa, loại trùng lặp, lùi
  dần (backoff), chính sách hàng đợi, lọc tên, quy tắc trò chơi, cấu
  hình và kết xuất theo từng chủ đề, bộ chuyển đổi (kết nối live giả
  lập), máy chủ HTTP/WS, xử lý bản chụp nhanh, manifest/giấy phép/ánh
  xạ/thiết lập âm thanh và kiểm tra không tổng hợp, các tuyến HTTP âm
  thanh, kết xuất giảm chuyển động, bố cục chân trang, xác thực khôi
  phục bản chụp nhanh, hậu tố tên trùng lặp, !hide qua các lần khởi
  động lại, quét câu chữ kêu gọi hành động (CTA), kiểm tra không
  nhấp nháy, và 61 kiểm thử cho bản dựng lại Sunrise Lake 3D (thời
  gian chờ theo lệnh, 16 ghế, hình dạng lặng lẽ, chu kỳ like, sự kiện
  nhóm, lịch cảnh, bình chọn `!bait`, dòng cảm ơn, phím nóng, khôi
  phục bản chụp nhanh từ tệp thật, rủi ro trùng tên còn tồn tại).
  Chi tiết trong TEST-REPORT.md. Bản build này đã sẵn sàng để GPT xem
  xét ở vòng tiếp theo; các quyết định đã chốt với Claude ở vòng 3
  vẫn giữ nguyên như lịch sử đã ghi.
- **Kiểm thử tự động không thay thế các kiểm tra thật.** 202/202 kiểm
  thử đạt có nghĩa là bộ kiểm thử tự động đạt — đó không phải bằng
  chứng trò chơi đã được xác minh đầy đủ. Việc kiểm tra trên trình
  duyệt thật/OBS, việc kiểm tra kết nối live, và lần chạy 8 giờ trong
  danh sách bên dưới vẫn còn bỏ ngỏ, và danh sách kiểm tra diễn tập ở
  trên là một phần của kiểm thử, không phải tùy chọn.
- `npm run soak` — kiểm thử chịu tải mô phỏng 15 phút qua các chủ đề
  với lấy mẫu bộ nhớ (xem TEST-REPORT.md để biết các con số thực tế).
  Lần soak chạy ở khoảng 5 sự kiện mỗi giây; mức tải đó **không**
  đại diện cho các đợt spam dồn dập hay một lần chạy 8 giờ.
- **Chưa kiểm thử:** một kết nối TikTok live, OBS trên máy thật (bao
  gồm phát âm thanh trên trình duyệt thật và bộ trộn âm thanh OBS),
  một lần soak 8 giờ, và liệu có tồn tại công cụ/API TikTok LIVE chính
  thức nào cho mục đích này hay không. Xem TEST-REPORT.md.

## Giấy phép và ghi công

Mã gốc trong kho này: Giấy phép Công cộng GNU Affero phiên bản 3.0
(LICENSE). Giấy phép bên thứ ba và việc xác minh AGPL đã sửa đổi cho
các thư viện sự kiện: NOTICE.md, THIRD-PARTY-LICENSES.md và
`licenses/`. **Cách lấy mã nguồn:** toàn bộ mã nguồn được giao kèm
trong chính đợt giao hàng này — tệp zip Drive chứa mọi tệp, và cùng
các tệp đó được đưa lên kho `tiktok-live-games`. Các tệp âm thanh giữ
giấy phép riêng của chúng (CC BY 3.0 cho nhạc, CC0 1.0 cho hiệu ứng) —
xem `assets/audio/ATTRIBUTION.md`. Mọi hình ảnh trò chơi, tên gọi, cơ
chế và mã lớp phủ trong kho này đều là gốc; không tái tạo thương hiệu
TikTok.
