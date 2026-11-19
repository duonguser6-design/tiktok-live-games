#!/usr/bin/env bash
# fetch-audio.sh — tái tạo mọi tệp trong assets/audio/ từ nguồn gốc
# đã xác minh, kèm kiểm tra SHA-256.
#
# Vì sao có tệp này: các tệp âm thanh không thể đi qua bản đẩy
# ảnh chụp GitHub (chỉ UTF-8). Gói trên Drive giao trực tiếp các tệp âm thanh; một
# bản sao GitHub (clone) chạy tập lệnh này để tải chúng từ các nguồn gốc.
#
# Tập lệnh này làm gì, hoàn toàn dựa trên assets/audio/MANIFEST.json:
#   * Nhạc nền: tải xuống tệp MP3 đầy đủ gốc từ
#     incompetech.com, kiểm tra SHA-256 của nó (sourceSha256), rồi cắt ngắn
#     thành đoạn trích 65 giây được giao bằng ffmpeg (hiệu ứng tăng/giảm âm + mức âm, đúng
#     các tham số đã ghi trong manifest). Đầu ra sau khi cắt được
#     kiểm tra theo thời lượng và khả năng giải mã sạch; SHA-256 của nó chỉ được so sánh
#     ở mức cảnh báo (warn-only), vì các bản mã hoá lại MP3 không giống nhau
#     theo từng byte giữa các bản dựng ffmpeg. Việc kiểm tra nguồn gốc quan trọng —
#     tệp gốc đã tải xuống — được thực hiện nghiêm ngặt.
#   * Hiệu ứng âm thanh: tái hiện đúng quy trình tải xuống của chính Kenney (trang web tạo
#     một liên kết zip có chữ ký cho mỗi lần truy cập; không có URL trực tiếp ổn định), kiểm tra
#     SHA-256 của tệp zip, và chỉ giải nén các thành viên được liệt kê trong manifest.
#     Các tệp giải nén được giống nhau theo từng byte, nên việc kiểm tra SHA-256 của chúng là nghiêm ngặt.
#   * Các tệp đã có sẵn với SHA-256 khớp sẽ được bỏ qua.
#
# Yêu cầu: curl, python3, sha256sum, unzip, ffmpeg (chỉ cần khi một
# tệp nhạc nền phải được (tái) tạo). Ghi đè thư mục đích bằng
# AUDIO_DIR. Không có gì được tải lên bất cứ đâu; các lượt tải xuống đi vào một thư mục tạm.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUDIO_DIR="${AUDIO_DIR:-$SCRIPT_DIR/../assets/audio}"
MANIFEST="$AUDIO_DIR/MANIFEST.json"

need() { command -v "$1" >/dev/null 2>&1 || { echo "fetch-audio: missing required tool: $1" >&2; exit 1; }; }
need curl; need python3; need sha256sum; need unzip

[ -f "$MANIFEST" ] || { echo "fetch-audio: manifest not found: $MANIFEST" >&2; exit 1; }
mkdir -p "$AUDIO_DIR"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
COOKIE_JAR="$WORK/cookies.txt"

sha256_of() { sha256sum "$1" | awk '{print $1}'; }

# --- kế hoạch: một dòng cho mỗi tệp được giao, các trường phân tách bằng |
# bgm|<file>|<sha256>|<downloadUrl>|<sourceSha256>|<startSec>|<gainDb>|<fadeOutStart>|<title>
# sfx|<file>|<sha256>|<archiveMember>
PLAN="$WORK/plan.txt"
python3 - "$MANIFEST" > "$PLAN" <<'PYEOF'
import json, sys
m = json.load(open(sys.argv[1]))
for name in sorted(m["files"]):
    e = m["files"][name]
    if e["kind"] == "bgm":
        t = e["trim"]
        fade_out_start = t["durationSec"] - 2.5
        print("|".join(["bgm", name, e["sha256"], e["downloadUrl"], e["sourceSha256"],
                        str(t["startSec"]), str(t["gainDb"]), str(fade_out_start), e["title"]]))
    else:
        print("|".join(["sfx", name, e["sha256"], e["archiveMember"]]))
PYEOF

KENNEY_PAGE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['kenneyZip']['sourcePage'])" "$MANIFEST")"
KENNEY_ID="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['kenneyZip']['downloadId'])" "$MANIFEST")"
KENNEY_SHA="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['kenneyZip']['sha256'])" "$MANIFEST")"
KENNEY_ZIP="$WORK/kenney.zip"
kenney_fetched=0

