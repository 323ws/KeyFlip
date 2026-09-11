document.addEventListener('DOMContentLoaded', () => {
  const mainView = document.getElementById('mainView');
  const pickerView = document.getElementById('pickerView');
  const pickerBackBtn = document.getElementById('pickerBackBtn');
  const pickerTitle = document.getElementById('pickerTitle');
  const langSearchInput = document.getElementById('langSearchInput');
  const pickerLangList = document.getElementById('pickerLangList');

  const uiLangToggle = document.getElementById('uiLangToggle');
  const uiLangText = document.getElementById('uiLangText');
  const themeToggle = document.getElementById('themeToggle');
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');
  const enableSwitch = document.getElementById('enableSwitch');
  const statusCircle = document.getElementById('statusCircle');
  const heroActiveIcon = document.getElementById('heroActiveIcon');
  const heroDisabledIcon = document.getElementById('heroDisabledIcon');
  const mainStatusTitle = document.getElementById('mainStatusTitle');
  const mainStatusDesc = document.getElementById('mainStatusDesc');
  const pillLabel1 = document.getElementById('pillLabel1');
  const pillLabel2 = document.getElementById('pillLabel2');
  const openLang1Btn = document.getElementById('openLang1Btn');
  const openLang2Btn = document.getElementById('openLang2Btn');
  const lang1Name = document.getElementById('lang1Name');
  const lang2Name = document.getElementById('lang2Name');
  const swapLayoutsBtn = document.getElementById('swapLayoutsBtn');
  const customizeShortcutBtn = document.getElementById('customizeShortcutBtn');
  const testInput = document.getElementById('testInput');
  const convertBtn = document.getElementById('convertBtn');
  const kofiBtn = document.getElementById('kofiBtn');

  // Shortcut Modal Elements & Configuration
  const shortcutModal = document.getElementById('shortcutModal');
  const closeShortcutModalBtn = document.getElementById('closeShortcutModalBtn');
  const cancelShortcutBtn = document.getElementById('cancelShortcutBtn');
  const saveShortcutBtn = document.getElementById('saveShortcutBtn');
  const shortcutRecorderBox = document.getElementById('shortcutRecorderBox');
  const recorderStatusText = document.getElementById('recorderStatusText');
  const recorderKeyDisplay = document.getElementById('recorderKeyDisplay');
  const currentShortcutDisplay = document.getElementById('currentShortcutDisplay');
  const presetPillBtns = document.querySelectorAll('.preset-pill-btn');

  let currentPrimary = 'en_us';
  let currentSecondary = 'ar_101';
  let currentTheme = 'dark';
  let currentUiLang = 'en';
  let pickingTarget = 1;

  const defaultShortcutRaw = 'Ctrl+Space';
  const defaultShortcutText = 'Ctrl + Space';

  let currentShortcut = defaultShortcutRaw;
  let recordedShortcut = defaultShortcutRaw;

  function formatShortcut(sc) {
    if (!sc) return defaultShortcutText;
    return sc.replace(/\+/g, ' + ');
  }

  const I18N = {
    ar: {
      toggleNext: 'EN',
      statusActive: 'المصحح التلقائي نَشِط',
      statusDisabled: 'المصحح معطل مؤقتاً',
      descActive: (sc) => `حدد أي نص واضغط <span class="badge-shortcut">${sc || defaultShortcutText}</span> للتصحيح.`,
      descDisabled: 'قم بتفعيل المفتاح أدناه لتشغيل التصحيح.',
      lang1: 'اللغة 1',
      lang2: 'اللغة 2',
      searchPlaceholder: '🔍 ابحث عن لغة...',
      testPlaceholder: 'جرّب التحويل هنا...',
      pickerTitle1: 'اختر اللغة الأولى',
      pickerTitle2: 'اختر اللغة الثانية',
      modalShortcutTitle: 'تخصيص اختصار التحويل',
      modalShortcutDesc: 'اضغط في المربع وسجّل أي اختصار تريده (أو اختر من الاختصارات الجاهزة):',
      recorderPromptDefault: 'اضغط هنا ثم اضغط مفاتيح الاختصار...',
      recorderPromptRecording: 'اضغط أزرار الاختصار معاً الآن...',
      presetsTitle: 'اختصارات شائعة:',
      cancelBtn: 'إلغاء',
      saveShortcutBtn: 'حفظ الاختصار',
      groups: {
        common: 'اللغات الأكثر استخداماً',
        me: 'الشرق الأوسط',
        eu: 'اللغات الأوروبية',
        asia: 'اللغات السلافية والآسيوية'
      }
    },
    en: {
      toggleNext: 'عربي',
      statusActive: 'Auto Corrector Active',
      statusDisabled: 'Corrector Disabled',
      descActive: (sc) => `Select text & press <span class="badge-shortcut">${sc || defaultShortcutText}</span> to convert.`,
      descDisabled: 'Turn on the switch below to enable.',
      lang1: 'Language 1',
      lang2: 'Language 2',
      searchPlaceholder: '🔍 Search language...',
      testPlaceholder: 'Test conversion here...',
      pickerTitle1: 'Select Primary Language',
      pickerTitle2: 'Select Secondary Language',
      modalShortcutTitle: 'Customize Shortcut',
      modalShortcutDesc: 'Click the box below and press your keys (or pick from presets):',
      recorderPromptDefault: 'Click here and press keys...',
      recorderPromptRecording: 'Press your shortcut keys now...',
      presetsTitle: 'Common Presets:',
      cancelBtn: 'Cancel',
      saveShortcutBtn: 'Save Shortcut',
      groups: {
        common: 'Popular Languages',
        me: 'Middle East',
        eu: 'European Languages',
        asia: 'Slavic & Asian Languages'
      }
    }
  };

  const LANGUAGE_GROUPS = [
    {
      groupKey: 'common',
      items: [
        { id: 'en_us', flag: '🇺🇸', name: 'English (US)' },
        { id: 'en_gb', flag: '🇬🇧', name: 'English (UK)' },
        { id: 'colemak', flag: '⌨️', name: 'English (Colemak)' },
        { id: 'dvorak', flag: '⌨️', name: 'English (Dvorak)' },
        { id: 'ar_101', flag: '🇸🇦', name: 'العربية (Windows 101)' },
        { id: 'ar_102', flag: '⌨️', name: 'العربية (Arabic 102)' }
      ]
    },
    {
      groupKey: 'me',
      items: [
        { id: 'fa', flag: '🇮🇷', name: 'فارسی (Persian)' },
        { id: 'ur', flag: '🇵🇰', name: 'اردو (Urdu)' },
        { id: 'he', flag: '🇮🇱', name: 'עברית (Hebrew)' },
        { id: 'tr_q', flag: '🇹🇷', name: 'Türkçe (Turkish Q)' }
      ]
    },
    {
      groupKey: 'eu',
      items: [
        { id: 'fr_azerty', flag: '🇫🇷', name: 'Français (AZERTY)' },
        { id: 'es', flag: '🇪🇸', name: 'Español (Spanish)' },
        { id: 'de_qwertz', flag: '🇩🇪', name: 'Deutsch (German)' },
        { id: 'it', flag: '🇮🇹', name: 'Italiano (Italian)' },
        { id: 'pt', flag: '🇧🇷', name: 'Português (Portuguese)' },
        { id: 'pl', flag: '🇵🇱', name: 'Polski (Polish)' },
        { id: 'cs', flag: '🇨🇿', name: 'Čeština (Czech)' },
        { id: 'nordic', flag: '🇸🇪', name: 'Nordic (Svenska)' },
        { id: 'el', flag: '🇬🇷', name: 'Ελληνικά (Greek)' }
      ]
    },
    {
      groupKey: 'asia',
      items: [
        { id: 'ru', flag: '🇷🇺', name: 'Русский (Russian)' },
        { id: 'uk', flag: '🇺🇦', name: 'Українська (Ukrainian)' },
        { id: 'ko', flag: '🇰🇷', name: '한국어 (Korean Hangul)' },
        { id: 'th', flag: '🇹🇭', name: 'ไทย (Thai Kedmanee)' }
      ]
    }
  ];

  // Auto-discover any additional layout compiled into KeyFlipEngine
  if (typeof KeyFlipEngine !== 'undefined' && KeyFlipEngine.LAYOUTS) {
    const knownIds = new Set();
    LANGUAGE_GROUPS.forEach(g => g.items.forEach(item => knownIds.add(item.id)));
    for (const [id, l] of Object.entries(KeyFlipEngine.LAYOUTS)) {
      if (!knownIds.has(id)) {
        LANGUAGE_GROUPS[LANGUAGE_GROUPS.length - 1].items.push({
          id: id,
          flag: '🌐',
          name: l.name || id
        });
      }
    }
  }

  function getLanguageItem(id) {
    for (const group of LANGUAGE_GROUPS) {
      for (const item of group.items) {
        if (item.id === id) return item;
      }
    }
    return { id, flag: '🌐', name: id };
  }

  function applyUiLanguage(lang) {
    currentUiLang = lang === 'en' ? 'en' : 'ar';
    const t = I18N[currentUiLang];

    document.documentElement.setAttribute('lang', currentUiLang);
    document.documentElement.setAttribute('dir', 'ltr');

    uiLangText.textContent = t.toggleNext;
    pillLabel1.textContent = t.lang1;
    pillLabel2.textContent = t.lang2;
    testInput.placeholder = t.testPlaceholder;
    langSearchInput.placeholder = t.searchPlaceholder;

    const modalShortcutTitle = document.getElementById('modalShortcutTitle');
    const modalShortcutDesc = document.getElementById('modalShortcutDesc');
    const recorderStatusText = document.getElementById('recorderStatusText');
    const presetsLabel = document.getElementById('presetsLabel');
    const cancelShortcutBtn = document.getElementById('cancelShortcutBtn');
    const saveShortcutBtn = document.getElementById('saveShortcutBtn');

    if (modalShortcutTitle) modalShortcutTitle.textContent = t.modalShortcutTitle;
    if (modalShortcutDesc) modalShortcutDesc.textContent = t.modalShortcutDesc;
    if (recorderStatusText) recorderStatusText.textContent = t.recorderPromptDefault;
    if (presetsLabel) presetsLabel.textContent = t.presetsTitle;
    if (cancelShortcutBtn) cancelShortcutBtn.textContent = t.cancelBtn;
    if (saveShortcutBtn) saveShortcutBtn.textContent = t.saveShortcutBtn;

    updateStatusVisuals(enableSwitch.checked);
    updateMainViewUI();
  }

  function updateMainViewUI() {
    const l1 = getLanguageItem(currentPrimary);
    const l2 = getLanguageItem(currentSecondary);

    lang1Name.textContent = `${l1.flag} ${l1.name.split(' (')[0]}`;
    lang2Name.textContent = `${l2.flag} ${l2.name.split(' (')[0]}`;
  }

  function openPicker(targetNumber) {
    pickingTarget = targetNumber;
    const t = I18N[currentUiLang];
    pickerTitle.textContent = targetNumber === 1 ? t.pickerTitle1 : t.pickerTitle2;
    langSearchInput.value = '';
    renderPickerList('');
    
    mainView.classList.remove('active');
    pickerView.classList.add('active');
    langSearchInput.focus();
  }

  function closePicker() {
    pickerView.classList.remove('active');
    mainView.classList.add('active');
  }

  function renderPickerList(searchTerm = '') {
    pickerLangList.replaceChildren();
    const query = searchTerm.toLowerCase().trim();
    const activeId = pickingTarget === 1 ? currentPrimary : currentSecondary;
    const t = I18N[currentUiLang];

    LANGUAGE_GROUPS.forEach(group => {
      const filtered = group.items.filter(item => 
        item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
      );

      if (filtered.length > 0) {
        const title = document.createElement('div');
        title.className = 'picker-group-title';
        title.textContent = t.groups[group.groupKey] || group.groupKey;
        pickerLangList.appendChild(title);

        filtered.forEach(item => {
          const row = document.createElement('div');
          const isActive = item.id === activeId;
          row.className = `picker-item ${isActive ? 'active' : ''}`;

          const itemLeft = document.createElement('div');
          itemLeft.className = 'picker-item-left';

          const flagSpan = document.createElement('span');
          flagSpan.className = 'picker-item-flag';
          flagSpan.textContent = item.flag;

          const nameSpan = document.createElement('span');
          nameSpan.className = 'picker-item-name';
          nameSpan.textContent = item.name;

          itemLeft.appendChild(flagSpan);
          itemLeft.appendChild(nameSpan);
          row.appendChild(itemLeft);

          if (isActive) {
            const checkSpan = document.createElement('span');
            checkSpan.className = 'picker-item-check';
            checkSpan.textContent = '✓';
            row.appendChild(checkSpan);
          }

          row.addEventListener('click', () => {
            if (pickingTarget === 1) {
              currentPrimary = item.id;
              chrome.storage.sync.set({ primaryLayout: currentPrimary });
            } else {
              currentSecondary = item.id;
              chrome.storage.sync.set({ secondaryLayout: currentSecondary });
            }
            updateMainViewUI();
            closePicker();
          });

          pickerLangList.appendChild(row);
        });
      }
    });
  }

  uiLangToggle.addEventListener('click', () => {
    const nextLang = currentUiLang === 'ar' ? 'en' : 'ar';
    applyUiLanguage(nextLang);
    chrome.storage.sync.set({ uiLang: nextLang });
  });

  openLang1Btn.addEventListener('click', () => openPicker(1));
  openLang2Btn.addEventListener('click', () => openPicker(2));
  pickerBackBtn.addEventListener('click', closePicker);

  langSearchInput.addEventListener('input', (e) => {
    renderPickerList(e.target.value);
  });

  // Load Saved Settings
  chrome.storage.sync.get(['theme', 'primaryLayout', 'secondaryLayout', 'enabled', 'uiLang', 'shortcut', 'v111_theme_reset'], (data) => {
    if (!data.v111_theme_reset) {
      currentTheme = 'dark';
      chrome.storage.sync.set({ theme: 'dark', v111_theme_reset: true });
    } else {
      currentTheme = data.theme || 'dark';
    }
    applyTheme(currentTheme);

    currentUiLang = data.uiLang || 'en';

    if (data.primaryLayout) currentPrimary = data.primaryLayout;
    if (data.secondaryLayout) currentSecondary = data.secondaryLayout;

    if (data.shortcut) {
      currentShortcut = data.shortcut;
      recordedShortcut = data.shortcut;
    }
    const formatted = formatShortcut(currentShortcut);
    if (currentShortcutDisplay) {
      currentShortcutDisplay.textContent = formatted;
    }

    applyUiLanguage(currentUiLang);

    const isEnabled = data.enabled !== undefined ? data.enabled : true;
    enableSwitch.checked = isEnabled;
    updateStatusVisuals(isEnabled);
  });

  themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    chrome.storage.sync.set({ theme: currentTheme });
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      moonIcon.classList.remove('hidden');
      sunIcon.classList.add('hidden');
    } else {
      moonIcon.classList.add('hidden');
      sunIcon.classList.remove('hidden');
    }
  }

  enableSwitch.addEventListener('change', () => {
    const isEnabled = enableSwitch.checked;
    updateStatusVisuals(isEnabled);
    chrome.storage.sync.set({ enabled: isEnabled });
    if (window.__TAURI__ && window.__TAURI__.core) {
      window.__TAURI__.core.invoke('toggle_enabled', { enabled: isEnabled }).catch(() => {});
    }
  });

  function updateStatusVisuals(isEnabled) {
    const t = I18N[currentUiLang] || I18N.ar;
    const formatted = formatShortcut(currentShortcut);
    if (isEnabled) {
      statusCircle.className = 'status-circle active';
      heroActiveIcon.classList.remove('hidden');
      heroDisabledIcon.classList.add('hidden');
      mainStatusTitle.className = 'hero-title';
      mainStatusTitle.textContent = t.statusActive;

      mainStatusDesc.replaceChildren();
      const badge = document.createElement('span');
      badge.className = 'badge-shortcut';
      badge.textContent = formatted || defaultShortcutText;
      if (currentUiLang === 'ar') {
        mainStatusDesc.append(document.createTextNode('حدد أي نص واضغط '), badge, document.createTextNode(' للتصحيح.'));
      } else {
        mainStatusDesc.append(document.createTextNode('Select text & press '), badge, document.createTextNode(' to convert.'));
      }
    } else {
      statusCircle.className = 'status-circle disabled';
      heroActiveIcon.classList.add('hidden');
      heroDisabledIcon.classList.remove('hidden');
      mainStatusTitle.className = 'hero-title disabled';
      mainStatusTitle.textContent = t.statusDisabled;
      mainStatusDesc.textContent = t.descDisabled;
    }
  }

  swapLayoutsBtn.addEventListener('click', () => {
    const temp = currentPrimary;
    currentPrimary = currentSecondary;
    currentSecondary = temp;

    chrome.storage.sync.set({
      primaryLayout: currentPrimary,
      secondaryLayout: currentSecondary
    });

    updateMainViewUI();

    swapLayoutsBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      swapLayoutsBtn.style.transform = '';
    }, 250);
  });

  function renderRecordedShortcut(shortcutStr) {
    if (!shortcutStr) {
      recorderStatusText.classList.remove('hidden');
      recorderKeyDisplay.classList.add('hidden');
      return;
    }
    recorderStatusText.classList.add('hidden');
    recorderKeyDisplay.classList.remove('hidden');
    recorderKeyDisplay.replaceChildren();

    const parts = shortcutStr.split('+').map(p => p.trim());
    parts.forEach((part, index) => {
      const badge = document.createElement('span');
      badge.className = 'key-badge';
      badge.textContent = part;
      recorderKeyDisplay.appendChild(badge);

      if (index < parts.length - 1) {
        const plus = document.createElement('span');
        plus.className = 'key-plus';
        plus.textContent = '+';
        recorderKeyDisplay.appendChild(plus);
      }
    });

    presetPillBtns.forEach(btn => {
      if (btn.getAttribute('data-shortcut').toLowerCase() === shortcutStr.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function openShortcutModal() {
    recordedShortcut = currentShortcut;
    renderRecordedShortcut(recordedShortcut);
    shortcutModal.classList.remove('hidden');
    shortcutRecorderBox.focus();
  }

  function closeShortcutModal() {
    shortcutModal.classList.add('hidden');
  }

  customizeShortcutBtn.addEventListener('click', () => {
    openShortcutModal();
  });

  if (closeShortcutModalBtn) closeShortcutModalBtn.addEventListener('click', closeShortcutModal);
  if (cancelShortcutBtn) cancelShortcutBtn.addEventListener('click', closeShortcutModal);

  presetPillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sc = btn.getAttribute('data-shortcut');
      if (sc) {
        recordedShortcut = sc;
        renderRecordedShortcut(recordedShortcut);
      }
    });
  });

  if (shortcutRecorderBox) {
    shortcutRecorderBox.addEventListener('focus', () => {
      shortcutRecorderBox.classList.add('recording');
      const t = I18N[currentUiLang] || I18N.en;
      if (recorderStatusText) recorderStatusText.textContent = t.recorderPromptRecording;
    });

    shortcutRecorderBox.addEventListener('blur', () => {
      shortcutRecorderBox.classList.remove('recording');
      const t = I18N[currentUiLang] || I18N.en;
      if (recorderStatusText) recorderStatusText.textContent = t.recorderPromptDefault;
    });

    shortcutRecorderBox.addEventListener('keydown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.metaKey) modifiers.push('Win');

      let key = e.key;
      if (key === ' ') key = 'Space';
      else if (key.length === 1) key = key.toUpperCase();

      if (modifiers.length === 0) {
        modifiers.push('Alt');
      }

      recordedShortcut = [...modifiers, key].join('+');
      renderRecordedShortcut(recordedShortcut);
    });
  }

  if (saveShortcutBtn) {
    saveShortcutBtn.addEventListener('click', () => {
      currentShortcut = recordedShortcut;
      const formatted = formatShortcut(currentShortcut);
      if (currentShortcutDisplay) {
        currentShortcutDisplay.textContent = formatted;
      }

      chrome.storage.sync.set({ shortcut: currentShortcut });
      if (window.__TAURI__ && window.__TAURI__.core) {
        window.__TAURI__.core.invoke('update_shortcut', { shortcut: currentShortcut }).catch(() => {});
      }

      updateStatusVisuals(enableSwitch.checked);
      closeShortcutModal();
    });
  }

  testInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performQuickConversion();
    }
  });

  convertBtn.addEventListener('click', () => {
    performQuickConversion();
  });

  function performQuickConversion() {
    const text = testInput.value;
    const engine = typeof KeyFlipEngine !== 'undefined' ? KeyFlipEngine : null;
    if (!text || !engine) return;

    const result = engine.convertTextBetween(text, currentPrimary, currentSecondary);
    testInput.value = result.convertedText;
    testInput.style.borderColor = 'var(--primary-green)';
    setTimeout(() => {
      testInput.style.borderColor = '';
    }, 300);
  }

  if (kofiBtn) {
    kofiBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = 'https://ko-fi.com/N4N21X8U7I';
      if (window.__TAURI__ && window.__TAURI__.core) {
        window.__TAURI__.core.invoke('open_url', { url }).catch(() => {
          window.open(url, '_blank');
        });
      } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    });
  }


  // Pressing Esc closes the modal if open, or hides the window to tray
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('shortcutModal');
      if (modal && !modal.classList.contains('hidden')) {
        closeShortcutModal();
        return;
      }
      if (window.__TAURI__ && window.__TAURI__.core) {
        window.__TAURI__.core.invoke('hide_window').catch(() => {});
      }
    }
  });
});
