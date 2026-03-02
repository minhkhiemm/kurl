class Sidebar {
    constructor() {
        this.container = document.getElementById('sidebar');

        // Mouse-based drag state
        this._drag = null;       // { requestId, startX, startY, ghost, active }
        this._onMouseMove   = this._onMouseMove.bind(this);
        this._onMouseUp     = this._onMouseUp.bind(this);
        this._preventSelect = (e) => e.preventDefault();

        // Listen to state changes
        window.appState.on('collections-changed', () => this.render());
        window.appState.on('active-request-changed', () => this.updateActiveHighlight());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd+E to rename the currently active request
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                const activeId = window.appState.activeRequest?.id;
                if (!activeId) return;
                const item = this.container.querySelector(`.request-item[data-request-id="${activeId}"]`);
                if (item) this.startRenameRequest(item);
                return;
            }

            // Up/Down to navigate requests
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const focused = document.activeElement;
                if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT')) return;

                e.preventDefault();
                const items = [...this.container.querySelectorAll('.request-item')];
                if (!items.length) return;

                const activeId = window.appState.activeRequest?.id;
                const currentIdx = activeId ? items.findIndex(el => el.dataset.requestId === activeId) : -1;

                let nextIdx;
                if (e.key === 'ArrowDown') {
                    nextIdx = currentIdx < items.length - 1 ? currentIdx + 1 : currentIdx;
                } else {
                    nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
                }

                if (nextIdx === currentIdx && currentIdx !== -1) return;

                const nextId = items[nextIdx].dataset.requestId;
                this.loadRequest(nextId);
                items[nextIdx].scrollIntoView({ block: 'nearest' });
            }
        });
    }

    render() {
        const collections = window.appState.collections;

        this.container.innerHTML = `
            <div class="sidebar-header">
                <h3>Collections</h3>
                <button class="btn-icon" id="addCollection" title="New Collection">+</button>
            </div>
            <div id="newCollectionForm" class="new-collection-form" style="display:none;">
                <input type="text" id="newCollectionName" class="form-input" placeholder="Collection name">
                <div class="form-actions">
                    <button class="btn-primary" id="confirmNewCollection">Create</button>
                    <button class="btn-secondary" id="cancelNewCollection">Cancel</button>
                </div>
            </div>
            ${collections.length > 0 ?
                collections.map(collection => this.renderCollection(collection)).join('') :
                '<div class="empty-state">No collections yet. Create one to get started.</div>'
            }
        `;

        this.attachEventListeners();
    }

    renderCollection(collection) {
        return `
            <div class="project" data-collection-id="${collection.id}">
                <div class="project-header">
                    <span class="expand-icon expanded">▶</span>
                    <span class="project-name">${collection.name}</span>
                    <div class="project-actions">
                        <button class="btn-icon add-folder-btn" data-collection-id="${collection.id}" title="New Folder">+</button>
                        <button class="btn-icon collection-delete-btn" data-collection-id="${collection.id}" title="Delete Collection">✕</button>
                    </div>
                </div>
                <div class="new-folder-form new-collection-form" id="folderForm-${collection.id}" style="display:none;">
                    <input type="text" class="form-input folder-name-input" placeholder="Folder name" data-collection-id="${collection.id}">
                    <div class="form-actions">
                        <button class="btn-primary confirm-folder-btn" data-collection-id="${collection.id}">Create</button>
                        <button class="btn-secondary cancel-folder-btn" data-collection-id="${collection.id}">Cancel</button>
                    </div>
                </div>
                ${collection.folders.map(folder => this.renderFolder(folder)).join('')}
            </div>
        `;
    }

    renderFolder(folder) {
        return `
            <div class="folder" data-folder-id="${folder.id}">
                <div class="folder-header">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">${folder.name}</span>
                    <div class="folder-actions">
                        <button class="folder-new-request-btn btn-icon"
                                data-folder-id="${folder.id}"
                                data-folder-name="${folder.name}"
                                title="New Request">+</button>
                        <button class="folder-delete-btn btn-icon"
                                data-folder-id="${folder.id}"
                                title="Delete Folder">✕</button>
                    </div>
                </div>
                <div class="folder-requests">
                    ${folder.requests.map(req => this.renderRequest(req)).join('')}
                </div>
            </div>
        `;
    }

    renderRequest(request) {
        const methodClass = `method-${request.method.toLowerCase()}`;
        const isActive = window.appState.activeRequest?.id === request.id;
        return `
            <div class="request-item${isActive ? ' active' : ''}" data-request-id="${request.id}">
                <span class="method-badge ${methodClass}">${request.method}</span>
                <span class="request-name">${request.name}</span>
                <button class="request-delete-btn" data-request-id="${request.id}" title="Delete request">✕</button>
            </div>
        `;
    }

    updateActiveHighlight() {
        const activeId = window.appState.activeRequest?.id;
        this.container.querySelectorAll('.request-item.active').forEach(el => el.classList.remove('active'));
        if (activeId) {
            const item = this.container.querySelector(`.request-item[data-request-id="${activeId}"]`);
            if (item) item.classList.add('active');
        }
    }

    attachEventListeners() {
        // Track hovered folder for Cmd+S quick-save
        this.container.querySelectorAll('.folder').forEach(el => {
            el.addEventListener('mouseenter', () => {
                window.hoveredFolderId = el.dataset.folderId;
            });
            el.addEventListener('mouseleave', () => {
                window.hoveredFolderId = null;
            });
        });

        // Track hovered request for Cmd+C copy-as-cURL
        this.container.querySelectorAll('.request-item').forEach(el => {
            el.addEventListener('mouseenter', () => {
                window.hoveredRequestId = el.dataset.requestId;
            });
            el.addEventListener('mouseleave', () => {
                window.hoveredRequestId = null;
            });
        });

        // Request item clicks (skip if we just finished a drag)
        this.container.querySelectorAll('.request-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (this._justDragged) { this._justDragged = false; return; }
                if (e.target.closest('.request-delete-btn')) return;
                const requestId = item.dataset.requestId;
                this.loadRequest(requestId);
            });
            item.addEventListener('dblclick', (e) => {
                if (e.target.closest('.request-delete-btn')) return;
                this.startRenameRequest(item);
            });
        });

        // Delete request buttons
        this.container.querySelectorAll('.request-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteRequest(btn.dataset.requestId);
            });
        });

        // New request buttons (one per folder)
        this.container.querySelectorAll('.folder-new-request-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.newRequest(btn.dataset.folderId, btn.dataset.folderName);
            });
        });

        // Delete collection buttons
        this.container.querySelectorAll('.collection-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteCollection(btn.dataset.collectionId);
            });
        });

        // Delete folder buttons
        this.container.querySelectorAll('.folder-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFolder(btn.dataset.folderId);
            });
        });

        // Collection expand/collapse — only on name, not action buttons
        this.container.querySelectorAll('.project-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.project-actions')) return;
                const icon = header.querySelector('.expand-icon');
                icon.classList.toggle('expanded');
            });
        });

        // Double-click to rename collection
        this.container.querySelectorAll('.project-name').forEach(nameEl => {
            nameEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const project = nameEl.closest('.project');
                if (project) this.startRenameCollection(project);
            });
        });

        // Double-click to rename folder
        this.container.querySelectorAll('.folder-name').forEach(nameEl => {
            nameEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const folder = nameEl.closest('.folder');
                if (folder) this.startRenameFolder(folder);
            });
        });

        // Add collection button
        const addBtn = document.getElementById('addCollection');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                document.getElementById('newCollectionForm').style.display = 'block';
                addBtn.style.display = 'none';
                requestAnimationFrame(() => document.getElementById('newCollectionName').focus());
            });
        }

        document.getElementById('confirmNewCollection')?.addEventListener('click', () => this.createNewCollection());
        document.getElementById('cancelNewCollection')?.addEventListener('click', () => this.hideNewCollectionForm());
        document.getElementById('newCollectionName')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.createNewCollection();
            if (e.key === 'Escape') this.hideNewCollectionForm();
        });

        // Add folder buttons (one per collection)
        this.container.querySelectorAll('.add-folder-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                const form = document.getElementById(`folderForm-${collectionId}`);
                if (!form) return;
                form.style.display = 'block';
                btn.style.display = 'none';
                requestAnimationFrame(() => form.querySelector('.folder-name-input').focus());
            });
        });

        this.container.querySelectorAll('.confirm-folder-btn').forEach(btn => {
            btn.addEventListener('click', () => this.createFolder(btn.dataset.collectionId));
        });

        this.container.querySelectorAll('.cancel-folder-btn').forEach(btn => {
            btn.addEventListener('click', () => this.hideFolderForm(btn.dataset.collectionId));
        });

        this.container.querySelectorAll('.folder-name-input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                const collectionId = input.dataset.collectionId;
                if (e.key === 'Enter') this.createFolder(collectionId);
                if (e.key === 'Escape') this.hideFolderForm(collectionId);
            });
        });

        // Mouse-based drag-and-drop for request items
        this.container.querySelectorAll('.request-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.request-delete-btn')) return;
                e.preventDefault();
                this._drag = {
                    requestId: item.dataset.requestId,
                    sourceEl: item,
                    startX: e.clientX,
                    startY: e.clientY,
                    ghost: null,
                    active: false,
                };
                document.addEventListener('mousemove', this._onMouseMove);
                document.addEventListener('mouseup', this._onMouseUp);
                document.addEventListener('selectstart', this._preventSelect);
            });
        });
    }

    _onMouseMove(e) {
        if (!this._drag) return;
        const dx = e.clientX - this._drag.startX;
        const dy = e.clientY - this._drag.startY;

        e.preventDefault(); // prevent text selection while dragging

        // Start dragging after 5px threshold
        if (!this._drag.active && Math.abs(dx) + Math.abs(dy) > 5) {
            this._drag.active = true;
            this._drag.sourceEl.classList.add('dragging');
            document.body.style.userSelect = 'none';
            window.getSelection()?.removeAllRanges();

            // Create ghost element
            const ghost = this._drag.sourceEl.cloneNode(true);
            ghost.classList.add('drag-ghost');
            ghost.style.position = 'fixed';
            ghost.style.pointerEvents = 'none';
            ghost.style.zIndex = '9999';
            ghost.style.width = this._drag.sourceEl.offsetWidth + 'px';
            document.body.appendChild(ghost);
            this._drag.ghost = ghost;
        }

        if (!this._drag.active) return;

        // Move ghost
        this._drag.ghost.style.left = (e.clientX + 8) + 'px';
        this._drag.ghost.style.top  = (e.clientY - 12) + 'px';

        // Highlight folder under cursor
        this.container.querySelectorAll('.folder.drag-over').forEach(f => f.classList.remove('drag-over'));
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const folderEl = target?.closest('.folder');
        if (folderEl) folderEl.classList.add('drag-over');
    }

    async _onMouseUp(e) {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);

        if (!this._drag || !this._drag.active) {
            this._cleanupDrag();
            return;
        }

        this._justDragged = true;

        // Find folder under cursor
        // Hide ghost temporarily so elementFromPoint can see through it
        if (this._drag.ghost) this._drag.ghost.style.display = 'none';
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const folderEl = target?.closest('.folder');
        const targetFolderId = folderEl?.dataset.folderId;
        const requestId = this._drag.requestId;

        this._cleanupDrag();

        if (!targetFolderId || !requestId) return;

        const sourceFolderId = this.findFolderForRequest(requestId);
        if (sourceFolderId === targetFolderId) return;

        try {
            await window.api.moveRequest(requestId, targetFolderId);
            await window.appState.loadCollections();
            showToast('Request moved');
        } catch (error) {
            showToast('Failed to move request: ' + error, 'error');
        }
    }

    _cleanupDrag() {
        document.body.style.userSelect = '';
        document.removeEventListener('selectstart', this._preventSelect);
        if (this._drag) {
            this._drag.sourceEl?.classList.remove('dragging');
            this._drag.ghost?.remove();
            this._drag = null;
        }
        this.container.querySelectorAll('.folder.drag-over').forEach(f => f.classList.remove('drag-over'));
    }

    startRenameRequest(item) {
        if (item.querySelector('.rename-input')) return; // already editing
        const nameSpan = item.querySelector('.request-name');
        const oldName = nameSpan.textContent;
        const requestId = item.dataset.requestId;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input form-input';
        input.value = oldName;

        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => this._commitRename(item, input, requestId, oldName);
        const cancel = () => {
            input.replaceWith(nameSpan);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            e.stopPropagation();
        });
        input.addEventListener('blur', () => commit());
        // Prevent click/mousedown from bubbling to request-item handlers
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    async _commitRename(item, input, requestId, oldName) {
        const newName = input.value.trim();
        if (!newName || newName === oldName) {
            // Restore original span
            const span = document.createElement('span');
            span.className = 'request-name';
            span.textContent = oldName;
            if (input.parentNode) input.replaceWith(span);
            return;
        }

        try {
            await window.api.renameRequest(requestId, newName);
            await window.appState.loadCollections();
            showToast('Request renamed');
        } catch (error) {
            showToast('Failed to rename: ' + error, 'error');
        }
    }

    hideNewCollectionForm() {
        const form = document.getElementById('newCollectionForm');
        const addBtn = document.getElementById('addCollection');
        if (form) form.style.display = 'none';
        if (addBtn) addBtn.style.display = '';
        const input = document.getElementById('newCollectionName');
        if (input) input.value = '';
    }

    hideFolderForm(collectionId) {
        const form = document.getElementById(`folderForm-${collectionId}`);
        const btn = this.container.querySelector(`.add-folder-btn[data-collection-id="${collectionId}"]`);
        if (form) { form.style.display = 'none'; form.querySelector('.folder-name-input').value = ''; }
        if (btn) btn.style.display = '';
    }

    loadRequest(requestId) {
        for (const collection of window.appState.collections) {
            for (const folder of collection.folders) {
                const request = folder.requests.find(r => r.id === requestId);
                if (request) {
                    window.appState.setActiveRequest(request, folder.id);
                    return;
                }
            }
        }
    }

    async createNewCollection() {
        const input = document.getElementById('newCollectionName');
        const name = input ? input.value.trim() : '';
        if (!name) return;

        try {
            await window.api.createCollection(name);
            this.hideNewCollectionForm();
            await window.appState.loadCollections();
        } catch (error) {
            alert('Failed to create collection: ' + error);
        }
    }

    async createFolder(collectionId) {
        const form = document.getElementById(`folderForm-${collectionId}`);
        const input = form?.querySelector('.folder-name-input');
        const name = input ? input.value.trim() : '';
        if (!name) return;

        try {
            await window.api.createFolder(collectionId, name);
            await window.appState.loadCollections();
        } catch (error) {
            alert('Failed to create folder: ' + error);
        }
    }

    newRequest(folderId, folderName) {
        window.requestBuilder.resetRequest();
        window.appState.setActiveRequest(null, folderId);
        window.showToast(`New request in "${folderName}"`);
    }

    findFolderForRequest(requestId) {
        for (const collection of window.appState.collections) {
            for (const folder of collection.folders) {
                if (folder.requests.some(r => r.id === requestId)) {
                    return folder.id;
                }
            }
        }
        return null;
    }

    async deleteRequest(requestId) {
        // Snapshot request data + folder before deleting
        let requestData = null, folderId = null;
        for (const col of window.appState.collections) {
            for (const folder of col.folders) {
                const req = folder.requests.find(r => r.id === requestId);
                if (req) { requestData = { ...req }; folderId = folder.id; break; }
            }
            if (requestData) break;
        }
        const wasActive = window.appState.activeRequest?.id === requestId;

        if (requestData && folderId) {
            window.undoManager.push({
                description: `Delete "${requestData.name}"`,
                execute: async () => {
                    await window.api.saveRequest(folderId, requestData);
                    await window.appState.loadCollections();
                    if (wasActive) {
                        for (const col of window.appState.collections) {
                            for (const folder of col.folders) {
                                const req = folder.requests.find(r => r.id === requestData.id);
                                if (req) { window.appState.setActiveRequest(req, folder.id); break; }
                            }
                        }
                    }
                    window.showToast(`Restored "${requestData.name}"`);
                }
            });
        }

        try {
            await window.api.deleteRequest(requestId);
            if (window.appState.activeRequest?.id === requestId) {
                window.appState.setActiveRequest(null, null);
            }
            await window.appState.loadCollections();
            showToast('Deleted · ⌘Z to undo');
        } catch (error) {
            showToast('Failed to delete: ' + error, 'error');
        }
    }

    async deleteCollection(collectionId) {
        try {
            await window.api.deleteCollection(collectionId);
            await window.appState.loadCollections();
            showToast('Collection deleted');
        } catch (error) {
            showToast('Failed to delete collection: ' + error, 'error');
        }
    }

    async deleteFolder(folderId) {
        try {
            await window.api.deleteFolder(folderId);
            await window.appState.loadCollections();
            showToast('Folder deleted');
        } catch (error) {
            showToast('Failed to delete folder: ' + error, 'error');
        }
    }

    startRenameCollection(projectEl) {
        const nameSpan = projectEl.querySelector('.project-name');
        if (!nameSpan || projectEl.querySelector('.rename-input')) return;
        const oldName = nameSpan.textContent;
        const collectionId = projectEl.dataset.collectionId;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input form-input';
        input.value = oldName;

        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const commit = async () => {
            const newName = input.value.trim();
            if (!newName || newName === oldName) {
                const span = document.createElement('span');
                span.className = 'project-name';
                span.textContent = oldName;
                if (input.parentNode) input.replaceWith(span);
                return;
            }
            try {
                await window.api.renameCollection(collectionId, newName);
                await window.appState.loadCollections();
                showToast('Collection renamed');
            } catch (error) {
                showToast('Failed to rename collection: ' + error, 'error');
            }
        };
        const cancel = () => {
            const span = document.createElement('span');
            span.className = 'project-name';
            span.textContent = oldName;
            if (input.parentNode) input.replaceWith(span);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            e.stopPropagation();
        });
        input.addEventListener('blur', () => commit());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    startRenameFolder(folderEl) {
        const nameSpan = folderEl.querySelector('.folder-name');
        if (!nameSpan || folderEl.querySelector('.rename-input')) return;
        const oldName = nameSpan.textContent;
        const folderId = folderEl.dataset.folderId;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input form-input';
        input.value = oldName;

        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const commit = async () => {
            const newName = input.value.trim();
            if (!newName || newName === oldName) {
                const span = document.createElement('span');
                span.className = 'folder-name';
                span.textContent = oldName;
                if (input.parentNode) input.replaceWith(span);
                return;
            }
            try {
                await window.api.renameFolder(folderId, newName);
                await window.appState.loadCollections();
                showToast('Folder renamed');
            } catch (error) {
                showToast('Failed to rename folder: ' + error, 'error');
            }
        };
        const cancel = () => {
            const span = document.createElement('span');
            span.className = 'folder-name';
            span.textContent = oldName;
            if (input.parentNode) input.replaceWith(span);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            e.stopPropagation();
        });
        input.addEventListener('blur', () => commit());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('mousedown', (e) => e.stopPropagation());
    }
}

// Initialize
window.sidebar = new Sidebar();
