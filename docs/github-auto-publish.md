# GitHub 自动发布到 Chrome Web Store

仓库中的工作流设计为：

- 推送到 `main`：只检查 JavaScript、生成 Chrome 安装包并保存为 Actions Artifact。
- 推送 `v*` 标签：先执行同样的检查与打包，再上传 Chrome Web Store、提交审核，并在审核通过后自动发布。
- 手动运行工作流：只校验与打包，即使从标签页面手动运行也不会再次上传商店。
- GitHub 与 Google 之间使用 OIDC / Workload Identity Federation，只生成短期令牌，不在 GitHub 保存 Google 私钥。

当前 Chrome Web Store 条目：

```text
Publisher ID: 268b5144-1c3e-48ee-9444-91f16f83b62a
Extension ID: fjggnmaonjomepilcijjkffjfiblnnbn
GitHub Repository ID: <GITHUB_REPOSITORY_ID>
GitHub Repository: ruiange/github-translate
```

计划复用及待完成的云端配置：

```text
Google Cloud Project ID: bustling-art-240708
Google Cloud Project Number: 850818650389
Service Account: github-cws-publisher@bustling-art-240708.iam.gserviceaccount.com
Workload Identity Provider: projects/850818650389/locations/global/workloadIdentityPools/github-actions/providers/github-translate
GitHub Environment: chrome-web-store（待创建，仅允许 v* 标签）
```

Chrome Web Store 发布者账号已关联上述服务账号；新 GitHub 仓库仍需创建 `chrome-web-store` Environment，并保存 `GCP_WORKLOAD_IDENTITY_PROVIDER` 和 `GCP_SERVICE_ACCOUNT` 两项非敏感变量。整个流程不创建或保存服务账号 JSON 私钥。

> 当前 `1.0.0` 已由人工上传到商店后台，但尚未提交审核。可以先提交自动发布工作流，但不要创建 `v1.0.0` 标签。第一次自动更新应把 `manifest.json` 提升到 `1.0.1`，并创建 `v1.0.1` 标签。

## 零、先创建 GitHub 仓库

当前本地目录还不是 Git 仓库，也没有远端。先创建公开仓库 `ruiange/github-translate`，再初始化本地仓库、添加 SSH 远端并推送 `main`。仓库公开后，商店中填写的隐私政策地址 `https://github.com/ruiange/github-translate/blob/main/PRIVACY.md` 才能公开访问。

推送后获取 GitHub 的数字 Repository ID：

```bash
gh api repos/ruiange/github-translate --jq .id
```

把输出的数字替换本文中的 `<GITHUB_REPOSITORY_ID>`。OIDC Provider 必须绑定数字 ID，不能只依赖可能被转让或重命名的仓库名称。

## 一、配置 Google Cloud

以下命令用于完成新仓库的云端授权，可在已登录正确 Google 账号的 Cloud Shell 或本机 `gcloud` 中执行。服务账号和 Workload Identity Pool 已存在时应直接复用。

```bash
export GCP_PROJECT_ID="bustling-art-240708"
export GCP_SERVICE_ACCOUNT_NAME="github-cws-publisher"
export GCP_SERVICE_ACCOUNT="${GCP_SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
export GCP_WIF_POOL="github-actions"
export GCP_WIF_PROVIDER="github-translate"
export GITHUB_REPOSITORY_ID="<GITHUB_REPOSITORY_ID>"
```

确认 Chrome Web Store API、Workload Identity 和 IAM 所需 API 已经启用。以下服务账号已存在，只有在实际缺失时才执行创建命令：

```bash
gcloud services enable \
  chromewebstore.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  --project="${GCP_PROJECT_ID}"

export GCP_PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)')"

gcloud iam service-accounts create "${GCP_SERVICE_ACCOUNT_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --display-name="GitHub Chrome Web Store Publisher"
```

以下 Workload Identity Pool 已存在，只有在实际缺失时才执行创建命令：

```bash
gcloud iam workload-identity-pools create "${GCP_WIF_POOL}" \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions"
```

创建只信任当前仓库、`chrome-web-store` 环境和 `v*` 标签的 OIDC Provider：

```bash
gcloud iam workload-identity-pools providers create-oidc "${GCP_WIF_PROVIDER}" \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${GCP_WIF_POOL}" \
  --display-name="github-translate release tags" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.environment=assertion.environment,attribute.ref=assertion.ref,attribute.ref_type=assertion.ref_type,attribute.workflow_ref=assertion.workflow_ref" \
  --attribute-condition="assertion.repository_id == '${GITHUB_REPOSITORY_ID}' && assertion.environment == 'chrome-web-store' && assertion.ref_type == 'tag' && assertion.ref.startsWith('refs/tags/v') && assertion.workflow_ref.startsWith('ruiange/github-translate/.github/workflows/chrome-web-store.yml@refs/tags/v')"
```

允许这个仓库的 OIDC 身份模拟专用服务账号：

