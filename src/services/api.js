const { invoke } = window.__TAURI__.core;

export const api = {
    // Request operations
    async sendRequest(request) {
        return await invoke('send_request', { request });
    },

    async sendMultipleRequests(requests, delayMs) {
        return await invoke('send_multiple_requests', {
            requests,
            delayMs
        });
    },

    // Collection operations
    async createCollection(name) {
        return await invoke('create_collection_cmd', { name });
    },

    async createFolder(collectionId, name) {
        return await invoke('create_folder_cmd', {
            collectionId,
            name
        });
    },

    async saveRequest(folderId, request) {
        return await invoke('save_request_cmd', {
            folderId,
            request
        });
    },

    async loadAllCollections() {
        return await invoke('load_all_collections_cmd');
    },

    async deleteCollection(collectionId) {
        return await invoke('delete_collection_cmd', { collectionId });
    },

    async deleteFolder(folderId) {
        return await invoke('delete_folder_cmd', { folderId });
    },

    async deleteRequest(requestId) {
        return await invoke('delete_request_cmd', { requestId });
    },

    async renameRequest(requestId, newName) {
        return await invoke('rename_request_cmd', { requestId, newName });
    },

    async renameCollection(collectionId, newName) {
        return await invoke('rename_collection_cmd', { collectionId, newName });
    },

    async renameFolder(folderId, newName) {
        return await invoke('rename_folder_cmd', { folderId, newName });
    },

    async moveRequest(requestId, newFolderId) {
        return await invoke('move_request_cmd', { requestId, newFolderId });
    },

    async getOrCreateHistoryFolder() {
        return await invoke('get_or_create_history_folder_cmd');
    },

    // Parser operations
    async parseCurl(curlCommand) {
        return await invoke('parse_curl', { curlCommand });
    }
};

// Make available globally
window.api = api;