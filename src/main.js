import './services/api.js';
import './services/state.js';
import './services/undo-manager.js';
import { initResizer } from './services/resizer.js';
import './components/sidebar.js';
import './components/request-builder.js';
import './components/response-viewer.js';
import './components/search-modal.js';
import './components/save-request-modal.js';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  await window.appState.loadCollections();
  window.sidebar.render();
  window.requestBuilder.render();
  window.responseViewer.render();
  initResizer();
});

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', async (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    await quickSave();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault();
    await deleteActiveRequest();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault();
    newRequest();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
    const selection = window.getSelection()?.toString();
    if (!selection) {
      e.preventDefault();
      await copyRequestAsCurl();
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
    e.preventDefault();
    await exportCollection();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
    e.preventDefault();
    showImportModal();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !isInputFocused()) {
    e.preventDefault();
    await window.undoManager.undo();
  }
  if (e.key === '?' && !isInputFocused()) {
    e.preventDefault();
    toggleShortcutsModal();
  }
  if (e.key === 'Escape') {
    closeShortcutsModal();
    closeExportModal();
    closeImportModal();
  }
});

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function toggleShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  if (!modal) return;
  modal.classList.toggle('visible');
}

function closeShortcutsModal() {
  document.getElementById('shortcutsModal')?.classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('shortcutsModalClose')?.addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcutsModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeShortcutsModal();
  });
  document.getElementById('exportModalClose')?.addEventListener('click', closeExportModal);
  document.getElementById('exportCopyBtn')?.addEventListener('click', copyExport);
  document.getElementById('exportModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeExportModal();
  });
  document.getElementById('importModalClose')?.addEventListener('click', closeImportModal);
  document.getElementById('importBtn')?.addEventListener('click', runImport);
  document.getElementById('importModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeImportModal();
  });
});

function newRequest() {
  if (window.hoveredFolderId) {
    // Find folder name from collections
    let folderName = 'folder';
    for (const col of window.appState.collections) {
      const folder = col.folders.find(f => f.id === window.hoveredFolderId);
      if (folder) { folderName = folder.name; break; }
    }
    window.sidebar.newRequest(window.hoveredFolderId, folderName);
  } else {
    window.requestBuilder.resetRequest();
    window.appState.setActiveRequest(null, null);
    showToast('New request');
  }
}

async function deleteActiveRequest() {
  const request = window.appState.activeRequest;
  if (!request) { showToast('No active request to delete', 'error'); return; }
  if (!window.appState.activeFolderId) { showToast('Request is not saved', 'error'); return; }
  await window.sidebar.deleteRequest(request.id);
}

