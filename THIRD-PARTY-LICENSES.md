# Giấy phép của bên thứ ba (Third-Party Licenses)

## Tệp âm thanh

Các tệp âm thanh trong `assets/audio/` giữ giấy phép riêng của chúng,
**không** phải AGPL. Thông tin ghi công đầy đủ, URL nguồn và ghi chú
thay đổi theo từng tệp có trong `assets/audio/ATTRIBUTION.md`; mã kiểm
tra (checksum) có trong `assets/audio/MANIFEST.json`.

| Tác phẩm | Tác giả / nguồn | Giấy phép | Tệp |
|---|---|---|---|
| "Meditation Impromptu 01" (đoạn trích 65 giây) | Kevin MacLeod, incompetech.com | CC BY 3.0 | `bgm-lake.mp3` |
| "Cherry Blossom" (đoạn trích 65 giây) | Kevin MacLeod, incompetech.com | CC BY 3.0 | `bgm-garden.mp3` |
| "Frozen Star" (đoạn trích 65 giây) | Kevin MacLeod, incompetech.com | CC BY 3.0 | `bgm-observatory.mp3` |
| "Memory Lane" (đoạn trích 65 giây) | Kevin MacLeod, incompetech.com | CC BY 3.0 | `bgm-cafe.mp3` |
| "Clear Air" (đoạn trích 65 giây) | Kevin MacLeod, incompetech.com | CC BY 3.0 | `bgm-sky.mp3` |
| Interface Sounds 1.0 (`confirmation_001`, `confirmation_002`, `glass_004`, `toggle_001`, không sửa đổi) | Kenney, kenney.nl | CC0 1.0 | `sfx-follow.ogg`, `sfx-milestone.ogg`, `sfx-gift.ogg`, `sfx-command.ogg` |

## Dependency đã ghim phiên bản (pinned dependencies)

Cây dependency đã ghim cho dự án này (lấy từ package-lock.json đã cài
đặt, 60 gói, đã kiểm kê ngày 2026-11-19). Mã định danh giấy phép là
trường giấy phép riêng của từng gói. Toàn văn của các dependency trực
tiếp được đính kèm trong licenses/; toàn văn của các gói bắc cầu nằm
trong chính các gói npm của chúng.

