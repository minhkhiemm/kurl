class SearchModal {
    constructor() {
        this.isOpen = false;
        this.selectedIndex = -1;
        this.searchResults = [];

        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd+K or Ctrl+K to open
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }

            // Esc to close
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }

            // Arrow navigation
            if (this.isOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigate(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigate(-1);
                } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
                    e.preventDefault();
                    this.selectResult(this.selectedIndex);
                }
            }
        });
    }

    open() {
        this.isOpen = true;
        const modal = document.getElementById('searchModal');
        modal.classList.add('active');

        const input = document.getElementById('searchInput');
        input.value = '';
        input.focus();

        this.displayAllRequests();
    }

    close() {
        this.isOpen = false;
        document.getElementById('searchModal').classList.remove('active');
    }

    displayAllRequests() {
        const requests = this.getAllRequests();
        this.displayResults(requests);
    }

    getAllRequests() {
        const requests = [];
        window.appState.collections.forEach(collection => {
            collection.folders.forEach(folder => {
                folder.requests.forEach(request => {
                    requests.push({
                        ...request,
                        folder: folder.name,
                        collection: collection.name
                    });
                });
            });
        });
        return requests;
    }

    async search(query) {
        query = query.trim().toLowerCase();

        if (!query) {
            this.displayAllRequests();
            return;
        }

        // Check if it's a cURL command
        if (query.startsWith('curl ')) {
            try {
                const parsed = await window.api.parseCurl(query);
                this.displayCurlResult(parsed);
                return;
            } catch (e) {
                // If parsing fails, continue with normal search
            }
        }

        // Normal search
        const allRequests = this.getAllRequests();
        const searchTerms = query.split(/\s+/);

        const filtered = allRequests.filter(req => {
            const searchText = `${req.method} ${req.url} ${req.name}`.toLowerCase();
            return searchTerms.every(term => searchText.includes(term));
        });

        this.displayResults(filtered);
    }

    displayResults(results) {
        this.searchResults = results;
        const container = document.getElementById('searchResults');

        if (results.length === 0) {
            container.innerHTML = '<div class="search-empty">No requests found</div>';
            return;
        }

        container.innerHTML = results.map((req, index) => `
            <div class="search-result-item" data-index="${index}">
                <span class="search-result-method method-${req.method.toLowerCase()}">${req.method}</span>
                <div style="flex: 1;">
                    <div class="search-result-path">${req.url}</div>
                    <div class="search-result-name">${req.name} • ${req.folder}</div>
                </div>
            </div>
        `).join('');

        // Attach click handlers
        container.querySelectorAll('.search-result-item').forEach((item, index) => {
            item.addEventListener('click', () => this.selectResult(index));
        });

        this.selectedIndex = -1;
    }

    displayCurlResult(parsed) {
        this.searchResults = [parsed];
        const container = document.getElementById('searchResults');

        container.innerHTML = `
            <div class="search-result-item" data-index="0">
                <span class="search-result-method method-${parsed.method.toLowerCase()}">${parsed.method}</span>
                <div style="flex: 1;">
                    <div class="search-result-path">${parsed.url}</div>
                    <div class="search-result-name">Parsed from cURL command</div>
                </div>
            </div>
        `;

        container.querySelector('.search-result-item').addEventListener('click', () => {
            window.appState.setActiveRequest(parsed);
            this.close();
        });
    }

    navigate(direction) {
        if (this.searchResults.length === 0) return;

        // Remove previous selection
        const items = document.querySelectorAll('.search-result-item');
        if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
            items[this.selectedIndex].classList.remove('selected');
        }

        // Update index
        this.selectedIndex += direction;
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.searchResults.length - 1;
        }
        if (this.selectedIndex >= this.searchResults.length) {
            this.selectedIndex = 0;
        }

        // Add new selection
        items[this.selectedIndex].classList.add('selected');
        items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }

    selectResult(index) {
        const request = this.searchResults[index];
        if (request) {
            window.appState.setActiveRequest(request);
            this.close();
        }
    }
}

// Initialize search modal
window.searchModal = new SearchModal();

// Setup search input listener
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    window.searchModal.search(e.target.value);
});

// Close on backdrop click
document.getElementById('searchModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'searchModal') {
        window.searchModal.close();
    }
});