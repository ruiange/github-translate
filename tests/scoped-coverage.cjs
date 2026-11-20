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