| Gói | Phiên bản | Giấy phép | Kho lưu trữ |
|---|---|---|---|
| @bufbuild/protobuf | 2.17.0 | (Apache-2.0 AND BSD-3-Clause) | https://github.com/bufbuild/protobuf-es.git |
| @keyv/serialize | 1.1.1 | MIT | https://github.com/jaredwray/keyv.git |
| @sec-ant/readable-stream | 0.4.1 | MIT | https://github.com/Sec-ant/readable-stream.git |
| @sindresorhus/is | 8.1.0 | MIT |  |
| @types/http-cache-semantics | 4.2.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| agent-base | 6.0.2 | MIT | git://github.com/TooTallNate/node-agent-base.git |
| asynckit | 0.4.0 | MIT | https://github.com/alexindigo/asynckit.git |
| axios | 1.21.1 | MIT | https://github.com/axios/axios.git |
| byte-counter | 0.1.0 | MIT |  |
| cacheable-lookup | 7.0.0 | MIT | https://github.com/szmarczak/cacheable-lookup.git |
| cacheable-request | 13.0.19 | MIT | https://github.com/jaredwray/cacheable.git |
| call-bind-apply-helpers | 1.0.2 | MIT | https://github.com/ljharb/call-bind-apply-helpers.git |
| chunk-data | 0.1.0 | MIT |  |
| combined-stream | 1.0.8 | MIT | git://github.com/felixge/node-combined-stream.git |
| debug | 4.4.3 | MIT | git://github.com/debug-js/debug.git |
| decompress-response | 10.0.0 | MIT |  |
| delayed-stream | 1.0.0 | MIT | git://github.com/felixge/node-delayed-stream.git |
| dunder-proto | 1.0.1 | MIT | https://github.com/es-shims/dunder-proto.git |
| es-define-property | 1.0.1 | MIT | https://github.com/ljharb/es-define-property.git |
| es-errors | 1.3.0 | MIT | https://github.com/ljharb/es-errors.git |
| es-object-atoms | 1.1.2 | MIT | https://github.com/ljharb/es-object-atoms.git |
| es-set-tostringtag | 2.1.0 | MIT | https://github.com/es-shims/es-set-tostringtag.git |
| follow-redirects | 1.16.3 | MIT | ssh://git@github.com/follow-redirects/follow-redirects.git |
| form-data | 4.0.6 | MIT | git://github.com/form-data/form-data.git |
| function-bind | 1.1.2 | MIT | https://github.com/Raynos/function-bind.git |
| get-intrinsic | 1.3.0 | MIT | https://github.com/ljharb/get-intrinsic.git |
| get-proto | 1.0.1 | MIT | https://github.com/ljharb/get-proto.git |
| get-stream | 9.0.1 | MIT |  |
| gopd | 1.2.0 | MIT | https://github.com/ljharb/gopd.git |
| got | 15.1.0 | MIT |  |
| has-symbols | 1.1.0 | MIT | git://github.com/inspect-js/has-symbols.git |
| has-tostringtag | 1.0.2 | MIT | https://github.com/inspect-js/has-tostringtag.git |
| hasown | 2.0.4 | MIT | https://github.com/inspect-js/hasOwn.git |
| http-cache-semantics | 4.3.0 | BSD-2-Clause | https://github.com/kornelski/http-cache-semantics.git |
| http2-wrapper | 2.2.4 | MIT | https://github.com/szmarczak/http2-wrapper.git |
| https-proxy-agent | 5.0.1 | MIT | git://github.com/TooTallNate/node-https-proxy-agent.git |
| is-stream | 4.0.1 | MIT |  |
| keyv | 5.6.0 | MIT | https://github.com/jaredwray/keyv.git |
| lowercase-keys | 4.0.1 | MIT |  |
| lowercase-keys | 3.0.0 | MIT |  |
| math-intrinsics | 1.1.0 | MIT | https://github.com/es-shims/math-intrinsics.git |
| mime-db | 1.52.0 | MIT |  |
| mime-types | 2.1.35 | MIT |  |
| mimic-response | 4.0.0 | MIT |  |
| ms | 2.1.3 | MIT |  |
| normalize-url | 8.1.1 | MIT |  |
| proxy-from-env | 2.1.0 | MIT | https://github.com/Rob--W/proxy-from-env.git |
| quick-lru | 5.1.1 | MIT |  |
| resolve-alpn | 1.2.1 | MIT | https://github.com/szmarczak/resolve-alpn.git |
| responselike | 4.0.2 | MIT |  |
| rxjs | 7.8.2 | Apache-2.0 | https://github.com/reactivex/rxjs.git |
| tagged-tag | 1.0.0 | MIT |  |
| tiktok-live-api-sdk | 0.4.0-beta1 | MIT | https://github.com/EulerStream/Euler-Api-Sdk |
| tiktok-live-connector | 2.5.0 | AGPL-3.0-only | https://github.com/zerodytrash/TikTok-Live-Connector.git |
| tiktok-live-proto | 0.2.4 | AGPL-3.0-only | https://github.com/isaackogan/TikTok-Webcast-Protobuf |
| tslib | 2.9.1 | 0BSD | https://github.com/Microsoft/tslib.git |
| type-fest | 5.10.0 | (MIT OR CC0-1.0) |  |
| typed-emitter | 2.1.0 | MIT |  |
| uint8array-extras | 1.6.0 | MIT |  |
| ws | 8.23.0 | MIT | https://github.com/websockets/ws.git |

Các dependency trực tiếp của dự án này: tiktok-live-connector (AGPL-3.0
đã sửa đổi, xem NOTICE.md) và ws (MIT). Mọi gói còn lại đều là bắc cầu,
được kéo vào bởi thư viện sự kiện.
