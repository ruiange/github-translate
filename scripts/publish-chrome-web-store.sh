#!/usr/bin/env bash

set -euo pipefail
umask 077

ZIP_PATH="${1:-}"

require_value() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    echo "缺少环境变量：${name}" >&2
    exit 1
  fi
}

require_value CWS_ACCESS_TOKEN
require_value CWS_PUBLISHER_ID
require_value CWS_EXTENSION_ID
require_value CWS_EXPECTED_VERSION

if [[ -z "${ZIP_PATH}" || ! -f "${ZIP_PATH}" ]]; then
  echo "找不到待发布 ZIP：${ZIP_PATH:-<未传入>}" >&2
  exit 1
fi

if [[ ! "${CWS_PUBLISHER_ID}" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo "CWS_PUBLISHER_ID 格式不正确。" >&2
  exit 1
fi

if [[ ! "${CWS_EXTENSION_ID}" =~ ^[a-p]{32}$ ]]; then
  echo "CWS_EXTENSION_ID 格式不正确。" >&2
  exit 1
fi

if ! ZIP_MANIFEST_VERSION="$(unzip -p "${ZIP_PATH}" manifest.json | jq -er '.version')"; then
  echo "无法从 ZIP 中读取 manifest.json 版本。" >&2
  exit 1
fi

if [[ "${ZIP_MANIFEST_VERSION}" != "${CWS_EXPECTED_VERSION}" ]]; then
  echo "ZIP 中的版本 ${ZIP_MANIFEST_VERSION} 与预期版本 ${CWS_EXPECTED_VERSION} 不一致。" >&2
  exit 1
fi

echo "::add-mask::${CWS_ACCESS_TOKEN}"

AUTH_HEADER="$(mktemp)"
UPLOAD_RESPONSE="$(mktemp)"
STATUS_RESPONSE="$(mktemp)"
PUBLISH_RESPONSE="$(mktemp)"
CANCEL_RESPONSE="$(mktemp)"
trap 'rm -f "${AUTH_HEADER}" "${UPLOAD_RESPONSE}" "${STATUS_RESPONSE}" "${PUBLISH_RESPONSE}" "${CANCEL_RESPONSE}"' EXIT

printf 'Authorization: Bearer %s\n' "${CWS_ACCESS_TOKEN}" > "${AUTH_HEADER}"

ITEM_NAME="publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}"
UPLOAD_URL="https://chromewebstore.googleapis.com/upload/v2/${ITEM_NAME}:upload"
STATUS_URL="https://chromewebstore.googleapis.com/v2/${ITEM_NAME}:fetchStatus"
PUBLISH_URL="https://chromewebstore.googleapis.com/v2/${ITEM_NAME}:publish"
CANCEL_URL="https://chromewebstore.googleapis.com/v2/${ITEM_NAME}:cancelSubmission"

print_api_error() {
  local response_file="$1"

  if jq -e . "${response_file}" >/dev/null 2>&1; then
    jq '{error: {code: .error.code, status: .error.status, message: .error.message, details: .error.details}}' "${response_file}" >&2
  else
    echo "Chrome Web Store API 返回了无法解析的错误。" >&2
  fi
}

echo "正在上传 ${CWS_EXPECTED_VERSION} 到 Chrome Web Store..."

if ! curl \
  --fail-with-body \
  --silent \
  --show-error \
  --header "@${AUTH_HEADER}" \
  --header "Content-Type: application/zip" \
  --request POST \
  --upload-file "${ZIP_PATH}" \
  --output "${UPLOAD_RESPONSE}" \
  "${UPLOAD_URL}"; then
  print_api_error "${UPLOAD_RESPONSE}"
  exit 1
fi

jq '{itemId, crxVersion, uploadState}' "${UPLOAD_RESPONSE}"

UPLOAD_STATE="$(jq -er '.uploadState' "${UPLOAD_RESPONSE}")"
UPLOADED_ITEM_ID="$(jq -er '.itemId' "${UPLOAD_RESPONSE}")"
UPLOADED_VERSION="$(jq -r '.crxVersion // empty' "${UPLOAD_RESPONSE}")"

if [[ "${UPLOADED_ITEM_ID}" != "${CWS_EXTENSION_ID}" ]]; then
  echo "API 返回的扩展 ID 与目标不一致。" >&2
  exit 1
fi

if [[ "${UPLOAD_STATE}" == "IN_PROGRESS" || "${UPLOAD_STATE}" == "UPLOAD_IN_PROGRESS" ]]; then
  for attempt in $(seq 1 30); do
    sleep 10

    if ! curl \
      --fail-with-body \
      --silent \
      --show-error \
      --header "@${AUTH_HEADER}" \
      --output "${STATUS_RESPONSE}" \
      "${STATUS_URL}"; then
      print_api_error "${STATUS_RESPONSE}"
      exit 1
    fi

    UPLOAD_STATE="$(jq -er '.lastAsyncUploadState' "${STATUS_RESPONSE}")"
    echo "异步上传状态（${attempt}/30）：${UPLOAD_STATE}"

    if [[ "${UPLOAD_STATE}" == "SUCCEEDED" ]]; then
      break
    fi

    if [[ "${UPLOAD_STATE}" == "FAILED" || "${UPLOAD_STATE}" == "NOT_FOUND" ]]; then
      jq '{lastAsyncUploadState, submittedItemRevisionStatus}' "${STATUS_RESPONSE}" >&2
      exit 1
    fi
  done
elif [[ "${UPLOAD_STATE}" == "SUCCEEDED" ]]; then
  if [[ "${UPLOADED_VERSION}" != "${CWS_EXPECTED_VERSION}" ]]; then
    echo "API 返回版本 ${UPLOADED_VERSION:-<空>}，预期为 ${CWS_EXPECTED_VERSION}。" >&2
    exit 1
  fi
fi

if [[ "${UPLOAD_STATE}" != "SUCCEEDED" ]]; then
  echo "扩展上传未在限定时间内完成，最终状态：${UPLOAD_STATE}。商店后台可能仍在处理；重跑相同标签前请先检查开发者后台或 fetchStatus。" >&2
  exit 1
fi

echo "上传成功，正在提交审核并设置审核通过后自动发布..."

if ! curl \
  --fail-with-body \
  --silent \
  --show-error \
  --header "@${AUTH_HEADER}" \
  --header "Content-Type: application/json" \
  --request POST \
  --data-binary '{"publishType":"DEFAULT_PUBLISH","skipReview":false,"blockOnWarnings":true}' \
  --output "${PUBLISH_RESPONSE}" \
  "${PUBLISH_URL}"; then
  print_api_error "${PUBLISH_RESPONSE}"
  exit 1
fi

jq '{itemId, state, warningInfo}' "${PUBLISH_RESPONSE}"

PUBLISH_ITEM_ID="$(jq -er '.itemId' "${PUBLISH_RESPONSE}")"
PUBLISH_STATE="$(jq -er '.state' "${PUBLISH_RESPONSE}")"

if [[ "${PUBLISH_ITEM_ID}" != "${CWS_EXTENSION_ID}" ]]; then
  echo "发布响应中的扩展 ID 与目标不一致。" >&2
  exit 1
fi

case "${PUBLISH_STATE}" in
  PENDING_REVIEW|PUBLISHED)
    ;;
  STAGED)
    echo "商店只完成了预演发布（STAGED），未按 DEFAULT_PUBLISH 自动公开。" >&2
    exit 1
    ;;
  PUBLISHED_TO_TESTERS)
    echo "商店只发布给了测试人员，未按 DEFAULT_PUBLISH 自动公开。" >&2
    exit 1
    ;;
  *)
    echo "未识别的发布状态：${PUBLISH_STATE}" >&2
    exit 1
    ;;
