const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");

const scripts = ["dictionary.js", "content.js"].map((filename) =>
  fs.readFileSync(path.join(__dirname, "..", filename), "utf8")
);

function setup(pathname, markup) {
  const dom = new JSDOM(markup, {
    url: `https://github.com${pathname}`,
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const { window } = dom;
  const listeners = [];
  window.chrome = {
    storage: {
      local: { get: (defaults, callback) => callback(defaults) },
      onChanged: { addListener: (callback) => listeners.push(callback) }
    }
  };
  const setEnabled = (state) => {
    for (const listener of listeners) {
      listener({ githubZhEnabled: { newValue: state } }, "local");
    }
  };
  for (const script of scripts) {
    window.eval(script);
  }
  return { window, dom, document: window.document, setEnabled };
}

async function assertValue(document, [selector, expected, attribute]) {
  const readValue = () => {
    const node = document.querySelector(selector);
    return attribute ? node?.getAttribute(attribute) : node?.textContent?.trim();
  };
  for (let attempt = 0; attempt < 60 && readValue() !== expected; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(readValue(), expected, `${selector}${attribute ? ` [${attribute}]` : ""}`);
}

  const cases = [
    ["/cli/cli/releases", `
      <h1 data-component="PH_Title">Releases</h1>
      <nav><a href="/cli/cli/tags" id="tags-link">Tags</a></nav>
      <input id="release-filter" placeholder="Find a release" aria-label="Find a release" value="Find a release">
      <select-panel id="select-panel-test"><dialog-helper>
        <button><span class="Button-label">Compare</span></button>
        <dialog open>
          <h1 class="Overlay-title">Choose a tag to compare</h1>
          <div class="Overlay-footer"><a href="/cli/cli/tags">View all tags</a></div>
        </dialog>
      </dialog-helper></select-panel>
      <details-toggle><details>
        <summary role="button" data-target="details-toggle.summaryTarget"><span class="text-bold">Assets</span></summary>
        <a href="/cli/cli/archive/refs/tags/v1.zip"><span class="text-bold">Source code</span></a>
        <a id="asset" href="/cli/cli/releases/download/v1/Assets"><span class="text-bold">Assets</span></a>
      </details></details-toggle>
      <a href="/cli/cli/releases/latest"><span class="Label">Latest</span></a>
      <h2 id="custom-title"><a href="/cli/cli/releases/tag/v1">Latest</a></h2>
      <div class="markdown-body"><p id="notes">Source code</p></div>
    `, [
      ["h1[data-component]", "发行版"],
      ["#tags-link", "标签"],
      ["#release-filter", "查找发行版", "placeholder"],
      ["#release-filter", "查找发行版", "aria-label"],
      ["#release-filter", "Find a release", "value"],
      [".Button-label", "比较"],
      [".Overlay-title", "选择要比较的标签"],
      [".Overlay-footer a", "查看所有标签"],
      ["summary .text-bold", "资源文件"],
      ["a[href$='.zip'] .text-bold", "源代码"],
      ["a .Label", "最新版"],
      ["#asset", "Assets"],
      ["#custom-title", "Latest"],
      ["#notes", "Source code"]
    ]],
    ["/cli/cli/tags", `
      <h1 data-component="PH_Title">Tags</h1>
      <section aria-label="Tags results">
        <div class="Box-header">Tags</div>
        <div class="commit"><div class="color-fg-muted"><span id="immutable">Immutable</span></div></div>
        <a id="custom-tag" href="/cli/cli/releases/tag/Immutable">Immutable</a>
      </section>
    `, [
      ["h1", "标签"],
      [".Box-header", "标签"],
      ["#immutable", "不可变"],
      ["#custom-tag", "Immutable"]
    ]],
    ["/vercel/next.js/discussions", `
      <h2 id="pinned-discussions">Pinned Discussions</h2>
      <form id="discussions-search-combobox-form" action="/vercel/next.js/discussions">
        <label for="discussions-search-combobox">Search all discussions</label>
        <input id="discussions-search-combobox" placeholder="Search all discussions">
      </form>
      <form action="/vercel/next.js/discussions/new">
        <label id="custom-label">Search all discussions</label>
        <input id="custom-field" placeholder="Search all discussions">
      </form>
      <dialog id="label-select-menu-dialog" open><h1 class="Overlay-title">Filter by label</h1></dialog>
      <nav class="NavigationList"><a href="/vercel/next.js/discussions"><span class="ActionList-item-label">View all discussions</span></a>
        <a id="category" href="/vercel/next.js/discussions/categories/general"><span class="ActionList-item-label">View all discussions</span></a></nav>
      <a id="discussion" href="/vercel/next.js/discussions/123">Pinned Discussions</a>
      <div class="markdown-body"><p id="comment">Search all discussions</p></div>
    `, [
      ["#pinned-discussions", "置顶讨论"],
      ["label", "搜索所有讨论"],
      ["#discussions-search-combobox", "搜索所有讨论", "placeholder"],
      [".Overlay-title", "按标签筛选"],
      ["nav a:first-child", "查看所有讨论"],
      ["#category", "View all discussions"],
      ["#discussion", "Pinned Discussions"],
      ["#comment", "Search all discussions"],
      ["#custom-label", "Search all discussions"],
      ["#custom-field", "Search all discussions", "placeholder"]
    ]],
    ["/cli/cli/actions", `
      <turbo-frame id="repo-content-turbo-frame"><react-app app-name="repo">
        <input id="action-filter" role="combobox" placeholder="Search runs">
        <span data-testid="workflow-title">Search runs</span>
      </react-app></turbo-frame>
      <input id="other-filter" role="combobox" placeholder="Search runs">
    `, [
      ["#action-filter", "搜索运行记录", "placeholder"],
      ["[data-testid='workflow-title']", "Search runs"],
      ["#other-filter", "Search runs", "placeholder"]
    ]],
    ["/trending", `
      <nav class="subnav"><a href="/trending/developers">Developers</a></nav>
      <details id="select-menu-language"><summary>Language: <span class="text-bold">Any</span></summary>
        <span class="select-menu-title">Select a language</span>
        <input placeholder="Filter languages" aria-label="Type or choose a language">
        <a><span class="select-menu-item-text">Any</span></a>
      </details>
      <details id="select-menu-date"><summary>Date range: <span class="text-bold">This week</span></summary>
        <a role="menuitemradio"><span class="select-menu-item-text">This month</span></a>
      </details>
      <article><h2 id="repo-name">Developers</h2></article>
    `, [
      ["nav a", "开发者"],
      ["#select-menu-language summary", "编程语言： 不限"],
      ["#select-menu-language input", "筛选编程语言", "placeholder"],
      ["#select-menu-language input", "输入或选择编程语言", "aria-label"],
      ["#select-menu-language a", "Any"],
      ["#select-menu-date summary", "日期范围： 本周"],
      ["#select-menu-date a", "本月"],
      ["#repo-name", "Developers"]
    ]],
    ["/topics", `
      <div class="application-main"><main><div class="color-bg-subtle"><div class="container-lg">
        <p>Browse popular topics on GitHub.</p>
      </div></div><div class="container-lg"><h2>All featured topics</h2>
        <h3 id="topic">Popular topics</h3><h2 id="sidebar">Popular topics</h2></div></main></div>
    `, [
      ["main p", "浏览 GitHub 上的热门主题。"],
      ["main h2", "全部精选主题"],
      ["#sidebar", "热门主题"],
      ["#topic", "Popular topics"]
    ]]
  ];


for (const [pathname, markup, checks] of cases) {
  test(`页面与控件范围：${pathname}`, async (t) => {
    const { dom, document } = setup(pathname, markup);
    t.after(() => dom.window.close());
    for (const check of checks) {
      await assertValue(document, check);
    }
  });
}

test("Turbo 跳转、返回与异步插入后重新检查翻译范围", async (t) => {
  const { dom, window, document, setEnabled } = setup(
    "/topics", cases.at(-1)[1]
  );
  t.after(() => dom.window.close());
  await assertValue(document, ["#sidebar", "热门主题"]);
  window.history.pushState(null, "", "/outside-topics");
  document.dispatchEvent(new window.Event("turbo:load"));
  await assertValue(document, ["#sidebar", "Popular topics"]);
  window.history.back();
  await assertValue(document, ["#sidebar", "热门主题"]);

  document.querySelector("#sidebar")
    .insertAdjacentHTML("afterend", '<h2 id="dynamic">Popular topics</h2>');
  await assertValue(document, ["#dynamic", "热门主题"]);
  setEnabled(false);
  await assertValue(document, ["#dynamic", "Popular topics"]);
  setEnabled(true);
  await assertValue(document, ["#dynamic", "热门主题"]);
});

test("关闭扩展时恢复占位符和无障碍标签，不改变输入值", async (t) => {
  const { dom, document, setEnabled } = setup("/cli/cli/releases", `
    <input id="release-filter" aria-label="Find a release" placeholder="Find a release" value="Find a release">
  `);
  t.after(() => dom.window.close());
  await assertValue(document, ["#release-filter", "查找发行版", "placeholder"]);
  document.querySelector("#release-filter").value = "user typed";
  setEnabled(false);
  await assertValue(document, ["#release-filter", "Find a release", "placeholder"]);
  await assertValue(document, ["#release-filter", "Find a release", "aria-label"]);
  assert.equal(document.querySelector("#release-filter").value, "user typed");
});

test("dashboard translates verified chrome and native hints, not user contents or keyboard markup", async () => {
  const { window, document, setEnabled } = setup("/", `
    <meta name="user-login" content="fixture-user">
    <header><button aria-haspopup="dialog" aria-label="Open quick search dialog, type / to search" id="global-search"><span>Type</span> <kbd>/</kbd> <span>to search</span></button></header>
    <aside class="feed-left-sidebar">
      <h3>Pin your homepage <span id="new-feature">New</span></h3>
      <p>Choose whether github.com opens to Home or Feed. Select the pin next to either one.</p>
      <button>Got it</button><button>Add repositories</button>
      <p>Add the repositories you use most.</p>
    </aside>
    <main>
      <h1 id="greeting">Good afternoon, fixture-user!</h1>
      <div class="markdown-body"><h2 id="quoted-greeting">Good afternoon, fixture-user!</h2></div>
      <h3 id="other-greeting">Good afternoon, other-user!</h3>
      <react-partial partial-name="copilot-chat-input-partial">
        <textarea id="copilot-chat-textarea" placeholder="Ask anything or type @ to add context" aria-label="Ask anything or type @ to add context with Copilot">Ask anything or type @ to add context</textarea>
        <button data-component="ActionMenu.Button" id="ask"><span>Ask</span></button>
        <button id="model">Model: Auto</button><button id="optimize">Optimized for: Balance</button>
        <ul><li><button data-component="Button">Create issue</button></li></ul>
        <div id="editable" contenteditable="true" role="textbox" data-placeholder="Ask anything"><span id="typed">Ask anything</span></div>
        <div id="alt-editable" contenteditable="plaintext-only" role="textbox" aria-placeholder="Ask anything"><span>Ask anything</span></div>
        <div id="unknown" contenteditable="true" role="textbox" data-placeholder="My custom placeholder">Ask anything</div>
      </react-partial>
      <textarea id="external" placeholder="Ask anything or type @ to add context"></textarea>
      <react-partial app-name="dashboard-lists">
        <div><h2 id="pull-heading">Pull requests</h2><a data-component="Link" href="/pulls" id="view-pulls">View all pull requests</a></div>
        <section><div><p id="empty-pulls">No pull requests found, try a different filter.</p></div></section>
        <div><h2 id="issue-heading">Issues</h2></div>
        <section><h3 id="repos-heading">Repositories</h3><p id="empty-issues">No issues found, try a different filter.</p></section>
      </react-partial>
      <aside class="dashboard-changelog">
        <h2 class="dashboard-changelog__title">Latest from our changelog</h2>
        <a id="changelog-link" href="https://github.blog/changelog/">View changelog →</a>
        <a id="changelog-entry" href="https://github.blog/changelog/2026-08-10-entry/">View changelog →</a>
      </aside>
    </main>
    <footer><button>Manage cookies</button><a>Do not share my personal information</a></footer>
  `);
  const key = document.querySelector("#global-search kbd");
  const original = document.querySelector("#copilot-chat-textarea").value;
  await assertValue(document, ["#greeting", "下午好，fixture-user！"]);
  await Promise.all([
    ["#quoted-greeting", "Good afternoon, fixture-user!"], ["#other-greeting", "Good afternoon, other-user!"],
    ["#global-search span:nth-of-type(1)", "按"], ["#global-search span:nth-of-type(2)", "搜索"],
    ["#global-search", "打开快速搜索对话框，按 / 搜索", "aria-label"], ["#new-feature", "新功能"],
    [".feed-left-sidebar p:first-of-type", "选择打开 github.com 时进入首页还是动态。点击对应选项旁的图钉即可固定。"],
    [".feed-left-sidebar button", "知道了"], [".feed-left-sidebar button:nth-of-type(2)", "添加仓库"],
    ["#copilot-chat-textarea", "问任何问题，或输入 @ 添加上下文", "placeholder"],
    ["#copilot-chat-textarea", "向 Copilot 提问，或输入 @ 添加上下文", "aria-label"],
    ["#ask", "提问"], ["#model", "模型：自动"], ["#optimize", "优化目标：均衡"],
    ["react-partial li button", "新建议题"],
    ["#editable", "问任何问题", "data-placeholder"], ["#alt-editable", "问任何问题", "aria-placeholder"],
    ["#typed", "Ask anything"], ["#unknown", "My custom placeholder", "data-placeholder"],
    ["#external", "Ask anything or type @ to add context", "placeholder"],
    ["#pull-heading", "拉取请求"], ["#issue-heading", "议题"], ["#repos-heading", "仓库"],
    ["#view-pulls", "查看所有拉取请求"], ["#empty-pulls", "未找到拉取请求，请试试其他筛选条件。"],
    ["#empty-issues", "未找到议题，请试试其他筛选条件。"],
    [".dashboard-changelog__title", "最新更新日志"], ["#changelog-link", "查看更新日志 →"], ["#changelog-entry", "View changelog →"],
    ["footer button", "管理 Cookie"], ["footer a", "请勿共享我的个人信息"]
  ].map(probe => assertValue(document, probe)));
  assert.equal(document.querySelector("#global-search kbd"), key);
  assert.equal(key.textContent, "/");
  assert.equal(document.querySelector("#copilot-chat-textarea").value, original);

  const editable = document.querySelector("#editable");
  editable.setAttribute("data-placeholder", "My custom placeholder");
  await assertValue(document, ["#editable", "My custom placeholder", "data-placeholder"]);
  editable.setAttribute("data-placeholder", "Ask anything or type @ to add context");
  await assertValue(document, ["#editable", "问任何问题，或输入 @ 添加上下文", "data-placeholder"]);
  const textarea = document.querySelector("#copilot-chat-textarea");
  textarea.value = "自拟提示 Ask anything";
  window.history.pushState({}, "", "/fixture/repo/issues");
  document.dispatchEvent(new window.Event("turbo:load"));
  await assertValue(document, ["#editable", "Ask anything or type @ to add context", "data-placeholder"]);
  await assertValue(document, ["#greeting", "Good afternoon, fixture-user!"]);
  assert.equal(textarea.value, "自拟提示 Ask anything");
  window.history.pushState({}, "", "/");
  document.dispatchEvent(new window.Event("turbo:load"));
  await assertValue(document, ["#editable", "问任何问题，或输入 @ 添加上下文", "data-placeholder"]);
  setEnabled(false);
  await assertValue(document, ["#editable", "Ask anything or type @ to add context", "data-placeholder"]);
  await assertValue(document, ["#alt-editable", "Ask anything", "aria-placeholder"]);
  await assertValue(document, ["#copilot-chat-textarea", "Ask anything or type @ to add context", "placeholder"]);
  await assertValue(document, ["#copilot-chat-textarea", "Ask anything or type @ to add context with Copilot", "aria-label"]);
  assert.equal(textarea.value, "自拟提示 Ask anything");
  setEnabled(true);
  await assertValue(document, ["#editable", "问任何问题，或输入 @ 添加上下文", "data-placeholder"]);
  window.close();
});

test("scoped hints translate on list filters while preserving the actual query and authored fields", async () => {
  const table = [
    ["/fixture/repo/issues", "Search issues", "搜索议题", "Clear filter", "清除筛选"],
    ["/fixture/repo/pulls", "Search pull requests", "搜索拉取请求", "Sort by Newest descending", "按创建时间从新到旧排序"],
    ["/fixture/repo/pull/42/files", "Filter changed files", "筛选已更改的文件", "Clear filters", "清除筛选"],
    ["/fixture/repo/labels", "Search all labels", "搜索所有标签"],
    ["/notifications", "Search notifications", "搜索通知", "Manage notifications", "管理通知"],
    ["/orgs/fixture/projects/12/views/1", "Filter by keyword or by field", "按关键词或字段筛选", "Add items", "添加条目"]
  ];
  await Promise.all(table.map(async ([route, source, translated, fixedAction, localizedAction]) => {
    const { window, document, setEnabled } = setup(route, `
      <main>
        <input id="query" type="search" placeholder="${source}" aria-label="${source}">
        <button id="chrome">${fixedAction ?? ""}</button>
        <div class="markdown-body"><p id="authored">${fixedAction ?? source}</p></div>
        <textarea id="custom" placeholder="${source}"></textarea>
      </main>`);
    const input = document.querySelector("#query");
    input.value = source;
    await assertValue(document, ["#query", translated, "placeholder"]);
    await assertValue(document, ["#query", translated, "aria-label"]);
    if (fixedAction) await assertValue(document, ["#chrome", localizedAction]);
    await assertValue(document, ["#authored", fixedAction ?? source]);
    await assertValue(document, ["#custom", source, "placeholder"]);
    assert.equal(input.value, source);
    setEnabled(false);
    await assertValue(document, ["#query", source, "placeholder"]);
    window.close();
  }));
});

test("new protections label fixed settings controls without translating authorization values", async () => {
  const { window, document } = setup("/fixture/repo/settings/branches", `
    <main>
      <h2>Protect matching branches</h2>
      <label><input type="checkbox">Require a pull request before merging</label>
      <input id="rename" value="Require a pull request before merging">
      <div data-testid="ruleset-name"><button id="rule-name">Require a pull request before merging</button></div>
    </main>
  `);
  await assertValue(document, ["h2", "保护匹配的分支"]);
  await assertValue(document, ["label", "合并前必须发起拉取请求"]);
  await assertValue(document, ["#rule-name", "Require a pull request before merging"]);
  assert.equal(document.querySelector("#rename").value, "Require a pull request before merging");
  window.close();
});