```bash
gcloud iam service-accounts add-iam-policy-binding "${GCP_SERVICE_ACCOUNT}" \
  --project="${GCP_PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WIF_POOL}/attribute.repository_id/${GITHUB_REPOSITORY_ID}"
```

获取稍后要填入 GitHub 的 Provider 完整资源名：

```bash
gcloud iam workload-identity-pools providers describe "${GCP_WIF_PROVIDER}" \
  --project="${GCP_PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${GCP_WIF_POOL}" \
  --format="value(name)"
```

Google Cloud 权限可能需要几分钟传播。整个过程不需要创建或下载服务账号 JSON 密钥。

## 二、授权 Chrome Web Store 服务账号

1. 打开 Chrome Web Store 开发者信息中心。
2. 进入“账号”页面。
3. 在服务账号区域添加上一步的 `GCP_SERVICE_ACCOUNT` 邮箱。
4. 确认保存。

Chrome Web Store 当前每个发布者只能关联一个服务账号。如果账号中已经存在服务账号，应复用或先确认旧流程是否仍在使用，不要直接替换。

## 三、配置 GitHub Environment

打开仓库：

```text
Settings → Environments → New environment
```

创建名为 `chrome-web-store` 的 Environment，然后添加两个 Environment Variables：

| 名称 | 值 |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/850818650389/locations/global/workloadIdentityPools/github-actions/providers/github-translate` |
| `GCP_SERVICE_ACCOUNT` | `github-cws-publisher@bustling-art-240708.iam.gserviceaccount.com` |

在 Environment 的 Deployment branches and tags 中只允许：

```text
Selected deployment branches and tags → Tag → v*
```

若要求完全自动发布，不配置 Required reviewers；若希望每次上传商店前人工确认，可以再启用 reviewer。

## 四、发布新版本

先等待商店中的上一版本审核结束。然后修改 `manifest.json`：

```json
{
  "version": "1.0.1"
}
```

提交并推送 `main`，确认 `Chrome Web Store / 校验并打包` 成功，再创建与 Manifest 完全一致的标签：

```bash
git tag v1.0.1
git push origin v1.0.1
```

标签触发后，工作流会自动：

1. 拒绝重复发布已人工上传的 `1.0.0`，并校验标签与 `manifest.version` 完全一致。
2. 确认标签指向 `main` 分支已有的提交。
3. 用明确白名单生成 ZIP，并核对 ZIP 内文件清单。
4. 用 GitHub OIDC 换取 Google 短期访问令牌。
5. 调用 Chrome Web Store API v2 上传新版本。
6. 等待异步上传完成。
7. 以 `DEFAULT_PUBLISH`、`skipReview: false`、`blockOnWarnings: true` 提交审核。
8. 从 `fetchStatus` 核对已提交或已发布版本确实为标签对应版本。
9. 若检测到不匹配版本仍在审核中，调用 `cancelSubmission` 取消活动提交并停止流程。
10. 核验通过后等待审核，审核通过即自动发布。

同一扩展的发布任务使用固定并发组和 `queue: max` 串行排队，避免两个版本同时调用商店接口，也不会用新任务取消正在上传的任务。

Chrome Web Store 不允许重复上传相同或更低版本。不要重复使用旧标签，也不要同时连续推送多个版本标签。

GitHub 的并发组只能约束 Actions 任务，不能约束开发者后台的手工操作。Actions 上传、提审和状态核验期间，不要在后台手工上传或提交同一扩展。

## 五、失败时检查

- `标签 ... 与 manifest 版本 ... 不一致`：修改版本或重新创建正确标签。
- `缺少 GitHub Variable`：检查变量是否放在精确命名的 `chrome-web-store` Environment 中。
- OIDC / `unauthorized_client`：等待 Google IAM 权限传播，并复查 Provider 完整资源名、仓库 ID、Environment 名称和服务账号 IAM 绑定。
- Chrome Web Store 返回权限错误：确认已启用 API，且服务账号邮箱已经加入正确的 Chrome Web Store 发布者账号。
- 异步上传超时：商店后台可能仍在继续处理；先查看开发者后台或 `fetchStatus`，不要盲目重跑相同标签。
- 状态版本核验失败：脚本会取消确认不匹配且仍处于审核中的活动提交；若版本已经公开或没有可取消提交，只会停止并告警。之后应人工确认商店状态，不要重复上传相同版本。
- `PENDING_REVIEW`：上传已经成功，正在等待商店审核，不代表已公开。

## 六、官方参考

- [Chrome Web Store API v2：上传扩展包](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/media/upload)
- [Chrome Web Store API v2：提交发布](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish)
- [Chrome Web Store API v2：查询状态](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/fetchStatus)
- [Chrome Web Store API v2：取消活动提交](https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/cancelSubmission)
- [GitHub Actions 并发与队列](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [GitHub Actions 使用 Google Cloud OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-google-cloud-platform)
