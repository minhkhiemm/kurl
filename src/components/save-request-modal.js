class SaveRequestModal {
    constructor() {
        this.modal = null;
        this.currentRequest = null;
        this.onSave = null;
        this.render();
    }

    render() {
        const modalHTML = `
            <div class="modal" id="saveRequestModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Save Request</h2>
                        <button class="modal-close" id="closeSaveModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="requestName">Request Name</label>
                            <input type="text" id="requestName" class="form-input" placeholder="Enter request name">
                        </div>

                        <div class="form-group">
                            <label for="collectionSelect">Collection</label>
                            <select id="collectionSelect" class="form-select">
                                <option value="">Select a collection</option>
                            </select>
                            <button class="btn-secondary" id="createCollectionBtn">+ New Collection</button>
                            <div class="inline-create" id="modalNewCollectionForm" style="display:none; margin-top:8px;">
                                <input type="text" id="modalNewCollectionName" class="form-input" placeholder="Collection name">
                                <div style="display:flex; gap:6px; margin-top:6px;">
                                    <button class="btn-primary" id="confirmCreateCollectionBtn">Create</button>
                                    <button class="btn-secondary" id="cancelCreateCollectionBtn">Cancel</button>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="folderSelect">Folder</label>
                            <select id="folderSelect" class="form-select" disabled>
                                <option value="">Select a folder</option>
                            </select>
                            <button class="btn-secondary" id="createFolderBtn" disabled>+ New Folder</button>
                            <div class="inline-create" id="newFolderForm" style="display:none; margin-top:8px;">
                                <input type="text" id="newFolderName" class="form-input" placeholder="Folder name">
                                <div style="display:flex; gap:6px; margin-top:6px;">
                                    <button class="btn-primary" id="confirmCreateFolderBtn">Create</button>
                                    <button class="btn-secondary" id="cancelCreateFolderBtn">Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="cancelSaveBtn">Cancel</button>
                        <button class="btn-primary" id="confirmSaveBtn">Save</button>
                    </div>
                </div>
            </div>
        `;

        const existingModal = document.getElementById('saveRequestModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('saveRequestModal');

        this.attachEventListeners();
    }

    attachEventListeners() {
        document.getElementById('closeSaveModal').addEventListener('click', () => this.hide());
        document.getElementById('cancelSaveBtn').addEventListener('click', () => this.hide());

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        // Collection select change
        document.getElementById('collectionSelect').addEventListener('change', async (e) => {
            const collectionId = e.target.value;
            if (collectionId) {
                await this.loadFolders(collectionId);
                document.getElementById('folderSelect').disabled = false;
                document.getElementById('createFolderBtn').disabled = false;
            } else {
                document.getElementById('folderSelect').disabled = true;
                document.getElementById('createFolderBtn').disabled = true;
            }
        });

        // New Collection button - show inline form
        document.getElementById('createCollectionBtn').addEventListener('click', () => {
            document.getElementById('modalNewCollectionForm').style.display = 'block';
            document.getElementById('createCollectionBtn').style.display = 'none';
            requestAnimationFrame(() => document.getElementById('modalNewCollectionName').focus());
        });

        document.getElementById('confirmCreateCollectionBtn').addEventListener('click', () => this.createCollection());
        document.getElementById('cancelCreateCollectionBtn').addEventListener('click', () => {
            document.getElementById('modalNewCollectionForm').style.display = 'none';
            document.getElementById('createCollectionBtn').style.display = '';
            document.getElementById('modalNewCollectionName').value = '';
        });

        document.getElementById('modalNewCollectionName').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.createCollection();
            if (e.key === 'Escape') document.getElementById('cancelCreateCollectionBtn').click();
        });

        // New Folder button - show inline form
        document.getElementById('createFolderBtn').addEventListener('click', () => {
            document.getElementById('newFolderForm').style.display = 'block';
            document.getElementById('createFolderBtn').style.display = 'none';
            requestAnimationFrame(() => document.getElementById('newFolderName').focus());
        });

        document.getElementById('confirmCreateFolderBtn').addEventListener('click', () => this.createFolder());
        document.getElementById('cancelCreateFolderBtn').addEventListener('click', () => {
            document.getElementById('newFolderForm').style.display = 'none';
            document.getElementById('createFolderBtn').style.display = '';
            document.getElementById('newFolderName').value = '';
        });

        document.getElementById('newFolderName').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.createFolder();
            if (e.key === 'Escape') document.getElementById('cancelCreateFolderBtn').click();
        });

        // Save button
        document.getElementById('confirmSaveBtn').addEventListener('click', () => this.saveRequest());
    }

    async show(request) {
        this.currentRequest = request;
        this.modal.classList.add('active');
        await this.loadCollections();
        document.getElementById('requestName').value = request.name || 'Untitled Request';
    }

    hide() {
        this.modal.classList.remove('active');
        // Reset inline forms
        document.getElementById('modalNewCollectionForm').style.display = 'none';
        document.getElementById('createCollectionBtn').style.display = '';
        document.getElementById('modalNewCollectionName').value = '';
        document.getElementById('newFolderForm').style.display = 'none';
        document.getElementById('createFolderBtn').style.display = '';
        document.getElementById('newFolderName').value = '';
    }

    async loadCollections() {
        try {
            const collections = await window.api.loadAllCollections();
            const select = document.getElementById('collectionSelect');
            select.innerHTML = '<option value="">Select a collection</option>';
            collections.forEach(collection => {
                const option = document.createElement('option');
                option.value = collection.id;
                option.textContent = collection.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load collections:', error);
        }
    }

    async loadFolders(collectionId) {
        try {
            const collections = await window.api.loadAllCollections();
            const collection = collections.find(c => c.id === collectionId);
            const select = document.getElementById('folderSelect');
            select.innerHTML = '<option value="">Select a folder</option>';
            if (collection && collection.folders) {
                collection.folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder.id;
                    option.textContent = folder.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load folders:', error);
        }
    }

    async createCollection() {
        const name = document.getElementById('modalNewCollectionName').value.trim();
        if (!name) return;

        try {
            await window.api.createCollection(name);
            // Reset inline form
            document.getElementById('modalNewCollectionForm').style.display = 'none';
            document.getElementById('createCollectionBtn').style.display = '';
            document.getElementById('modalNewCollectionName').value = '';
            await this.loadCollections();
            // Auto-select the newly created collection
            const select = document.getElementById('collectionSelect');
            select.value = select.options[select.options.length - 1].value;
            select.dispatchEvent(new Event('change'));
        } catch (error) {
            console.error('Error creating collection:', error);
            alert('Failed to create collection: ' + error);
        }
    }

    async createFolder() {
        const collectionId = document.getElementById('collectionSelect').value;
        if (!collectionId) {
            alert('Please select a collection first');
            return;
        }

        const name = document.getElementById('newFolderName').value.trim();
        if (!name) return;

        try {
            await window.api.createFolder(collectionId, name);
            // Reset inline form
            document.getElementById('newFolderForm').style.display = 'none';
            document.getElementById('createFolderBtn').style.display = '';
            document.getElementById('newFolderName').value = '';
            await this.loadFolders(collectionId);
            // Auto-select the newly created folder
            const select = document.getElementById('folderSelect');
            select.value = select.options[select.options.length - 1].value;
        } catch (error) {
            console.error('Error creating folder:', error);
            alert('Failed to create folder: ' + error);
        }
    }

    async saveRequest() {
        const requestName = document.getElementById('requestName').value.trim();
        const folderId = document.getElementById('folderSelect').value;

        if (!requestName) {
            alert('Please enter a request name');
            return;
        }

        if (!folderId) {
            alert('Please select a folder');
            return;
        }

        // Find previous state (edit) or flag as new
        let prevRequest = null, prevFolderId = null;
        for (const col of window.appState.collections) {
            for (const folder of col.folders) {
                const req = folder.requests.find(r => r.id === this.currentRequest.id);
                if (req) { prevRequest = { ...req }; prevFolderId = folder.id; break; }
            }
            if (prevRequest) break;
        }

        this.currentRequest.name = requestName;
        const savedId = this.currentRequest.id;
        const savedName = requestName;

        window.undoManager.push({
            description: prevRequest ? `Edit "${savedName}"` : `New "${savedName}"`,
            execute: async () => {
                if (prevRequest && prevFolderId) {
                    // Undo edit — restore previous state
                    await window.api.saveRequest(prevFolderId, prevRequest);
                } else {
                    // Undo new request — delete it
                    await window.api.deleteRequest(savedId);
                }
                await window.appState.loadCollections();
                if (prevRequest && prevFolderId) {
                    for (const col of window.appState.collections) {
                        for (const folder of col.folders) {
                            const req = folder.requests.find(r => r.id === prevRequest.id);
                            if (req) { window.appState.setActiveRequest(req, folder.id); break; }
                        }
                    }
                    window.showToast(`Restored "${savedName}"`);
                } else {
                    window.appState.setActiveRequest(null, null);
                    window.showToast(`Removed "${savedName}"`);
                }
            }
        });

        try {
            await window.api.saveRequest(folderId, this.currentRequest);
            this.hide();
            await window.appState.loadCollections();

            // Refresh the active request so the builder reflects what was saved
            for (const collection of window.appState.collections) {
                let found = false;
                for (const folder of collection.folders) {
                    const req = folder.requests.find(r => r.id === savedId);
                    if (req) {
                        window.appState.setActiveRequest(req, folder.id);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        } catch (error) {
            console.error('Failed to save request:', error);
            alert('Failed to save request: ' + error);
        }
    }
}

// Initialize
window.saveRequestModal = new SaveRequestModal();
