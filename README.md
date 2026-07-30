# GitHub 中文翻译助手

一个无需构建的 Chrome Manifest V3 扩展。它使用代码内置的本地词库，把 `github.com` 页面中的固定英文界面文案显示为中文。

## 功能边界

- 只匹配 `https://github.com/*`，不会作用于 GitHub Pages、自建 GitHub Enterprise Server 或其他网站。
- 使用大小写敏感的完整文本匹配，不做模糊替换，也不调用远程翻译服务。
- 支持 GitHub 的 Turbo/动态导航、弹窗、菜单和异步加载内容。
- 等待页面完成加载后再执行首轮翻译，降低对页面初始化的干扰。
- 主动跳过 README/Markdown、Issue 与 Pull Request 正文、评论、仓库名、用户名、分支、标签、提交信息、源码、Diff、日志、终端及编辑区。
- `Code`、`Issues`、`Actions`、`Settings` 等歧义短词只在导航、菜单、按钮或状态组件中翻译。
- 只修改匹配到的文本节点，以及 `placeholder`、`title`、`aria-label` 属性；不会修改输入值、链接、接口、表单数据或页面业务逻辑。

## 本地安装

1. 在 Chrome 地址栏打开 `chrome://extensions/`。
2. 打开右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目根目录。
5. 打开或刷新 GitHub 页面，点击扩展图标即可暂停或开启翻译。

本项目不依赖 npm，也不需要执行构建命令。

## 自动发布

仓库包含 GitHub Actions 自动发布流程：推送 `main` 时只进行静态语法检查、生成 Chrome 安装包并保存为 Actions Artifact；只有推送与 `manifest.version` 完全一致的 `v*` 标签时，才会通过 Google Workload Identity Federation 获取短期令牌，上传 Chrome Web Store、提交审核，并在审核通过后自动发布。

首次配置 Google OIDC、Chrome Web Store 服务账号和 GitHub Environment 的完整步骤见 [`docs/github-auto-publish.md`](docs/github-auto-publish.md)。当前 `1.0.0` 已经人工上传，不能再用自动流程重复上传；第一次自动更新应使用 `1.0.1` / `v1.0.1`。

## 维护词库

词条全部位于 `dictionary.js` 的 `exact` 对象中：

```js
const exact = Object.freeze({
  "Pull requests": "拉取请求",
  "Actions": "自动化",
  "Security": "安全"
});
```

添加词条时请遵守以下规则：

1. 键必须是 GitHub 页面实际显示的完整英文文案，大小写必须一致。
2. 不要添加仓库名、用户名、分支、标签、提交信息、文件内容或用户评论。
3. 优先添加完整短语；新增单词级词条时，同时评估是否应加入上下文限制列表。
4. 不要使用部分匹配、正则翻译或远程词库，以免误改用户内容。

如果某个区域不应被翻译，可以在其容器上添加：

```html
<div data-github-translate="off">...</div>
```

## 文件结构

```text
.
├── manifest.json       # Manifest V3 配置与最小权限
├── dictionary.js       # 内置中英文词库与上下文限制
├── content.js          # 动态翻译、排除规则与英文恢复
├── popup.html          # 扩展弹窗
├── popup.css           # 弹窗视觉样式
├── popup.js            # 本地开关状态
├── icons/              # 独立设计的扩展图标
├── store-assets/        # Chrome Web Store 截图源文件、导出图与清单
├── scripts/             # 白名单打包与 Chrome Web Store 发布脚本
├── .github/workflows/   # GitHub 自动检查、打包与标签发布
├── docs/                # 自动发布配置说明
└── PRIVACY.md          # 隐私说明
```

## 隐私与声明

扩展会在浏览器本地读取页面文本并与内置词库进行精确比较。为支持关闭后恢复英文，原文会在当前页面内存中临时保留；扩展不会把页面文本持久化或上传。唯一写入 Chrome 本地扩展存储的数据是翻译开关。

完整文本匹配与上下文限制可以显著降低误译，但 GitHub 的固定界面与用户内容经常混排，无法从语义上绝对区分。遇到误译时，应优先把对应容器加入 `content.js` 的排除列表，或收紧歧义词条的上下文规则。

本项目是独立开发的非官方工具，与 GitHub, Inc. 无隶属、合作或认可关系。GitHub 是其相应权利人的商标。
