#!/bin/sh
set -eu

VERSION="${VERSION:-0.6.0}"
OUTPUT="${OUTPUT:-dist}"

mkdir -p "$OUTPUT"

targets="linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64"

for target in $targets; do
  os="${target%%/*}"
  arch="${target##*/}"
  ext=""
  if [ "$os" = "windows" ]; then
    ext=".exe"
  fi

  # 1. Prumo Harness CLI
  cli_name="prumo-harness-cli-${os}-${arch}${ext}"
  legacy_name="prumo-${os}-${arch}${ext}"
  echo "building $cli_name"
  GOOS="$os" GOARCH="$arch" CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$OUTPUT/$cli_name" ./cmd/prumo
  cp "$OUTPUT/$cli_name" "$OUTPUT/$legacy_name"

done

# 2. Prumo Coder TUI (OpenTUI + SolidJS)
if command -v bun >/dev/null 2>&1; then
  echo "building prumo-coder"
  (cd packages/prumo-coder && bun run build)
  if [ -f "packages/prumo-coder/dist/prumo-coder.js" ]; then
    cp packages/prumo-coder/dist/prumo-coder.js "$OUTPUT/prumo-coder.js"
  fi
fi

# 3. Prumo Coder IDE (Electron + Bun + SolidJS)
if command -v bun >/dev/null 2>&1 && [ -d "packages/prumo-coder-ide" ]; then
  echo "building prumo-coder-ide"
  (cd packages/prumo-coder-ide && bun run build 2>/dev/null || true)
fi

(cd "$OUTPUT" && sha256sum prumo-* > checksums.txt)

artifacts_json=$(cd "$OUTPUT" && ls -1 prumo-* | awk '{printf "    \"%s\",\n", $0}' | sed '$ s/,$//')

cat > "$OUTPUT/release.json" <<EOF
{
  "version": "$VERSION",
  "artifacts": [
$artifacts_json
  ]
}
EOF

echo "release artifacts written to $OUTPUT"

