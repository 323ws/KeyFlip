if (typeof importScripts === 'function' && typeof KeyFlipEngine === 'undefined') {
  try {
    importScripts('layouts.js');
  } catch (e) {}
}

const browserAPI = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

if (browserAPI && browserAPI.runtime) {
  browserAPI.runtime.onInstalled.addListener(() => {
    if (browserAPI.storage && browserAPI.storage.sync) {
      browserAPI.storage.sync.get(['primaryLayout', 'secondaryLayout', 'theme', 'enabled', 'showNotification'], (data) => {
        const defaults = {
          primaryLayout: (data && data.primaryLayout) || 'en_us',
          secondaryLayout: (data && data.secondaryLayout) || 'ar_101',
          theme: (data && data.v111_theme_reset && data.theme) ? data.theme : 'dark',
          v111_theme_reset: true,
          enabled: (data && data.enabled !== undefined) ? data.enabled : true,
          showNotification: (data && data.showNotification !== false)
        };
        browserAPI.storage.sync.set(defaults);
      });
    }

    if (browserAPI.contextMenus && browserAPI.contextMenus.removeAll) {
      browserAPI.contextMenus.removeAll(() => {
        browserAPI.contextMenus.create({
          id: 'keyflip-convert-selection',
          title: 'KeyFlip: Convert Selection (Ctrl+Space)',
          contexts: ['selection', 'editable']
        });
      });
    }
  });

  if (browserAPI.omnibox) {
    browserAPI.omnibox.onInputChanged.addListener((text, suggest) => {
      if (!text) return;

      browserAPI.storage.sync.get(['primaryLayout', 'secondaryLayout'], (settings) => {
        const l1 = (settings && settings.primaryLayout) || 'en_us';
        const l2 = (settings && settings.secondaryLayout) || 'ar_101';
        const engine = typeof KeyFlipEngine !== 'undefined' ? KeyFlipEngine : null;
        if (!engine) return;
        const result = engine.convertTextBetween(text, l1, l2);

        suggest([
          {
            content: result.convertedText,
            description: `KeyFlip [${result.direction}]: <match>${escapeXml(result.convertedText)}</match> (Press Enter to search)`
          }
        ]);
      });
    });

    browserAPI.omnibox.onInputEntered.addListener((text, disposition) => {
      browserAPI.storage.sync.get(['primaryLayout', 'secondaryLayout'], (settings) => {
        const l1 = (settings && settings.primaryLayout) || 'en_us';
        const l2 = (settings && settings.secondaryLayout) || 'ar_101';
        const engine = typeof KeyFlipEngine !== 'undefined' ? KeyFlipEngine : null;
        if (!engine) return;
        const result = engine.convertTextBetween(text, l1, l2);
        const converted = result.convertedText;

        let targetUrl = '';
        if (/^https?:\/\//i.test(converted) || /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(converted)) {
          targetUrl = /^https?:\/\//i.test(converted) ? converted : 'https://' + converted;
        } else {
          targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(converted);
        }

        if (disposition === 'currentTab') {
          browserAPI.tabs.update({ url: targetUrl });
        } else {
          browserAPI.tabs.create({ url: targetUrl });
        }
      });
    });
  }

  if (browserAPI.commands) {
    browserAPI.commands.onCommand.addListener((command) => {
      if (command === 'convert-selection') {
        triggerConversionInActiveTab();
      }
    });
  }

  if (browserAPI.contextMenus) {
    browserAPI.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'keyflip-convert-selection' && tab && tab.id) {
        triggerConversionInActiveTab(tab.id);
      }
    });
  }
}

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c] || c));
}

function triggerConversionInActiveTab(specificTabId) {
  const browserAPI = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (!browserAPI) return;

  if (specificTabId) {
    sendMessageToTab(specificTabId);
    return;
  }

  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const activeTab = tabs[0];
    if (!activeTab.id || activeTab.url?.startsWith('chrome://') || activeTab.url?.startsWith('about:') || activeTab.url?.startsWith('chrome-extension://') || activeTab.url?.startsWith('moz-extension://')) {
      return;
    }

    sendMessageToTab(activeTab.id);
  });
}

function sendMessageToTab(tabId) {
  const browserAPI = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (!browserAPI) return;

  browserAPI.storage.sync.get(['enabled', 'primaryLayout', 'secondaryLayout', 'showNotification'], (settings) => {
    if (settings && settings.enabled === false) return;

    const message = {
      action: 'CONVERT_SELECTION',
      primaryLayout: (settings && settings.primaryLayout) || 'en_us',
      secondaryLayout: (settings && settings.secondaryLayout) || 'ar_101',
      showNotification: (settings && settings.showNotification !== false)
    };

    browserAPI.tabs.sendMessage(tabId, message, () => {
      if (browserAPI.runtime.lastError && browserAPI.scripting) {
        browserAPI.scripting.executeScript({
          target: { tabId: tabId, allFrames: true },
          files: ['layouts.js', 'content.js']
        }).then(() => {
          if (browserAPI.scripting.insertCSS) {
            browserAPI.scripting.insertCSS({
              target: { tabId: tabId, allFrames: true },
              files: ['content.css']
            }).then(() => {
              browserAPI.tabs.sendMessage(tabId, message);
            }).catch(() => {
              browserAPI.tabs.sendMessage(tabId, message);
            });
          } else {
            browserAPI.tabs.sendMessage(tabId, message);
          }
        }).catch(() => {});
      }
    });
  });
}