async function quickSave() {
  const method   = document.getElementById('methodSelect')?.value;
  const fullUrl  = document.getElementById('urlInput')?.value?.trim();

  if (!fullUrl) { showToast('No URL to save', 'error'); return; }

  // Strip query params from URL — they are stored separately in params
  const qIdx   = fullUrl.indexOf('?');
  const url    = qIdx !== -1 ? fullUrl.substring(0, qIdx) : fullUrl;

  // Preserve existing ID + name if this was loaded from a saved request
  const body = document.getElementById('bodyEditor')?.value || '';
  const headers = {}, params = {};
  window.requestBuilder.currentRequest.headers.forEach(h => {
    if (h.key && h.value) headers[h.key] = h.value;
  });
  // Always re-parse params from the live URL so edits in the URL bar are captured
  if (qIdx !== -1) {
    for (const pair of fullUrl.substring(qIdx + 1).split('&')) {
      if (!pair) continue;
      const eqPos = pair.indexOf('=');
      try {
        const k = decodeURIComponent((eqPos !== -1 ? pair.substring(0, eqPos) : pair).replace(/\+/g, ' '));
        const v = eqPos !== -1 ? decodeURIComponent(pair.substring(eqPos + 1).replace(/\+/g, ' ')) : '';
        if (k) params[k] = v;
      } catch {
        const k = eqPos !== -1 ? pair.substring(0, eqPos) : pair;
        const v = eqPos !== -1 ? pair.substring(eqPos + 1) : '';
        if (k) params[k] = v;
      }
    }
  } else {
    // No query params in URL — fall back to the params panel state
    window.requestBuilder.currentRequest.params.forEach(p => {
      if (p.key) params[p.key] = p.value;
    });
  }

  const request = {
    id:     window.appState.activeRequest?.id ?? crypto.randomUUID(),
    name:   window.appState.activeRequest?.name ?? requestName(method, url),
    method, url, headers,
    body:   body || null,
    params,
  };

  try {
    let folderId, dest;
    let pushUndo = false;

    if (window.appState.activeFolderId) {
      // 1. Loaded from a saved folder — update in place
      folderId = window.appState.activeFolderId;
      dest = 'saved folder';
      pushUndo = true;
    } else if (window.hoveredFolderId) {
      // 2. Mouse over a sidebar folder — save there
      folderId = window.hoveredFolderId;
      dest = 'folder';
    } else {
      // 3. Fallback — History collection
      folderId = await window.api.getOrCreateHistoryFolder();
      dest = 'History';
    }

    // Snapshot for undo — only if updating an existing saved request
    if (pushUndo && window.appState.activeRequest) {
      const prevRequest = { ...window.appState.activeRequest };
      const prevFolderId = window.appState.activeFolderId;
      window.undoManager.push({
        description: `Edit "${prevRequest.name}"`,
        execute: async () => {
          await window.api.saveRequest(prevFolderId, prevRequest);
          await window.appState.loadCollections();
          for (const col of window.appState.collections) {
            for (const folder of col.folders) {
              const req = folder.requests.find(r => r.id === prevRequest.id);
              if (req) { window.appState.setActiveRequest(req, folder.id); break; }
            }
          }
          window.showToast(`Restored "${prevRequest.name}"`);
        }
      });
    }

    await window.api.saveRequest(folderId, request);
    // Remember where this request lives so next Cmd+S updates in place
    window.appState.activeFolderId = folderId;
    await window.appState.loadCollections();

    showToast(pushUndo ? 'Saved · ⌘Z to undo' : `Saved to ${dest}`);
  } catch (err) {
    showToast('Save failed: ' + err, 'error');
  }
}

function requestName(method, url) {
  try {
    const path = new URL(url).pathname;
    return `${method} ${path}`;
  } catch {
    return `${method} ${url}`;
  }
}

