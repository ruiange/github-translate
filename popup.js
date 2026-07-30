(() => {
  "use strict";

  const STORAGE_KEY = "githubZhEnabled";
  const toggle = document.querySelector("#translation-toggle");
  const stateLabel = document.querySelector("#translation-state");
  const hintLabel = document.querySelector("#translation-hint");
  const version = document.querySelector("#version");

  version.textContent = `V${chrome.runtime.getManifest().version}`;

  function render(enabled, errorMessage = "") {
    toggle.checked = enabled;
    stateLabel.textContent = enabled ? "翻译已开启" : "当前已暂停";

    if (errorMessage) {
      hintLabel.textContent = errorMessage;
      return;
    }

    hintLabel.textContent = enabled
      ? "动态页面会自动继续翻译"
      : "已打开页面会恢复原始英文";
  }

  chrome.storage.local.get(
    {
      [STORAGE_KEY]: true
    },
    (settings) => {
      const readError = chrome.runtime.lastError;

      render(
        settings[STORAGE_KEY] !== false,
        readError ? "读取设置失败，已使用默认状态" : ""
      );
      toggle.disabled = false;
      document.body.dataset.ready = "true";
    }
  );

  toggle.addEventListener("change", () => {
    const nextEnabled = toggle.checked;
    const previousEnabled = !nextEnabled;

    render(nextEnabled);
    toggle.disabled = true;

    chrome.storage.local.set(
      {
        [STORAGE_KEY]: nextEnabled
      },
      () => {
        const hasError = Boolean(chrome.runtime.lastError);

        toggle.disabled = false;

        if (hasError) {
          render(previousEnabled, "设置保存失败，请重试");
        }
      }
    );
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      render(changes[STORAGE_KEY].newValue !== false);
    }
  });
})();
