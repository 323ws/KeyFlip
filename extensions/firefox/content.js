(function () {
  'use strict';

  const currentSettings = {
    enabled: true,
    primaryLayout: 'en_us',
    secondaryLayout: 'ar_101',
    showNotification: true,
    shortcut: 'Ctrl+Space'
  };

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['enabled', 'primaryLayout', 'secondaryLayout', 'showNotification', 'shortcut'], (data) => {
        if (chrome.runtime?.lastError) return;
        if (data) {
          if (data.enabled !== undefined) currentSettings.enabled = data.enabled;
          if (data.primaryLayout) currentSettings.primaryLayout = data.primaryLayout;
          if (data.secondaryLayout) currentSettings.secondaryLayout = data.secondaryLayout;
          if (data.showNotification !== undefined) currentSettings.showNotification = data.showNotification;
          if (data.shortcut) currentSettings.shortcut = data.shortcut;
        }
      });

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes) {
          for (const key in changes) {
            if (Object.prototype.hasOwnProperty.call(changes, key) && changes[key] && changes[key].newValue !== undefined) {
              currentSettings[key] = changes[key].newValue;
            }
          }
        }
      });
    }
  } catch (e) {}

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.action === 'CONVERT_SELECTION') {
          const l1 = request.primaryLayout || currentSettings.primaryLayout;
          const l2 = request.secondaryLayout || currentSettings.secondaryLayout;
          const showNotif = request.showNotification !== false;
          const success = executeConversion(l1, l2, showNotif);
          sendResponse({ success });
        }
      });
    }
  } catch (e) {}

  function matchesConfiguredShortcut(e, sc) {
    if (!sc) return false;
    const parts = sc.split('+').map(p => p.trim());
    const key = parts[parts.length - 1].toLowerCase();
    const needCtrl = parts.some(p => p.toLowerCase() === 'ctrl');
    const needAlt = parts.some(p => p.toLowerCase() === 'alt');
    const needShift = parts.some(p => p.toLowerCase() === 'shift');
    const needMeta = parts.some(p => p.toLowerCase() === 'win' || p.toLowerCase() === 'cmd');

    if (e.ctrlKey !== needCtrl) return false;
    if (e.altKey !== needAlt) return false;
    if (e.shiftKey !== needShift) return false;
    if (e.metaKey !== needMeta) return false;

    if (key === 'space') return (e.code === 'Space' || e.key === ' ');
    if (e.key && e.key.toLowerCase() === key) return true;
    if (e.code && e.code.toLowerCase() === 'key' + key) return true;
    if (e.code && e.code.toLowerCase() === key) return true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (!currentSettings.enabled) return;

    // Primary path: Standard W3C physical KeyboardEvent.code
    let isKeyX = false;
    let isKeyQ = false;

    if (e.code) {
      isKeyX = (e.code === 'KeyX');
      isKeyQ = (e.code === 'KeyQ');
    } else if (e.key) {
      // Guarded fallback only when e.code is completely unavailable
      const k = e.key.toLowerCase();
      isKeyX = (k === 'x');
      isKeyQ = (k === 'q');
    }

    // Cross-platform key modifier detection:
    // Windows & Linux: Ctrl + Space (Default) | Alt + X | Ctrl + Shift + X | Alt + Shift + X | Ctrl + Q | F2
    const hasCmdOrCtrl = e.ctrlKey || e.metaKey;
    const isCtrlSpace = (hasCmdOrCtrl && !e.altKey && !e.shiftKey && (e.code === 'Space' || e.key === ' '));
    const isAltX = (e.altKey && !hasCmdOrCtrl && !e.shiftKey && isKeyX);
    const isComboShiftX = (hasCmdOrCtrl && e.shiftKey && !e.altKey && isKeyX)
                       || (e.altKey && e.shiftKey && !hasCmdOrCtrl && isKeyX);
    const isCtrlQ = (hasCmdOrCtrl && !e.altKey && !e.shiftKey && isKeyQ);
    const isF2 = (e.key === 'F2' && !hasCmdOrCtrl && !e.altKey && !e.shiftKey);
    const isCustom = currentSettings.shortcut && matchesConfiguredShortcut(e, currentSettings.shortcut);

    if (isCtrlSpace || isAltX || isComboShiftX || isCtrlQ || isF2 || isCustom) {
      e.preventDefault();
      e.stopPropagation();
      executeConversion(currentSettings.primaryLayout, currentSettings.secondaryLayout, currentSettings.showNotification);
    }
  }, true);

  function executeConversion(l1 = 'en_us', l2 = 'ar_101', showNotif = true) {
    const engine = typeof KeyFlipEngine !== 'undefined' ? KeyFlipEngine : null;
    if (!engine) return false;

    const activeEl = getDeepActiveElement();

    if (isTextInputOrArea(activeEl)) {
      return convertInputOrTextarea(activeEl, l1, l2, showNotif);
    }

    if (isContentEditable(activeEl) || isSelectionInsideEditable()) {
      return convertContentEditable(l1, l2, showNotif);
    }

    return convertSelectionOrClipboardFallback(l1, l2, showNotif);
  }

  function getDeepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  function isTextInputOrArea(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      const textTypes = ['text', 'search', 'url', 'email', 'password', 'tel', ''];
      return textTypes.includes(type);
    }
    return false;
  }

  function isContentEditable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
    return false;
  }

  function isSelectionInsideEditable() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const node = sel.anchorNode;
    if (!node) return false;
    const parentEl = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return parentEl ? isContentEditable(parentEl) : false;
  }

  function convertInputOrTextarea(input, l1, l2, showNotif) {
    const value = input.value || '';
    let start = input.selectionStart;
    let end = input.selectionEnd;

    let targetText = '';

    if (start !== null && end !== null && start !== end) {
      targetText = value.substring(start, end);
    } else {
      targetText = value;
      start = 0;
      end = value.length;
    }

    if (!targetText) return false;

    const engine = typeof KeyFlipEngine !== 'undefined' ? KeyFlipEngine : null;
    if (!engine) return false;
    const result = engine.convertTextBetween(targetText, l1, l2);
    if (!result.changed) return false;

    const expectedValue = value.substring(0, start) + result.convertedText + value.substring(end);

    input.focus();
    input.setSelectionRange(start, end);

    let replaced = false;
    try {
      replaced = document.execCommand('insertText', false, result.convertedText);
    } catch (e) {
      replaced = false;
    }

    if (!replaced || input.value !== expectedValue) {
      const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      
      if (descriptor && descriptor.set) {
        descriptor.set.call(input, expectedValue);
      } else {
        input.value = expectedValue;
      }

      const newCaret = start + result.convertedText.length;
      input.setSelectionRange(newCaret, newCaret);

      input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: result.convertedText }));
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: ' ' }));
    }

    if (showNotif) {
      showFloatingToast(result.direction, result.convertedText);
    }

    return true;
  }

  function convertContentEditable(l1, l2, showNotif) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    let selectedText = selection.toString();
    if (!selectedText) {
      const activeEl = getDeepActiveElement();
      if (activeEl && activeEl.innerText) {
        selectedText = activeEl.innerText;
        document.execCommand('selectAll', false, null);
      }
    }

    if (!selectedText) return false;

    const engine = typeof KeyFlipEngine !== 'undefined' ? KeyFlipEngine : null;
    if (!engine) return false;
    const result = engine.convertTextBetween(selectedText, l1, l2);
    if (!result.changed) return false;

    let replaced = false;
    try {
      replaced = document.execCommand('insertText', false, result.convertedText);
    } catch (e) {
      replaced = false;
    }

    if (!replaced) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(result.convertedText);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (showNotif) {
      showFloatingToast(result.direction, result.convertedText);
    }

    return true;
  }

  function convertSelectionOrClipboardFallback(l1, l2, showNotif) {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString() : '';

    if (selectedText) {
      const engine = typeof KeyFlipEngine !== 'undefined' ? KeyFlipEngine : null;
      if (!engine) return false;
      const result = engine.convertTextBetween(selectedText, l1, l2);
      if (result.changed) {
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, result.convertedText);
        } catch (e) {}

        copyToClipboard(result.convertedText);

        if (showNotif) {
          const msg = inserted ? result.convertedText : 'تم التحويل والنسخ للحافظة 📋';
          showFloatingToast(result.direction, msg);
        }
        return true;
      }
    }

    return false;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackExecCopy(text);
      });
    } else {
      fallbackExecCopy(text);
    }
  }

  function fallbackExecCopy(text) {
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    tempTextArea.style.position = 'fixed';
    tempTextArea.style.top = '-9999px';
    tempTextArea.style.left = '-9999px';
    document.body.appendChild(tempTextArea);
    tempTextArea.focus();
    tempTextArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(tempTextArea);
  }

  let toastContainer = null;
  let toastTimeout = null;

  function showFloatingToast(direction, previewText) {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'keyflip-toast-container';
      document.body.appendChild(toastContainer);
    }

    toastContainer.replaceChildren();
    if (toastTimeout) clearTimeout(toastTimeout);

    const toast = document.createElement('div');
    toast.className = 'keyflip-toast';

    const displayMsg = previewText.length > 30 ? previewText.substring(0, 30) + '...' : previewText;

    const badge = document.createElement('span');
    badge.className = 'keyflip-toast-badge';
    badge.textContent = direction;

    const msg = document.createElement('span');
    msg.className = 'keyflip-toast-msg';
    msg.textContent = displayMsg;

    toast.appendChild(badge);
    toast.appendChild(msg);

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('keyflip-toast-visible');
    });

    toastTimeout = setTimeout(() => {
      toast.classList.remove('keyflip-toast-visible');
      setTimeout(() => {
        if (toastContainer && toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 2200);
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

})();
