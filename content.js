(() => {
  "use strict";

  const STORAGE_KEY = "githubZhEnabled";
  const INITIAL_TRANSLATION_DELAY_MS = 800;
  const dictionaryBundle = globalThis.__GITHUB_ZH_DICTIONARY__;
  const dictionary = dictionaryBundle?.exact;

  if (!dictionary) {
    return;
  }

  const scopedRules = new Map();
  for (const { source, path, selector, attributes, translation } of dictionaryBundle.scoped ?? []) {
    const rules = scopedRules.get(source) ?? [];
    rules.push({ path, selector, attributes, translation });
    scopedRules.set(source, rules);
  }

  const contextual = dictionaryBundle.contextual ?? {};
  const navigationKeys = new Set(contextual.navigation ?? []);
  const actionKeys = new Set(contextual.action ?? []);
  const statusKeys = new Set(contextual.status ?? []);
  const fieldKeys = new Set(contextual.field ?? []);
  const badgeKeys = new Set(contextual.badge ?? []);
  const settingsKeys = new Set(contextual.settings ?? []);
  const translatableAttributes = Object.freeze([
    "placeholder",
    "data-placeholder",
    "aria-placeholder",
    "title",
    "aria-label"
  ]);
  const translatableAttributeSelector = translatableAttributes
    .map((attributeName) => `[${attributeName}]`)
    .join(",");

  /**
   * GitHub 会把固定 UI、源码和用户内容混排在同一页面中。
   * 这些选择器优先保护用户内容，即使因此漏掉少量界面词条也不冒险翻译。
   */
  const userContentSelector = [
    "[data-github-translate='off']",
    ".markdown-body",
    ".comment-body",
    ".js-comment-body",
    ".markdown-title",
    "[data-testid='markdown-body' i]",
    "[data-testid='issue-pr-title-link' i]",
    "[data-testid='issue-title' i]",
    "[data-testid='issue-title-sticky' i]",
    "[data-testid='issue-body-viewer' i]",
    "[data-testid*='comment-body' i]",
    "[data-testid*='pull-request-body' i]",
    "[data-testid*='discussion-body' i]",
    "[data-testid='mobile-description' i]",
    "[data-testid='sidebar-labels-section' i] a",
    "[data-testid='sidebar-projects-section' i] a",
    "[data-testid='sidebar-milestones-section' i] a",
    "[data-testid='repo-name-wrapper' i]",
    "[data-testid='repo-name-link' i]",
    "[data-testid*='repository-name' i]",
    "[data-testid*='branch-name' i]",
    "[data-testid*='tag-name' i]",
    "[data-testid='latest-commit-html' i]",
    "[data-testid*='commit-message' i]",
    "[data-testid*='commit-title' i]",
    "[data-testid='path-name-segment' i]",
    "[data-testid*='workflow-name' i]",
    "[data-testid*='workflow-title' i]",
    "[data-testid*='workflow-run-title' i]",
    "[data-testid*='job-name' i]",
    "[data-testid*='step-name' i]",
    "[data-testid*='check-name' i]",
    "[data-testid*='artifact-name' i]",
    "[data-testid*='annotation' i]",
    "[data-testid*='milestone-name' i]",
    "[data-testid*='project-name' i]",
    "[data-testid*='discussion-title' i]",
    "a.discussion-title",
    "h1.gh-header-title",
    "[data-testid*='branch-picker' i]",
    "[data-testid*='tag-picker' i]",
    "[data-testid*='repository-picker' i]",
    "[data-testid*='organization-picker' i]",
    "[data-testid*='team-picker' i]",
    "[data-testid*='account-picker' i]",
    "[data-testid*='owner-picker' i]",
    "[data-testid*='user-picker' i]",
    "[aria-label*='Switch branches or tags' i]",
    "[title*='Switch branches or tags' i]",
    "[itemprop='name codeRepository']",
    "[itemprop='about']",
    "[itemprop='worksFor']",
    "[itemprop='homeLocation']",
    "[itemprop='url']",
    "[itemprop='additionalName']",
    "[data-hovercard-type='user' i]",
    "[data-hovercard-type='repository' i]",
    "[data-hovercard-type='commit' i]",
    "[data-hovercard-type='issue' i]",
    "[data-hovercard-type='pull_request' i]",
    "[data-hovercard-type='discussion' i]",
    "[data-hovercard-type='label' i]",
    "[data-login]",
    "a[href*='label%3A' i]",
    "a[href*='/labels/']",
    "a[href*='/milestone/']",
    "a[href*='/topics/']",
    "a[href*='/releases/tag/']",
    "[data-component='Sidebar.Main'] a[href^='#release-']",
    "section[data-release-anchor] > h2.sr-only",
    "a[href*='/actions/workflows/']",
    "a[href*='/actions/runs/']",
    "main del",
    "main ins",
    ".js-issue-title",
    ".commit-message",
    ".commit-title",
    ".commit-desc",
    ".js-commit-message",
    ".branch-name",
    ".commit-author",
    ".p-name",
    ".p-nickname",
    ".p-note",
    ".p-org",
    ".p-label",
    ".p-locality",
    ".topic-tag",
    ".IssueLabel",
    "[data-testid*='issue-label' i]",
    ".react-directory-row",
    ".react-directory-filename-column",
    "[data-testid*='directory-row' i]",
    "[data-testid*='file-name' i]",
    "[data-testid*='project-item' i]",
    "[data-testid*='item-title' i]",
    ".project-v2-item",
    "[data-board-card-id]",
    "[aria-label^='Diff for:' i]",
    ".blob-wrapper",
    ".blob-code",
    ".js-file-line",
    ".react-code-text",
    "[data-testid*='code-cell' i]",
    "[data-testid*='code-line' i]",
    "[data-code-marker]",
    "[data-testid*='file-tree' i]",
    ".diff-table",
    "[data-testid*='diff-line' i]",
    ".js-checks-log-display",
    ".js-checks-log-display-container",
    ".js-checks-log-details",
    "[data-testid*='log-viewer' i]",
    "[data-testid*='job-summary' i]",
    "[aria-label='Annotations' i] tbody",
    ".log-line",
    ".ansi",
    ".terminal",
    ".monaco-editor",
    ".cm-editor",
    ".xterm",
    ".search-title",
    ".search-match",
    "[data-testid*='search-result' i]",
    "[aria-label*='Quick search' i] [role='option']",
    "[data-testid*='quick-search' i] [role='option']",
    "[data-testid*='issue-form' i] label",
    "[data-testid*='issue-form' i] legend",
    "[data-testid*='issue-form' i] [role='option']",
    "[data-testid*='issue-form' i] select",
    "[data-testid*='issue-form' i] input[placeholder]",
    "[data-testid*='issue-form' i] textarea[placeholder]",
    "[data-testid*='issue-create' i] label",
    "[data-testid*='issue-create' i] legend",
    "[data-testid*='issue-create' i] [role='option']",
    "[data-testid*='issue-create' i] select",
    "[data-testid*='issue-create' i] input[placeholder]",
    "[data-testid*='issue-create' i] textarea[placeholder]",
    "form[action*='/issues'] label",
    "form[action*='/issues'] legend",
    "form[action*='/issues'] [role='option']",
    "form[action*='/issues'] select",
    "form[action*='/issues'] input[placeholder]",
    "form[action*='/issues'] textarea[placeholder]",
    "[data-testid*='discussion-form' i] label",
    "[data-testid*='discussion-form' i] legend",
    "[data-testid*='discussion-form' i] [role='option']",
    "[data-testid*='discussion-form' i] select",
    "[data-testid*='discussion-form' i] input[placeholder]",
    "[data-testid*='discussion-form' i] textarea[placeholder]",
    "form[action*='/discussions'] label:not(#discussions-search-combobox-form label[for='discussions-search-combobox'])",
    "form[action*='/discussions'] legend",
    "form[action*='/discussions'] [role='option']",
    "form[action*='/discussions'] select",
    "form[action*='/discussions'] input[placeholder]:not(#discussions-search-combobox-form input#discussions-search-combobox)",
    "form[action*='/discussions'] textarea[placeholder]",
    "[data-testid*='workflow-dispatch' i] label",
    "[data-testid*='workflow-dispatch' i] [role='option']",
    "[data-testid*='workflow-dispatch' i] select",
    "[data-testid*='workflow-dispatch' i] input[placeholder]",
    "[data-testid*='workflow-dispatch' i] textarea[placeholder]",
    "form[action*='/actions/workflows/'] label",
    "form[action*='/actions/workflows/'] [role='option']",
    "form[action*='/actions/workflows/'] select",
    "form[action*='/actions/workflows/'] input[placeholder]",
    "form[action*='/actions/workflows/'] textarea[placeholder]"
  ].join(",");

  const hardIgnoredTextSelector = [
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "canvas",
    "iframe",
    "code",
    "pre",
    "kbd",
    "samp",
    "input",
    "textarea",
    "[contenteditable]:not([contenteditable='false' i])",
    "[role='textbox']",
    "[role='log']"
  ].join(",");

  const ignoredTextSelector = [
    hardIgnoredTextSelector,
    userContentSelector
  ].join(",");

  const hardIgnoredAttributeSelector = [
    "script",
    "style",
    "noscript",
    "template",
    "code",
    "pre",
    "kbd",
    "samp",
    "[contenteditable]:not([contenteditable='false' i])",
    "[role='log']"
  ].join(",");

  const ignoredAttributeSelector = [
    hardIgnoredAttributeSelector,
    userContentSelector
  ].join(",");

  const settingsCustomTextSelector = [
    "[data-testid*='application-name' i]",
    "[data-testid*='app-name' i]",
    "[data-testid*='key-name' i]",
    "[data-testid*='key-title' i]",
    "[data-testid*='token-name' i]",
    "[data-testid*='ruleset-name' i]",
    "[data-testid*='property-name' i]",
    "[data-testid*='saved-reply-title' i]",
    "[data-testid*='environment-name' i]",
    "[data-testid*='secret-name' i]",
    "[data-testid*='variable-name' i]"
  ].join(",");

  const translationRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  const connectedTranslatedNodes = new Set();
  const connectedTranslatedAttributeElements = new Set();
  const pendingRoots = new Set();
  let enabled = false;
  let preferenceLoaded = false;
  let preferredEnabled = true;
  let flushHandle = null;
  let flushMode = null;
  let startupHandle = null;
  let lastPathname = window.location.pathname;

  const normalizeText = (value) => value.replace(/\s+/gu, " ").trim();

  function getTranslatedText(sourceText, element, attributeName = null) {
    const scoped = findScopedRule(element, sourceText, attributeName);
    if (scoped) {
      return scoped.translation;
    }
    if (
      sourceText === "Name" &&
      /^\/settings(?:\/profile)?\/?$/u.test(window.location.pathname)
    ) {
      return "姓名";
    }

    return dictionary[sourceText];
  }

  const navigationRouteSegments = Object.freeze({
    "Dashboard": ["dashboard"],
    "Profile": ["profile"],
    "Pull requests": ["pulls"],
    "Pull Requests": ["pulls"],
    "Issues": ["issues"],
    "Codespaces": ["codespaces"],
    "Marketplace": ["marketplace"],
    "Explore": ["explore"],
    "Repositories": ["repositories"],
    "Organizations": ["organizations"],
    "Notifications": ["notifications"],
    "Settings": ["settings"],
    "Actions": ["actions"],
    "Projects": ["projects"],
    "Wiki": ["wiki"],
    "Security": ["security"],
    "Insights": ["pulse", "graphs"],
    "Discussions": ["discussions"],
    "Packages": ["packages"],
    "People": ["people"],
    "Teams": ["teams"],
    "Activity": ["activity"],
    "General": ["general"],
    "Access": ["access", "collaboration"],
    "Appearance": ["appearance"],
    "Archives": ["archives"],
    "Credentials": ["security"],
    "Integrations": ["integrations"],
    "Planning": ["planning"],
    "Policies": ["policies"],
    "Pushes": ["pushes"],
    "Repository": ["repository", "repositories"],
    "Configurations": ["configurations"],
    "Logs": ["logs", "audit-log"],
    "Usage": ["usage", "billing"],
    "Licensing": ["licensing", "billing"],
    "Branches": ["branches"],
    "Tags": ["tags"],
    "Releases": ["releases"],
    "Deployments": ["deployments"],
    "Environments": ["environments"],
    "Rules": ["rules"],
    "Webhooks": ["hooks"],
    "Pages": ["pages"],
    "Applications": ["applications"],
    "Pricing": ["pricing"],
    "Topics": ["topics"],
    "Trending": ["trending"],
    "Collections": ["collections"],
    "Events": ["events"]
  });

  function hasApprovedNavigationHref(element, sourceText) {
    const expectedSegments = navigationRouteSegments[sourceText];
    const link = element.closest("a[href]");

    if (!expectedSegments || !link) {
      return false;
    }

    try {
      const url = new URL(link.getAttribute("href") ?? "", window.location.origin);

      if (url.origin !== window.location.origin) {
        return false;
      }

      const segments = url.pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => segment.toLowerCase());
      const routeCandidates = new Set([
        segments[0],
        segments[2],
        url.searchParams.get("tab")?.toLowerCase()
      ]);

      if (segments[0] === "settings") {
        routeCandidates.add(segments[1]);
      }

      if (segments[2] === "settings") {
        routeCandidates.add(segments[3]);
      }

      return expectedSegments.some((segment) => routeCandidates.has(segment));
    } catch {
      return false;
    }
  }

  function isNavigationContext(element, sourceText) {
    return (
      Boolean(
        element.closest(
          [
            "nav",
            "[role='navigation']",
            "[role='tablist']",
            "[role='tab']",
            ".UnderlineNav",
            ".SideNav",
            "[data-testid*='navigation' i]"
          ].join(",")
        )
      ) || hasApprovedNavigationHref(element, sourceText)
    );
  }

  function isActionContext(element) {
    if (
      element.closest(
        "button, summary, input[type='search'], [role='button'], [role='tab'], [role='searchbox']"
      )
    ) {
      return true;
    }

    const link = element.closest("a[href]");

    if (!link) {
      return false;
    }

    const className = link.getAttribute("class") ?? "";

    return (
      /(?:^|[\s-])btn(?:[\s-]|$)/iu.test(className) ||
      /(?:^|[\s-])button(?:base)?(?:[\s-]|$)/iu.test(className) ||
      Boolean(
        link.closest(
          ".BtnGroup, [role='toolbar'], .Box-footer, .Overlay-footer"
        )
      )
    );
  }

  function isStatusContext(element) {
    const link = element.closest("a[href]");
    const href = link?.getAttribute("href")?.toLowerCase() ?? "";

    return (
      /(?:is|state)(?::|%3a)(?:open|closed|merged|draft)/u.test(href) ||
      Boolean(
        element.closest(
          [
            "[role='status']",
            "[aria-live]",
            ".State",
            ".list-row-state-icon",
            "[data-component='IssueState' i]",
            "[data-testid*='status' i]",
            "[data-testid*='state' i]",
            "[class*='StateLabel' i]"
          ].join(",")
        )
      )
    );
  }

  function isBadgeContext(element) {
    if (
      element.closest(
        ".IssueLabel, a[href*='/labels/'], [data-testid*='label' i], [data-hovercard-type='label' i]"
      )
    ) {
      return false;
    }

    return Boolean(
      element.closest(
        [
          ".Label",
          "[role='status']",
          "[data-testid*='badge' i]",
          "[data-testid*='visibility' i]",
          "[class*='badge' i]"
        ].join(",")
      )
    );
  }

  function isFieldContext(element) {
    return Boolean(
      element.closest(
        [
          "label",
          "legend",
          "dt",
          "th",
          "[role='radio']",
          "[role='checkbox']",
          "[role='columnheader']",
          "input[aria-label]",
          "textarea[aria-label]",
          "select[aria-label]",
          "[data-testid*='field-label' i]",
          "[class*='FormControl-label' i]",
          "[class*='form-label' i]"
        ].join(",")
      )
    );
  }

  function isSettingsPage() {
    const pathname = window.location.pathname;

    return (
      /^\/settings(?:\/|$)/u.test(pathname) ||
      /^\/(?:organizations|orgs)\/[^/]+\/settings(?:\/|$)/u.test(pathname) ||
      /^\/orgs\/[^/]+\/teams\/[^/]+\/settings(?:\/|$)/u.test(pathname) ||
      /^\/enterprises\/[^/]+\/settings(?:\/|$)/u.test(pathname) ||
      /^\/[^/]+\/[^/]+\/settings(?:\/|$)/u.test(pathname)
    );
  }

  /**
   * 设置页会把导航词、状态和字段名放在标题、卡片及单选项中。
   * 这里只放行明确的设置 UI 容器，用户填写的输入值仍由内容保护规则排除。
   */
  function isSettingsContext(element) {
    if (!isSettingsPage()) {
      return false;
    }

    return Boolean(
      element.closest(
        [
          "nav",
          "[role='navigation']",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "legend",
          "label",
          "dt",
          "summary",
          "button",
          "a[href*='/settings']",
          "[role='button']",
          "[role='radio']",
          "[role='checkbox']",
          "[role='tab']",
          "[role='menuitem']",
          "[role='option']",
          "option",
          "[role='status']",
          "input[placeholder]",
          "textarea[placeholder]",
          "input[aria-label]",
          "textarea[aria-label]",
          "select[aria-label]",
          ".UnderlineNav",
          ".SideNav",
          "[data-testid*='settings' i]"
        ].join(",")
      )
    );
  }

  function isSettingsDescriptionContext(element) {
    if (
      !isSettingsPage() ||
      element.closest(settingsCustomTextSelector)
    ) {
      return false;
    }

    return Boolean(
      element.closest(
        [
          "p",
          "li",
          "[class*='FormControl-caption' i]",
          "[class*='form-note' i]",
          "[class*='form-hint' i]"
        ].join(",")
      )
    );
  }

  function isProjectCustomText(element) {
    const pathname = window.location.pathname;

    if (
      !/^\/(?:orgs|users)\/[^/]+\/projects(?:\/|$)/u.test(pathname) &&
      !/^\/[^/]+\/[^/]+\/projects(?:\/|$)/u.test(pathname)
    ) {
      return false;
    }

    return Boolean(
      element.closest(
        [
          "th",
          "[role='columnheader']",
          "[role='tab']",
          "a[href*='/views/']",
          "[data-testid*='view-name' i]",
          "[data-testid*='view-title' i]",
          "[data-testid*='field-name' i]",
          "[data-testid*='column-name' i]",
          ".project-v2-view-title",
          ".project-v2-field-name"
        ].join(",")
      )
    );
  }

  function isRepositoryPathText(element, sourceText) {
    const link = element.closest("a[href]");

    if (!link) {
      return false;
    }

    try {
      const url = new URL(link.getAttribute("href") ?? "", window.location.origin);

      if (url.origin !== window.location.origin) {
        return false;
      }

      const encodedSegments = url.pathname.split("/").filter(Boolean);
      const routeIndex = 2;

      if (
        encodedSegments[routeIndex] !== "tree" &&
        encodedSegments[routeIndex] !== "blob"
      ) {
        return false;
      }

      return encodedSegments.slice(routeIndex + 1).some((segment) => {
        try {
          return decodeURIComponent(segment) === sourceText;
        } catch {
          return segment === sourceText;
        }
      });
    } catch {
      return false;
    }
  }

  function findScopedRule(element, sourceText, attributeName = null, explicitlyNamed = false) {
    return scopedRules.get(sourceText)?.find(({ path, selector, attributes }) =>
      path.test(window.location.pathname) &&
      (attributes
        ? attributes.includes(attributeName) && element.matches(selector)
        : !explicitlyNamed && Boolean(element.closest(selector)))
    );
  }

  // Match only GitHub's signed-in dashboard greeting and the session's own
  // account handle. Keep the handle byte-for-byte as shown in the heading.
  function dashboardGreeting(element, sourceText) {
    if (!/^\/(?:dashboard\/?)?$/u.test(window.location.pathname)) {
      return null;
    }
    const match = /^(Good morning|Good afternoon|Good evening|Good night|Hello), ([a-z\d-]{1,39})!$/iu.exec(sourceText);
    if (!match || !element.closest("main h1, main h2, main [role='heading']")) {
      return null;
    }
    const ownLogin = document.querySelector("meta[name='user-login']")?.getAttribute("content");
    if (!ownLogin || ownLogin.toLowerCase() !== match[2].toLowerCase()) {
      return null;
    }
    const labels = { "good morning": "早上好", "good afternoon": "下午好", "good evening": "晚上好", "good night": "晚安", hello: "你好" };
    return `${labels[match[1].toLowerCase()]}，${match[2]}！`;
  }

  function isApprovedUiText(element, sourceText, attributeName = null) {
    if (
      isProjectCustomText(element) ||
      Boolean(element.closest(settingsCustomTextSelector)) ||
      isRepositoryPathText(element, sourceText)
    ) {
      return false;
    }

    const rules = scopedRules.get(sourceText);
    if (rules) {
      if (findScopedRule(element, sourceText, attributeName)) {
        return true;
      }
      // 已有受上下文限制的词在其他页面仍沿用原有规则。
      if (!navigationKeys.has(sourceText) && !actionKeys.has(sourceText) &&
          !statusKeys.has(sourceText) && !fieldKeys.has(sourceText) &&
          !badgeKeys.has(sourceText) && !settingsKeys.has(sourceText)) {
        return false;
      }
    }

    let restricted = false;
    let approved = false;

    if (navigationKeys.has(sourceText)) {
      restricted = true;
      approved ||= isNavigationContext(element, sourceText);
    }

    if (actionKeys.has(sourceText)) {
      restricted = true;
      approved ||= isActionContext(element);
    }

    if (statusKeys.has(sourceText)) {
      restricted = true;
      approved ||= isStatusContext(element);
    }

    if (fieldKeys.has(sourceText)) {
      restricted = true;
      approved ||= isFieldContext(element);
    }

    if (badgeKeys.has(sourceText)) {
      restricted = true;
      approved ||= isBadgeContext(element);
    }

    if (settingsKeys.has(sourceText)) {
      restricted = true;
      approved ||=
        isSettingsContext(element) || isSettingsDescriptionContext(element);
    }

    if (restricted) {
      approved ||= isSettingsContext(element);
    }

    return !restricted || approved;
  }

  function shouldIgnoreTextNode(node) {
    const parent = node.parentElement;

    return (
      !parent ||
      parent.isContentEditable ||
      Boolean(parent.closest(ignoredTextSelector))
    );
  }

  function shouldIgnoreAttribute(element, attributeName) {
    if (!element.isConnected) {
      return true;
    }

    if (attributeName === "data-placeholder" || attributeName === "aria-placeholder" ||
        (attributeName === "aria-label" && element.matches("[role='textbox']"))) {
      const current = element.getAttribute(attributeName) ?? "";
      const record = getAttributeRecord(element, attributeName);
      const sourceText = current === record?.translated ? record.source : normalizeText(current);
      return !element.hasAttribute(attributeName) ||
        Boolean(element.closest(userContentSelector)) ||
        !findScopedRule(element, sourceText, attributeName, true);
    }

    if (attributeName === "placeholder") {
      return (
        !element.matches("input[placeholder], textarea[placeholder]") ||
        Boolean(element.closest(userContentSelector))
      );
    }

    return (
      !element.hasAttribute(attributeName) ||
      Boolean(element.closest(ignoredAttributeSelector)) ||
      Boolean(element.closest("[role='textbox']"))
    );
  }

  function withOriginalSpacing(original, translated) {
    const leadingWhitespace = original.match(/^\s*/u)?.[0] ?? "";
    const trailingWhitespace = original.match(/\s*$/u)?.[0] ?? "";

    return `${leadingWhitespace}${translated}${trailingWhitespace}`;
  }

  function translateTextNode(node) {
    if (!enabled || !node.isConnected) {
      return;
    }

    const currentValue = node.nodeValue ?? "";
    const previousRecord = translationRecords.get(node);
    const parent = node.parentElement;

    if (previousRecord) {
      if (shouldIgnoreTextNode(node)) {
        restoreTextNode(node);
        return;
      }

      if (currentValue === previousRecord.translated) {
        if (parent && (previousRecord.greeting
          ? dashboardGreeting(parent, previousRecord.source) === previousRecord.translated.trim()
          : isApprovedUiText(parent, previousRecord.source))) {
          connectedTranslatedNodes.add(node);
        } else {
          restoreTextNode(node);
        }

        return;
      }

      translationRecords.delete(node);
      connectedTranslatedNodes.delete(node);
    }

    const sourceText = normalizeText(currentValue);

    if (!sourceText || !parent || shouldIgnoreTextNode(node)) {
      return;
    }

    const greeting = dashboardGreeting(parent, sourceText);
    if (!greeting && !Object.prototype.hasOwnProperty.call(dictionary, sourceText)) {
      return;
    }
    const translatedText = greeting ?? getTranslatedText(sourceText, parent);

    if (
      !translatedText ||
      sourceText === translatedText ||
      (!greeting && !isApprovedUiText(parent, sourceText))
    ) {
      return;
    }

    const nextValue = withOriginalSpacing(currentValue, translatedText);

    translationRecords.set(node, {
      original: currentValue,
      translated: nextValue,
      source: sourceText,
      greeting: Boolean(greeting)
    });
    connectedTranslatedNodes.add(node);
    node.nodeValue = nextValue;
  }

  function getAttributeRecord(element, attributeName) {
    return attributeRecords.get(element)?.get(attributeName);
  }

  function setAttributeRecord(element, attributeName, record) {
    let records = attributeRecords.get(element);

    if (!records) {
      records = new Map();
      attributeRecords.set(element, records);
    }

    records.set(attributeName, record);
    connectedTranslatedAttributeElements.add(element);
  }

  function deleteAttributeRecord(element, attributeName) {
    const records = attributeRecords.get(element);

    if (!records) {
      return;
    }

    records.delete(attributeName);

    if (records.size === 0) {
      attributeRecords.delete(element);
      connectedTranslatedAttributeElements.delete(element);
    }
  }

  function translateAttribute(element, attributeName) {
    if (!enabled || !element.isConnected) {
      return;
    }

    const previousRecord = getAttributeRecord(element, attributeName);

    if (!element.hasAttribute(attributeName)) {
      if (previousRecord) {
        deleteAttributeRecord(element, attributeName);
      }

      return;
    }

    const currentValue = element.getAttribute(attributeName) ?? "";

    if (shouldIgnoreAttribute(element, attributeName)) {
      if (previousRecord) {
        restoreAttribute(element, attributeName);
      }

      return;
    }

    if (previousRecord) {
      if (currentValue === previousRecord.translated) {
        if (isApprovedUiText(element, previousRecord.source, attributeName)) {
          connectedTranslatedAttributeElements.add(element);
        } else {
          restoreAttribute(element, attributeName);
        }

        return;
      }

      deleteAttributeRecord(element, attributeName);
    }

    const sourceText = normalizeText(currentValue);

    if (
      !sourceText ||
      !Object.prototype.hasOwnProperty.call(dictionary, sourceText)
    ) {
      return;
    }

    const translatedText = getTranslatedText(sourceText, element, attributeName);

    if (
      !translatedText ||
      translatedText === sourceText ||
      !isApprovedUiText(element, sourceText, attributeName)
    ) {
      return;
    }

    const nextValue = withOriginalSpacing(currentValue, translatedText);

    setAttributeRecord(element, attributeName, {
      original: currentValue,
      translated: nextValue,
      source: sourceText
    });
    element.setAttribute(attributeName, nextValue);
  }

  function translateElementAttributes(element) {
    for (const attributeName of translatableAttributes) {
      translateAttribute(element, attributeName);
    }
  }

  function translateAttributes(root) {
    if (root.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(root);

      if (root.matches(ignoredAttributeSelector)) {
        return;
      }
    }

    if (typeof root.querySelectorAll !== "function") {
      return;
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(element) {
          if (element.matches(ignoredAttributeSelector)) {
            // Some editors draw an empty prompt from an attribute on the
            // outer host. Inspect that host only; never descend into it.
            if (element.matches("[data-placeholder], [aria-placeholder], [role='textbox'][aria-label]")) {
              translateElementAttributes(element);
            }
            return NodeFilter.FILTER_REJECT;
          }

          return element.matches(translatableAttributeSelector)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      }
    );

    while (walker.nextNode()) {
      translateElementAttributes(walker.currentNode);
    }
  }

  function translateRoot(root) {
    if (!root?.isConnected) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }

    if (
      root.nodeType !== Node.ELEMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_NODE &&
      root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) {
      return;
    }

    restoreTrackedTranslationsInProtectedAreas(root);
    translateAttributes(root);

    if (
      root.nodeType === Node.ELEMENT_NODE &&
      root.closest(ignoredTextSelector)
    ) {
      if (containsTrackedTranslations(root)) {
        restoreTextRoot(root);
      }

      return;
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return (
              node.matches(hardIgnoredTextSelector) ||
              node.matches(userContentSelector)
            )
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_SKIP;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === Node.TEXT_NODE) {
        translateTextNode(walker.currentNode);
      }
    }
  }

  function restoreTextNode(node) {
    const record = translationRecords.get(node);

    if (!record) {
      return;
    }

    if (node.nodeValue === record.translated) {
      node.nodeValue = record.original;
    }

    translationRecords.delete(node);
    connectedTranslatedNodes.delete(node);
  }

  function restoreAttribute(element, attributeName) {
    const record = getAttributeRecord(element, attributeName);

    if (!record) {
      return;
    }

    if (element.getAttribute(attributeName) === record.translated) {
      element.setAttribute(attributeName, record.original);
    }

    deleteAttributeRecord(element, attributeName);
  }

  function restoreTextRoot(root) {
    if (!root?.isConnected) {
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      restoreTextNode(root);
      return;
    }

    if (typeof root.querySelectorAll !== "function") {
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      restoreTextNode(walker.currentNode);
    }
  }

  function restoreAttributeElement(element) {
    const records = attributeRecords.get(element);

    if (!records) {
      return;
    }

    for (const attributeName of Array.from(records.keys())) {
      restoreAttribute(element, attributeName);
    }
  }

  function restoreAttributeRoot(root) {
    if (root?.nodeType === Node.ELEMENT_NODE) {
      restoreAttributeElement(root);
    }

    if (typeof root?.querySelectorAll !== "function") {
      return;
    }

    for (const element of root.querySelectorAll(translatableAttributeSelector)) {
      restoreAttributeElement(element);
    }
  }

  function restoreRoot(root) {
    restoreTextRoot(root);
    restoreAttributeRoot(root);
  }

  function isInsideUserContent(root) {
    if (root?.nodeType === Node.TEXT_NODE) {
      return Boolean(root.parentElement?.closest(userContentSelector));
    }

    return Boolean(
      root?.nodeType === Node.ELEMENT_NODE &&
      root.closest(userContentSelector)
    );
  }

  function containsTrackedTranslations(root) {
    if (!root) {
      return false;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      return translationRecords.has(root);
    }

    if (
      root.nodeType === Node.ELEMENT_NODE &&
      attributeRecords.has(root)
    ) {
      return true;
    }

    if (typeof root.contains !== "function") {
      return false;
    }

    for (const node of connectedTranslatedNodes) {
      if (root.contains(node)) {
        return true;
      }
    }

    for (const element of connectedTranslatedAttributeElements) {
      if (root.contains(element)) {
        return true;
      }
    }

    return false;
  }

  function restoreTrackedTranslationsInProtectedAreas(root) {
    if (!containsTrackedTranslations(root)) {
      return;
    }

    const containsNode = (node) => root === node || root.contains?.(node);

    for (const node of Array.from(connectedTranslatedNodes)) {
      if (containsNode(node) && shouldIgnoreTextNode(node)) {
        restoreTextNode(node);
      }
    }

    for (const element of Array.from(connectedTranslatedAttributeElements)) {
      if (!containsNode(element)) {
        continue;
      }

      const records = attributeRecords.get(element);

      for (const attributeName of Array.from(records?.keys() ?? [])) {
        if (shouldIgnoreAttribute(element, attributeName)) {
          restoreAttribute(element, attributeName);
        }
      }
    }
  }

  function pruneDetachedNodes() {
    for (const node of connectedTranslatedNodes) {
      if (!node.isConnected) {
        restoreTextNode(node);
      }
    }

    for (const element of connectedTranslatedAttributeElements) {
      if (!element.isConnected) {
        restoreAttributeElement(element);
      }
    }
  }

  function flushPendingRoots() {
    flushHandle = null;
    flushMode = null;

    if (!enabled) {
      pendingRoots.clear();
      pruneDetachedNodes();
      return;
    }

    const roots = Array.from(pendingRoots);
    pendingRoots.clear();

    for (const root of roots) {
      translateRoot(root);
    }

    pruneDetachedNodes();
  }

  function scheduleFlush() {
    if (flushHandle !== null) {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      flushMode = "idle";
      flushHandle = window.requestIdleCallback(flushPendingRoots, {
        timeout: 180
      });
      return;
    }

    flushMode = "timeout";
    flushHandle = window.setTimeout(flushPendingRoots, 60);
  }

  function cancelScheduledFlush() {
    if (flushHandle === null) {
      return;
    }

    if (flushMode === "idle" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(flushHandle);
    } else {
      window.clearTimeout(flushHandle);
    }

    flushHandle = null;
    flushMode = null;
  }

  function queueRoots(roots) {
    if (!enabled) {
      return;
    }

    const allRoots = new Set(pendingRoots);

    for (const root of roots) {
      if (!root) {
        continue;
      }

      if (isInsideUserContent(root)) {
        if (containsTrackedTranslations(root)) {
          restoreRoot(root);
        }

        continue;
      }

      allRoots.add(root);
    }

    pendingRoots.clear();

    for (const root of allRoots) {
      let ancestor = root.parentNode;
      let isCovered = false;

      while (ancestor) {
        if (allRoots.has(ancestor)) {
          isCovered = true;
          break;
        }

        ancestor = ancestor.parentNode;
      }

      if (!isCovered) {
        pendingRoots.add(root);
      }
    }

    if (pendingRoots.size > 0) {
      scheduleFlush();
    }
  }

  function queueRoot(root) {
    queueRoots([root]);
  }

  function queueMutationRoots(roots) {
    queueRoots(Array.from(roots).filter((root) => root?.isConnected));
  }

  function restoreOriginalText() {
    for (const node of connectedTranslatedNodes) {
      restoreTextNode(node);
    }

    connectedTranslatedNodes.clear();

    for (const element of connectedTranslatedAttributeElements) {
      restoreAttributeElement(element);
    }

    connectedTranslatedAttributeElements.clear();
  }

  function setEnabled(nextEnabled) {
    const shouldEnable = nextEnabled !== false;

    document.documentElement.setAttribute(
      "data-github-zh-enabled",
      shouldEnable ? "true" : "false"
    );
    document.documentElement.setAttribute(
      "data-github-zh-version",
      dictionaryBundle.version
    );

    if (enabled === shouldEnable) {
      if (shouldEnable) {
        queueRoot(document.body ?? document.documentElement);
      }

      return;
    }

    enabled = shouldEnable;
    pendingRoots.clear();
    cancelScheduledFlush();

    if (enabled) {
      queueRoot(document.body ?? document.documentElement);
    } else {
      restoreOriginalText();
    }
  }

  function refreshOnPathChange() {
    const pathname = window.location?.pathname;
    if (!pathname || pathname === lastPathname) {
      return;
    }
    lastPathname = pathname;
    if (enabled) {
      queueRoot(document.body ?? document.documentElement);
    }
  }

  document.addEventListener("turbo:load", refreshOnPathChange);
  window.addEventListener("popstate", refreshOnPathChange);

  const observer = new MutationObserver((mutations) => {
    if (!preferenceLoaded) {
      return;
    }

    refreshOnPathChange();

    let shouldPrune = false;
    const addedNodesByTarget = new Map();
    const dirtyRoots = new Set();

    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const attributeName = mutation.attributeName;

        if (translatableAttributes.includes(attributeName)) {
          const record = getAttributeRecord(mutation.target, attributeName);

          if (
            record &&
            mutation.target.getAttribute(attributeName) === record.translated
          ) {
            continue;
          }

          if (enabled) {
            dirtyRoots.add(mutation.target);
          } else {
            restoreAttribute(mutation.target, attributeName);
          }

          continue;
        }

        if (!enabled) {
          if (containsTrackedTranslations(mutation.target)) {
            restoreRoot(mutation.target);
          }

          continue;
        }

        const ignoresText = Boolean(
          mutation.target.closest(ignoredTextSelector)
        );
        const ignoresAttributes = Boolean(
          mutation.target.closest(ignoredAttributeSelector)
        );

        if (ignoresText || ignoresAttributes) {
          if (containsTrackedTranslations(mutation.target)) {
            if (ignoresText) {
              restoreTextRoot(mutation.target);
            }

            if (ignoresAttributes) {
              restoreAttributeRoot(mutation.target);
            }
          }

          if (!ignoresAttributes) {
            dirtyRoots.add(mutation.target);
          }
        } else {
          dirtyRoots.add(mutation.target);
        }

        continue;
      }

      if (mutation.type === "characterData") {
        const record = translationRecords.get(mutation.target);

        if (record && mutation.target.nodeValue === record.translated) {
          continue;
        }

        if (enabled) {
          dirtyRoots.add(mutation.target);
        } else {
          restoreTextNode(mutation.target);
        }

        continue;
      }

      if (enabled && mutation.removedNodes.length > 0) {
        shouldPrune = true;
      }

      if (mutation.addedNodes.length === 0) {
        continue;
      }

      if (isInsideUserContent(mutation.target)) {
        if (containsTrackedTranslations(mutation.target)) {
          restoreRoot(mutation.target);
        }

        continue;
      }

      const safeAddedNodes = [];

      for (const node of mutation.addedNodes) {
        if (isInsideUserContent(node)) {
          if (containsTrackedTranslations(node)) {
            restoreRoot(node);
          }
        } else {
          safeAddedNodes.push(node);
        }
      }

      if (!enabled) {
        for (const node of safeAddedNodes) {
          if (containsTrackedTranslations(node)) {
            restoreRoot(node);
          }
        }

        continue;
      }

      if (safeAddedNodes.length > 0) {
        const aggregate = addedNodesByTarget.get(mutation.target) ?? {
          count: 0,
          firstNode: safeAddedNodes[0]
        };

        aggregate.count += safeAddedNodes.length;
        addedNodesByTarget.set(mutation.target, aggregate);
      }
    }

    for (const [target, aggregate] of addedNodesByTarget) {
      dirtyRoots.add(aggregate.count === 1 ? aggregate.firstNode : target);
    }

    queueMutationRoots(dirtyRoots);

    if (enabled && shouldPrune) {
      scheduleFlush();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "contenteditable",
      "class",
      "data-github-translate",
      "data-testid",
      "data-hovercard-type",
      "data-login",
      "data-code-marker",
      "data-board-card-id",
      "data-component",
      "itemprop",
      "role",
      "type",
      "href",
      "aria-live",
      "aria-label",
      "title",
      "placeholder",
      "data-placeholder",
      "aria-placeholder"
    ]
  });

  chrome.storage.local.get(
    {
      [STORAGE_KEY]: true
    },
    (settings) => {
      preferredEnabled = settings[STORAGE_KEY] !== false;

      const startTranslation = () => {
        startupHandle = window.setTimeout(() => {
          startupHandle = null;
          preferenceLoaded = true;
          setEnabled(preferredEnabled);
        }, INITIAL_TRANSLATION_DELAY_MS);
      };

      if (document.readyState === "complete") {
        startTranslation();
      } else {
        window.addEventListener("load", startTranslation, { once: true });
      }
    }
  );

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    preferredEnabled = changes[STORAGE_KEY].newValue !== false;

    if (preferenceLoaded) {
      setEnabled(preferredEnabled);
    }
  });
})();
