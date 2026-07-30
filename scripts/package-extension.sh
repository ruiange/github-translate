#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${1:-${REPO_ROOT}/dist}"

cd "${REPO_ROOT}"

VERSION="$(node -e '
  const manifest = require("./manifest.json");
  const parts = String(manifest.version).split(".");
  const valid =
    parts.length >= 1 &&
    parts.length <= 4 &&
    parts.every((part) => /^(0|[1-9][0-9]*)$/.test(part) && Number(part) <= 65535) &&
    parts.some((part) => Number(part) !== 0);

  if (!valid) {
    throw new Error(`非法 Chrome 扩展版本号：${manifest.version}`);
  }

  process.stdout.write(manifest.version);
')"

PACKAGE_FILES=(
  manifest.json
  dictionary.js
  content.js
  popup.html
  popup.css
  popup.js
  icons/icon-16.png
  icons/icon-32.png
  icons/icon-48.png
  icons/icon-128.png
)

for package_file in "${PACKAGE_FILES[@]}"; do
  if [[ ! -f "${package_file}" ]]; then
    echo "缺少打包文件：${package_file}" >&2
    exit 1
  fi
done

mkdir -p "${OUTPUT_DIR}"
ZIP_PATH="${OUTPUT_DIR}/github-chinese-translator-${VERSION}.zip"
rm -f -- "${ZIP_PATH}"

zip -X -9 -q "${ZIP_PATH}" "${PACKAGE_FILES[@]}"
unzip -tqq "${ZIP_PATH}"

EXPECTED_LIST="$(mktemp)"
ACTUAL_LIST="$(mktemp)"
trap 'rm -f "${EXPECTED_LIST}" "${ACTUAL_LIST}"' EXIT

printf '%s\n' "${PACKAGE_FILES[@]}" | LC_ALL=C sort > "${EXPECTED_LIST}"
unzip -Z1 "${ZIP_PATH}" | LC_ALL=C sort > "${ACTUAL_LIST}"

if ! diff -u "${EXPECTED_LIST}" "${ACTUAL_LIST}"; then
  echo "安装包文件清单与白名单不一致。" >&2
  exit 1
fi

printf '%s\n' "${ZIP_PATH}"