fetch_kenney_zip() {
  if [ "$kenney_fetched" = 1 ]; then return 0; fi
  echo "fetch-audio: resolving Kenney signed download link (site's own flow)..."
  curl -sSL --max-time 60 -A "Mozilla/5.0" -c "$COOKIE_JAR" "$KENNEY_PAGE" -o /dev/null
  local json
  json="$(curl -sSL --max-time 60 -A "Mozilla/5.0" -b "$COOKIE_JAR" \
    -H "Referer: $KENNEY_PAGE" -H "Accept: application/json" \
    "https://kenney.nl/download-link/$KENNEY_ID")"
  local url
  url="$(printf '%s' "$json" | python3 -c "import json,sys; print(json.load(sys.stdin)['url'])")"
  curl -sSL --max-time 180 -A "Mozilla/5.0" -b "$COOKIE_JAR" -H "Referer: $KENNEY_PAGE" \
    "$url" -o "$KENNEY_ZIP"
  local got
  got="$(sha256_of "$KENNEY_ZIP")"
  [ "$got" = "$KENNEY_SHA" ] || {
    echo "fetch-audio: Kenney zip SHA-256 mismatch (expected $KENNEY_SHA, got $got)" >&2
    exit 1
  }
  kenney_fetched=1
}

failures=0
fetched=0
skipped=0

while IFS='|' read -r -u 3 kind file sha rest; do
  target="$AUDIO_DIR/$file"
  if [ -f "$target" ] && [ "$(sha256_of "$target")" = "$sha" ]; then
    echo "fetch-audio: OK (already verified) $file"
    skipped=$((skipped + 1))
    continue
  fi
  if [ "$kind" = "bgm" ]; then
    need ffmpeg
    IFS='|' read -r url source_sha start gain fade_out_start title <<< "$rest"
    src="$WORK/src-$file"
    echo "fetch-audio: downloading original: $url"
    curl -sSLf --max-time 300 -A "Mozilla/5.0" "$url" -o "$src"
    got="$(sha256_of "$src")"
    if [ "$got" != "$source_sha" ]; then
      echo "fetch-audio: source SHA-256 mismatch for $file (expected $source_sha, got $got)" >&2
      failures=$((failures + 1)); continue
    fi
    echo "fetch-audio: trimming excerpt -> $file (start ${start}s, gain ${gain} dB)"
    ffmpeg -nostdin -v error -y -ss "$start" -t 65 -i "$src" -vn \
      -af "afade=t=in:st=0:d=0.5,afade=t=out:st=$fade_out_start:d=2.5,volume=${gain}dB,alimiter=limit=0.891:level=false" \
      -codec:a libmp3lame -b:a 128k -ar 44100 -ac 2 \
      -metadata title="$title" -metadata artist="Kevin MacLeod" "$target"
    # Kiểm tra: thời lượng + giải mã sạch. Không yêu cầu bằng nhau theo từng byte:
    # các bản mã hoá lại MP3 khác nhau giữa các bản dựng ffmpeg.
    dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$target")"
    if ! python3 -c "import sys; d=float('$dur'); sys.exit(0 if abs(d-65.0)<0.1 else 1)"; then
      echo "fetch-audio: bad duration for $file ($dur s, expected 65.0)" >&2
      # Thất bại an toàn (fail closed): không bao giờ để lại một tệp lỗi ở nơi máy chủ có thể phục vụ nó.
      rm -f "$target"
      failures=$((failures + 1)); continue
    fi
    ffmpeg -nostdin -v error -i "$target" -f null /dev/null || {
      echo "fetch-audio: decode check failed for $file" >&2
      rm -f "$target"
      failures=$((failures + 1)); continue
    }
    got="$(sha256_of "$target")"
    if [ "$got" != "$sha" ]; then
      echo "fetch-audio: note: $file re-encoded SHA-256 differs from the manifest (expected for a different ffmpeg build); duration and decode verified. got=$got"
    fi
    fetched=$((fetched + 1))
  else
    member="$rest"
    fetch_kenney_zip
    echo "fetch-audio: extracting $member -> $file"
    unzip -p "$KENNEY_ZIP" "$member" > "$target"
    got="$(sha256_of "$target")"
    if [ "$got" != "$sha" ]; then
      echo "fetch-audio: SHA-256 mismatch for $file (expected $sha, got $got)" >&2
      # Thất bại an toàn (fail closed): không bao giờ để lại một tệp không khớp ở nơi máy chủ có thể phục vụ nó.
      rm -f "$target"
      failures=$((failures + 1)); continue
    fi
    fetched=$((fetched + 1))
  fi
done 3< "$PLAN"

echo "fetch-audio: done. verified-present=$skipped fetched=$fetched failures=$failures"
[ "$failures" = 0 ] || exit 1
