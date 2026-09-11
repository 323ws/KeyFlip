// Bridge between Chrome extension storage API and Tauri v2 backend
(function () {
  let localSettings = {
    primaryLayout: 'en_us',
    secondaryLayout: 'ar_101',
    enabled: true,
    theme: 'dark',
    uiLang: 'en',
    shortcut: 'Ctrl+Space'
  };

  // Mock chrome.storage.sync
  window.chrome = window.chrome || {};
  window.chrome.storage = {
    sync: {
      get: function (keys, callback) {
        if (window.__TAURI__ && window.__TAURI__.core) {
          window.__TAURI__.core.invoke('get_settings').then(function (res) {
            if (res) Object.assign(localSettings, res);
            if (callback) callback(localSettings);
          }).catch(function () {
            if (callback) callback(localSettings);
          });
        } else {
          // Fallback to localStorage
          try {
            const saved = localStorage.getItem('keyflip_settings');
            if (saved) Object.assign(localSettings, JSON.parse(saved));
          } catch (e) {}
          if (callback) callback(localSettings);
        }
      },
      set: function (data, callback) {
        Object.assign(localSettings, data);
        try {
          localStorage.setItem('keyflip_settings', JSON.stringify(localSettings));
        } catch (e) {}

        if (window.__TAURI__ && window.__TAURI__.core) {
          window.__TAURI__.core.invoke('save_settings', { settings: localSettings }).then(function () {
            if (callback) callback();
          }).catch(function () {
            if (callback) callback();
          });
        } else {
          if (callback) callback();
        }
      }
    }
  };

  // Mock chrome.tabs.create
  window.chrome.tabs = {
    create: function (obj) {
      if (window.__TAURI__ && window.__TAURI__.opener && obj && obj.url) {
        window.__TAURI__.opener.openUrl(obj.url);
      } else if (obj && obj.url) {
        window.open(obj.url, '_blank');
      }
    }
  };
})();