function requestToCurl({ method, url, headers, body, params }) {
  let fullUrl = url || '';
  if (params && typeof params === 'object') {
    const qs = Object.entries(params)
      .filter(([k, v]) => k && v)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
  }

  const esc = (s) => s.replace(/'/g, `'\\''`);
  const parts = [`curl '${esc(fullUrl)}'`];

  if (method && method !== 'GET') {
    parts.push(`-X ${method}`);
  }

  if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (k && v) parts.push(`-H '${esc(k)}: ${esc(v)}'`);
    }
  }

  if (body) {
    parts.push(`-d '${esc(body)}'`);
  }

  return parts.join(' ');
}

function findRequestById(requestId) {
  for (const col of window.appState.collections) {
    for (const folder of col.folders) {
      const req = folder.requests.find(r => r.id === requestId);
      if (req) return req;
    }
  }
  return null;
}

function getCurrentRequestData() {
  const method   = document.getElementById('methodSelect')?.value;
  const fullUrl  = document.getElementById('urlInput')?.value?.trim();
  if (!fullUrl) return null;

  // Strip query params from base URL; re-parse them so URL-bar edits are captured
  const qIdx = fullUrl.indexOf('?');
  const url  = qIdx !== -1 ? fullUrl.substring(0, qIdx) : fullUrl;

  const body = document.getElementById('bodyEditor')?.value || '';
  const headers = {}, params = {};
  window.requestBuilder.currentRequest.headers.forEach(h => {
    if (h.key && h.value) headers[h.key] = h.value;
  });
  if (qIdx !== -1) {
    for (const pair of fullUrl.substring(qIdx + 1).split('&')) {
      if (!pair) continue;
      const eqPos = pair.indexOf('=');
      try {
        const k = decodeURIComponent((eqPos !== -1 ? pair.substring(0, eqPos) : pair).replace(/\+/g, ' '));
        const v = eqPos !== -1 ? decodeURIComponent(pair.substring(eqPos + 1).replace(/\+/g, ' ')) : '';
        if (k) params[k] = v;
      } catch {
        const k = eqPos !== -1 ? pair.substring(0, eqPos) : pair;
        const v = eqPos !== -1 ? pair.substring(eqPos + 1) : '';
        if (k) params[k] = v;
      }
    }
  } else {
    window.requestBuilder.currentRequest.params.forEach(p => {
      if (p.key) params[p.key] = p.value;
    });
  }

  return { method, url, headers, body: body || null, params };
}

async function copyRequestAsCurl() {
  let req;

  if (window.hoveredRequestId) {
    req = findRequestById(window.hoveredRequestId);
  }

  if (!req) {
    req = getCurrentRequestData();
  }

  if (!req || !req.url) {
    showToast('No request to copy', 'error');
    return;
  }

  const curl = requestToCurl(req);
  await navigator.clipboard.writeText(curl);
  showToast('Copied as cURL');
}

function exportCollection() {
  // Find the collection containing the active request (or hovered)
  const targetId = window.appState.activeRequest?.id || window.hoveredRequestId;
  let targetCollection = null;

  if (targetId) {
    for (const col of window.appState.collections) {
      for (const folder of col.folders) {
        if (folder.requests.some(r => r.id === targetId)) {
          targetCollection = col;
          break;
        }
      }
      if (targetCollection) break;
    }
  }

  if (!targetCollection) {
    targetCollection = window.appState.collections[0];
  }

  if (!targetCollection) {
    showToast('No collection to export', 'error');
    return;
  }

  // Build export text
  const lines = [`# ${targetCollection.name}`];
  for (const folder of targetCollection.folders) {
    lines.push(`- ${folder.name}`);
    for (const req of folder.requests) {
      lines.push(`+ ${req.name}: ${requestToCurl(req)}`);
    }
  }
  const content = lines.join('\n') + '\n';

  showExportModal(content);
}

function showExportModal(content) {
  const modal = document.getElementById('exportModal');
  const textarea = document.getElementById('exportContent');
  if (!modal || !textarea) return;
  textarea.value = content;
  modal.classList.add('visible');
  textarea.focus();
  textarea.select();
}

function closeExportModal() {
  document.getElementById('exportModal')?.classList.remove('visible');
}

async function copyExport() {
  const textarea = document.getElementById('exportContent');
  if (!textarea) return;
  await navigator.clipboard.writeText(textarea.value);
  showToast('Copied to clipboard');
  closeExportModal();
}

function showImportModal() {
  const modal = document.getElementById('importModal');
  const textarea = document.getElementById('importContent');
  if (!modal || !textarea) return;
  textarea.value = '';
  modal.classList.add('visible');
  textarea.focus();
}

function closeImportModal() {
  document.getElementById('importModal')?.classList.remove('visible');
}

async function runImport() {
  const textarea = document.getElementById('importContent');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) { showToast('Nothing to import', 'error'); return; }

  const lines = text.split('\n');
  let collectionName = null;
  let folders = [];       // [{ name, curls: [string] }]
  let currentFolder = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      collectionName = line.substring(2).trim();
    } else if (line.startsWith('- ')) {
      currentFolder = { name: line.substring(2).trim(), curls: [] };
      folders.push(currentFolder);
    } else if (line.startsWith('+ ') && currentFolder) {
      const rest = line.substring(2).trim();
      const colonIdx = rest.indexOf(': curl ');
      if (colonIdx !== -1) {
        currentFolder.curls.push({ name: rest.substring(0, colonIdx).trim(), curl: rest.substring(colonIdx + 2).trim() });
      } else {
        currentFolder.curls.push({ name: null, curl: rest });
      }
    }
  }

  if (!collectionName) { showToast('Missing "# Collection Name"', 'error'); return; }
  if (!folders.length) { showToast('No folders found (lines starting with "- ")', 'error'); return; }

  try {
    const collectionId = await window.api.createCollection(collectionName);

    for (const folder of folders) {
      const folderId = await window.api.createFolder(collectionId, folder.name);
      for (const entry of folder.curls) {
        const parsed = await window.api.parseCurl(entry.curl);
        parsed.name = entry.name || requestName(parsed.method, parsed.url);
        await window.api.saveRequest(folderId, parsed);
      }
    }

    await window.appState.loadCollections();
    closeImportModal();
    showToast(`Imported "${collectionName}"`);
  } catch (err) {
    showToast('Import failed: ' + err, 'error');
  }
}

window.showToast = showToast;
function showToast(message, type = 'success') {
  document.getElementById('appToast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'appToast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}