esac

REVISION_VERIFIED=false
for attempt in $(seq 1 12); do
  if ! curl \
    --fail-with-body \
    --silent \
    --show-error \
    --header "@${AUTH_HEADER}" \
    --output "${STATUS_RESPONSE}" \
    "${STATUS_URL}"; then
    print_api_error "${STATUS_RESPONSE}"
    exit 1
  fi

  if jq -e --arg expected "${CWS_EXPECTED_VERSION}" '((.submittedItemRevisionStatus.distributionChannels // []) + (.publishedItemRevisionStatus.distributionChannels // [])) | any(.crxVersion == $expected)' "${STATUS_RESPONSE}" >/dev/null; then
    REVISION_VERIFIED=true
    break
  fi

  echo "等待商店状态同步（${attempt}/12），尚未在审核中或已发布版本里核验到 ${CWS_EXPECTED_VERSION}。"

  if [[ "${attempt}" -lt 12 ]]; then
    sleep 5
  fi
done

if [[ "${REVISION_VERIFIED}" != "true" ]]; then
  ACTIVE_SUBMISSION_COUNT="$(jq -r '(.submittedItemRevisionStatus.distributionChannels // []) | length' "${STATUS_RESPONSE}")"
  ACTIVE_SUBMISSION_STATE="$(jq -r '.submittedItemRevisionStatus.state // empty' "${STATUS_RESPONSE}")"
  CANCEL_RESULT="未发现可取消的审核中版本"

  if [[ "${ACTIVE_SUBMISSION_STATE}" == "PENDING_REVIEW" && "${ACTIVE_SUBMISSION_COUNT}" -gt 0 ]]; then
    echo "商店中的审核中版本与预期 ${CWS_EXPECTED_VERSION} 不一致，正在取消该活动提交，防止错误版本自动公开..." >&2

    if ! curl \
      --fail-with-body \
      --silent \
      --show-error \
      --header "@${AUTH_HEADER}" \
      --request POST \
      --output "${CANCEL_RESPONSE}" \
      "${CANCEL_URL}"; then
      print_api_error "${CANCEL_RESPONSE}"
      exit 1
    fi

    CANCEL_RESULT="已取消不匹配的活动提交"
    echo "${CANCEL_RESULT}。" >&2
  fi

  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      echo "## Chrome Web Store 发布异常"
      echo
      echo "- 预期版本：\`${CWS_EXPECTED_VERSION}\`"
      echo "- 版本核验：失败"
      echo "- 保护措施：${CANCEL_RESULT}"
      echo "- 后续操作：请人工检查开发者后台，不要重复上传相同版本"
    } >> "${GITHUB_STEP_SUMMARY}"
  fi

  echo "商店状态中未找到预期版本 ${CWS_EXPECTED_VERSION}，本次停止，请人工检查开发者后台。" >&2
  jq '{lastAsyncUploadState, submittedItemRevisionStatus, publishedItemRevisionStatus}' "${STATUS_RESPONSE}" >&2
  exit 1
fi

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Chrome Web Store 发布"
    echo
    echo "- 扩展版本：\`${CWS_EXPECTED_VERSION}\`"
    echo "- 商店状态：\`${PUBLISH_STATE}\`"
    echo "- 状态版本核验：通过"
    echo "- 发布策略：审核通过后自动发布"
  } >> "${GITHUB_STEP_SUMMARY}"
fi

echo "已提交 Chrome Web Store，当前状态：${PUBLISH_STATE}"
