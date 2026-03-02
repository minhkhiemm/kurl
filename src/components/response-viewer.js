class ResponseViewer {
    constructor() {
        this.container = document.getElementById('responseSection');
        this.prettyMode = true;
        this.multipleResponses = null;
        this.selectedResponseIndex = null;

        // Listen to single response
        window.appState.on('response-received', (response) => {
            this.multipleResponses = null;
            this.selectedResponseIndex = null;
            this.hideMultipleResponsesTable();
            this.displayResponse(response);
        });

        // Listen to multiple responses
        window.appState.on('multiple-responses-received', (responses) => {
            this.multipleResponses = responses;
            this.selectedResponseIndex = responses.length - 1;
            this.showMultipleResponsesTable(responses);
            this.displayResponse(responses[this.selectedResponseIndex]);
        });
    }

    render() {
        this.container.innerHTML = `
            <div class="response-header">
                <span class="response-label">Response</span>
                <span class="status-code" id="statusCode"></span>
                <span class="response-time" id="responseTime"></span>
                <button class="copy-button" id="copyResponse">Copy</button>
            </div>

            <div class="response-tabs">
                <button class="response-tab active" data-tab="body">Body</button>
                <button class="response-tab" data-tab="headers">Headers</button>
            </div>

            <div class="response-tab-panel active" id="response-body-panel">
                <div class="response-toolbar">
                    <div class="format-type-group" id="bodyFormatGroup">
                        <button class="format-type-btn active" data-format="pretty">Pretty</button>
                        <button class="format-type-btn" data-format="raw">Raw</button>
                    </div>
                </div>
                <div class="response-body" id="responseBody">
                    <div class="empty-state">Send a request to see the response here.</div>
                </div>
            </div>

            <div class="response-tab-panel" id="response-headers-panel">
                <div class="response-headers-list" id="responseHeaders">
                    <div class="empty-state">No response headers yet.</div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('.response-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Copy button
        document.getElementById('copyResponse')?.addEventListener('click', () => {
            this.copyResponse();
        });

        // Pretty / Raw toggle
        document.getElementById('bodyFormatGroup')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.format-type-btn');
            if (!btn) return;

            document.querySelectorAll('#bodyFormatGroup .format-type-btn')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            this.prettyMode = btn.dataset.format === 'pretty';
            const response = window.appState.lastResponse;
            if (response) this.displayBody(response, this.prettyMode);
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.response-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.response-tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`.response-tab[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`response-${tabName}-panel`).classList.add('active');
    }

    displayResponse(response) {
        const statusEl = document.getElementById('statusCode');
        statusEl.textContent = `${response.status_code} ${response.status_text}`;
        statusEl.className = 'status-code';
        if (response.status_code >= 200 && response.status_code < 300) {
            statusEl.classList.add('status-success');
        } else if (response.status_code >= 400) {
            statusEl.classList.add('status-error');
        } else if (response.status_code >= 300) {
            statusEl.classList.add('status-redirect');
        }

        const ms = response.duration_ms;
        const timeEl = document.getElementById('responseTime');
        timeEl.textContent = ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
        timeEl.className = 'response-time' + (ms > 1000 ? ' slow' : ms > 300 ? ' medium' : '');

        this.displayBody(response, this.prettyMode);
        this.displayHeaders(response.headers);
    }

    displayBody(response, pretty = true) {
        const bodyContainer = document.getElementById('responseBody');
        let body = response.body;

        if (pretty) {
            try {
                const json = JSON.parse(body);
                const formatted = JSON.stringify(json, null, 2);
                bodyContainer.innerHTML = this.syntaxHighlight(formatted);
                return;
            } catch (e) {
                // Not JSON — fall through to plain text
            }
        }

        // Raw or non-JSON: plain text
        bodyContainer.textContent = body;
    }

    syntaxHighlight(json) {
        // Escape HTML entities first
        const escaped = json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return escaped.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        // Object key — strip the trailing colon for the span, re-add after
                        const key = match.slice(0, -1);
                        return `<span class="json-key">${key}</span>:`;
                    }
                    return `<span class="json-string">${match}</span>`;
                }
                if (/true|false/.test(match)) return `<span class="json-boolean">${match}</span>`;
                if (/null/.test(match))        return `<span class="json-null">${match}</span>`;
                return `<span class="json-number">${match}</span>`;
            }
        );
    }

    displayHeaders(headers) {
        const container = document.getElementById('responseHeaders');
        const entries = Object.entries(headers);
        if (!entries.length) {
            container.innerHTML = '<div class="empty-state">No response headers.</div>';
            return;
        }
        container.innerHTML = entries.map(([key, value]) => `
            <div class="response-header-item">
                <span class="header-key">${key}</span>
                <span class="header-value">${value}</span>
            </div>
        `).join('');
    }

    showMultipleResponsesTable(responses) {
        let tableContainer = document.getElementById('multiResponseTable');
        if (!tableContainer) {
            tableContainer = document.createElement('div');
            tableContainer.id = 'multiResponseTable';
            tableContainer.className = 'multi-response-table-container';
            // Insert after response-header
            const responseHeader = this.container.querySelector('.response-header');
            if (responseHeader) {
                responseHeader.after(tableContainer);
            }
        }

        const rows = responses.map((r, i) => {
            const statusClass = r.status_code >= 200 && r.status_code < 300
                ? 'status-success'
                : r.status_code >= 400 ? 'status-error' : r.status_code >= 300 ? 'status-redirect' : '';
            const durationText = r.duration_ms < 1000
                ? `${r.duration_ms} ms`
                : `${(r.duration_ms / 1000).toFixed(2)} s`;
            const durationClass = r.duration_ms > 1000 ? 'slow' : r.duration_ms > 300 ? 'medium' : '';
            const selected = i === this.selectedResponseIndex ? 'selected' : '';

            return `<tr class="multi-response-row ${selected}" data-index="${i}">
                <td class="multi-response-cell index-cell">${i + 1}</td>
                <td class="multi-response-cell"><span class="status-badge ${statusClass}">${r.status_code}</span></td>
                <td class="multi-response-cell duration-cell ${durationClass}">${durationText}</td>
            </tr>`;
        }).join('');

        tableContainer.innerHTML = `
            <table class="multi-response-table">
                <thead>
                    <tr>
                        <th class="multi-response-th">Index</th>
                        <th class="multi-response-th">Status Code</th>
                        <th class="multi-response-th">Duration</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        // Click handler for rows
        tableContainer.querySelectorAll('.multi-response-row').forEach(row => {
            row.addEventListener('click', () => {
                const index = parseInt(row.dataset.index);
                this.selectedResponseIndex = index;
                this.displayResponse(this.multipleResponses[index]);
                // Update selected row highlight
                tableContainer.querySelectorAll('.multi-response-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
            });
        });
    }

    hideMultipleResponsesTable() {
        const tableContainer = document.getElementById('multiResponseTable');
        if (tableContainer) tableContainer.remove();
    }

    async copyResponse() {
        const response = window.appState.lastResponse;
        if (!response) return;
        try {
            await navigator.clipboard.writeText(response.body);
            const btn = document.getElementById('copyResponse');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 1500);
        } catch (e) {
            alert('Failed to copy response');
        }
    }
}

// Initialize
window.responseViewer = new ResponseViewer();
