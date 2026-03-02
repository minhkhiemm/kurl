class AppState {
    constructor() {
        this.collections = [];
        this.activeCollection = null;
        this.activeRequest = null;
        this.activeFolderId = null;  // folder the active request was loaded from
        this.lastResponse = null;
        this.lastMultipleResponses = null;
        this.listeners = new Map();
    }

    // State updates
    setCollections(collections) {
        this.collections = collections;
        this.emit('collections-changed', collections);
    }

    setActiveRequest(request, folderId = null) {
        this.activeRequest = request;
        this.activeFolderId = folderId;
        this.emit('active-request-changed', request);
    }

    setLastResponse(response) {
        this.lastResponse = response;
        this.lastMultipleResponses = null;
        this.emit('response-received', response);
    }

    setMultipleResponses(responses) {
        this.lastMultipleResponses = responses;
        this.lastResponse = responses[responses.length - 1];
        this.emit('multiple-responses-received', responses);
    }

    // Load collections from backend
    async loadCollections() {
        try {
            const collections = await window.api.loadAllCollections();
            this.setCollections(collections);
        } catch (error) {
            console.error('Failed to load collections:', error);
        }
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }
}

// Create global state instance
window.appState = new AppState();