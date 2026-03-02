class RequestBuilder {
    constructor() {
        this.container = document.getElementById('requestBuilder');
        this.currentRequest = {
            method: 'GET',
            url: '',
            headers: [
                { key: '', value: '' }
            ],
            body: '',
            params: [
                { key: '', value: '' }
            ]
        };
        this.fieldStrategies = {};
        this._syncingFromUrl = false;
        this._syncingFromParams = false;

        // Listen to active request changes
        window.appState.on('active-request-changed', (request) => {
            if (request) {
                this.loadRequest(request);
            }
        });
    }

    render() {
        this.container.innerHTML = `
            <div class="url-bar">
                <select class="method-select" id="methodSelect" data-method="GET">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="HEAD">HEAD</option>
                    <option value="OPTIONS">OPTIONS</option>
                </select>
                <input type="text" class="url-input" id="urlInput"
                       placeholder="Enter request URL">
                <button class="save-button" id="saveButton">Save</button>
                <button class="send-button" id="sendButton">Send</button>
            </div>

            <div class="repeat-config">
                <div class="input-group">
                    <label for="repeatCount">Repeats</label>
                    <div class="number-stepper">
                        <button class="stepper-btn" id="repeatDecBtn" title="Decrease">−</button>
                        <input type="number" id="repeatCount" value="1" min="1">
                        <button class="stepper-btn" id="repeatIncBtn" title="Increase">+</button>
                    </div>
                </div>
                <div class="input-group">
                    <label for="delayMs">Delay (ms)</label>
                    <div class="number-stepper">
                        <button class="stepper-btn" id="delayDecBtn" title="Decrease">−</button>
                        <input type="number" id="delayMs" value="1000" min="0" step="100">
                        <button class="stepper-btn" id="delayIncBtn" title="Increase">+</button>
                    </div>
                </div>
            </div>

            <div id="variantTableContainer"></div>

            <div class="tabs">
                <button class="tab active" data-tab="headers">Headers</button>
                <button class="tab" data-tab="body">Body</button>
                <button class="tab" data-tab="params">Params</button>
            </div>
        `;

        this.attachEventListeners();
        this.renderAllTabs();
    }

    renderAllTabs() {
        // Remember which tab is currently active
        const activeTab = this.container.querySelector('.tab.active')?.dataset.tab || 'headers';

        // Find or create the tab content container
        let tabContent = this.container.querySelector('.tab-content');
        if (!tabContent) {
            tabContent = document.createElement('div');
            tabContent.className = 'tab-content';
            this.container.appendChild(tabContent);
        }

        // Render all three tabs
        tabContent.innerHTML = `
            <!-- Headers Tab -->
            <div class="tab-panel${activeTab === 'headers' ? ' active' : ''}" id="headers-panel">
                <div class="headers-editor" id="headersEditor">
                    ${this.currentRequest.headers.map((header, index) => `
                        <div class="header-row">
                            <input type="text" placeholder="Key" value="${header.key}"
                                   data-index="${index}" data-field="key" class="header-key-input">
                            <input type="text" placeholder="Value" value="${header.value}"
                                   data-index="${index}" data-field="value" class="header-value-input">
                        </div>
                    `).join('')}
                </div>
                <button class="add-button" id="addHeader">+ Add Header</button>
            </div>

            <!-- Body Tab -->
            <div class="tab-panel${activeTab === 'body' ? ' active' : ''}" id="body-panel">
                <div class="body-format-bar">
                    <div class="format-type-group" id="bodyTypeGroup">
                        <button class="format-type-btn active" data-format="json">JSON</button>
                        <button class="format-type-btn" data-format="xml">XML</button>
                        <button class="format-type-btn" data-format="form">Form</button>
                        <button class="format-type-btn" data-format="raw">Raw</button>
                    </div>
                    <div class="format-actions">
                        <button class="format-action-btn" id="prettifyBtn" title="Format JSON">Prettify</button>
                        <button class="format-action-btn" id="minifyBtn" title="Minify JSON">Minify</button>
                    </div>
                </div>
                <div class="code-editor-wrapper">
                    <pre class="code-highlight" id="bodyHighlight" aria-hidden="true"></pre>
                    <textarea class="body-editor" id="bodyEditor"
                              spellcheck="false"
                              placeholder="Enter request body...">${this.currentRequest.body || ''}</textarea>
                </div>
            </div>

            <!-- Params Tab -->
            <div class="tab-panel${activeTab === 'params' ? ' active' : ''}" id="params-panel">
                <h4 style="margin-bottom: 15px; font-size: 14px;">Query Parameters</h4>
                <div class="params-editor" id="paramsEditor">
                    ${this.currentRequest.params.map((param, index) => `
                        <div class="header-row">
                            <input type="text" placeholder="Key" value="${param.key}"
                                   data-index="${index}" data-field="key" class="param-key-input">
                            <input type="text" placeholder="Value" value="${param.value}"
                                   data-index="${index}" data-field="value" class="param-value-input">
                            <button class="param-delete-btn" data-index="${index}" title="Remove">✕</button>
                        </div>
                    `).join('')}
                </div>
                <button class="add-button" id="addParam">+ Add Parameter</button>
            </div>
        `;

        this.attachTabContentListeners();
    }

    parseUrlParams() {
        const urlInput = document.getElementById('urlInput');
        if (!urlInput) return;

        const url = urlInput.value;
        const questionMark = url.indexOf('?');

        const params = [];

        if (questionMark !== -1) {
            const queryString = url.substring(questionMark + 1);
            for (const pair of queryString.split('&')) {
                if (!pair) continue;
                const eqPos = pair.indexOf('=');
                if (eqPos !== -1) {
                    try {
                        params.push({
                            key: decodeURIComponent(pair.substring(0, eqPos).replace(/\+/g, ' ')),
                            value: decodeURIComponent(pair.substring(eqPos + 1).replace(/\+/g, ' '))
                        });
                    } catch {
                        params.push({
                            key: pair.substring(0, eqPos),
                            value: pair.substring(eqPos + 1)
                        });
                    }
                } else {
                    try {
                        params.push({
                            key: decodeURIComponent(pair.replace(/\+/g, ' ')),
                            value: ''
                        });
                    } catch {
                        params.push({ key: pair, value: '' });
                    }
                }
            }
        }

        params.push({ key: '', value: '' });
        this.currentRequest.params = params;
        this.updateParamsPanel();
    }

    syncUrlFromParams() {
        const urlInput = document.getElementById('urlInput');
        if (!urlInput) return;

        const url = urlInput.value;
        const questionMark = url.indexOf('?');
        const baseUrl = questionMark !== -1 ? url.substring(0, questionMark) : url;

        const paramPairs = this.currentRequest.params
            .filter(p => p.key)
            .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);

        urlInput.value = paramPairs.length > 0
            ? `${baseUrl}?${paramPairs.join('&')}`
            : baseUrl;
    }

    updateParamsPanel() {
        const paramsEditor = document.getElementById('paramsEditor');
        if (!paramsEditor) return;

        paramsEditor.innerHTML = this.currentRequest.params.map((param, index) => `
            <div class="header-row">
                <input type="text" placeholder="Key" value="${this.escapeHtml(param.key)}"
                       data-index="${index}" data-field="key" class="param-key-input">
                <input type="text" placeholder="Value" value="${this.escapeHtml(param.value)}"
                       data-index="${index}" data-field="value" class="param-value-input">
                <button class="param-delete-btn" data-index="${index}" title="Remove">✕</button>
            </div>
        `).join('');

        paramsEditor.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                this.currentRequest.params[index][field] = e.target.value;

                if (!this._syncingFromUrl) {
                    this._syncingFromParams = true;
                    this.syncUrlFromParams();
                    this._syncingFromParams = false;
                }
            });
        });

        paramsEditor.querySelectorAll('.param-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.currentRequest.params.splice(index, 1);
                if (!this.currentRequest.params.length) {
                    this.currentRequest.params = [{ key: '', value: '' }];
                }
                this.updateParamsPanel();
                this.syncUrlFromParams();
            });
        });
    }

    attachEventListeners() {
        // Send button
        const sendBtn = document.getElementById('sendButton');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendRequest());
        }

        // Save button
        const saveBtn = document.getElementById('saveButton');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.openSaveModal());
        }

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Method select - update color on change
        const methodSelect = document.getElementById('methodSelect');
        if (methodSelect) {
            methodSelect.addEventListener('change', () => {
                methodSelect.setAttribute('data-method', methodSelect.value);
            });
        }

        // Repeat count — re-render variant table
        const repeatCountInput = document.getElementById('repeatCount');
        if (repeatCountInput) {
            repeatCountInput.addEventListener('input', () => this.renderVariantTable());
        }

        // Stepper buttons for repeatCount
        document.getElementById('repeatDecBtn')?.addEventListener('click', () => {
            const inp = document.getElementById('repeatCount');
            const val = parseInt(inp.value) || 1;
            inp.value = Math.max(1, val - 1);
            inp.dispatchEvent(new Event('input'));
        });
        document.getElementById('repeatIncBtn')?.addEventListener('click', () => {
            const inp = document.getElementById('repeatCount');
            inp.value = (parseInt(inp.value) || 1) + 1;
            inp.dispatchEvent(new Event('input'));
        });

        // Stepper buttons for delayMs
        document.getElementById('delayDecBtn')?.addEventListener('click', () => {
            const inp = document.getElementById('delayMs');
            inp.value = Math.max(0, (parseInt(inp.value) || 0) - 100);
        });
        document.getElementById('delayIncBtn')?.addEventListener('click', () => {
            const inp = document.getElementById('delayMs');
            inp.value = (parseInt(inp.value) || 0) + 100;
        });

        // Cmd+Enter to send request
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                this.sendRequest();
            }
        });

        // URL input - detect cURL paste and sync query params
        const urlInput = document.getElementById('urlInput');
        if (urlInput) {
            urlInput.addEventListener('paste', async (e) => {
                setTimeout(async () => {
                    const value = urlInput.value.trim();
                    if (value.startsWith('curl ')) {
                        await this.parseCurlCommand(value);
                    }
                }, 10);
            });

            urlInput.addEventListener('input', () => {
                const value = urlInput.value.trim();
                if (value.startsWith('curl ')) return;

                if (!this._syncingFromParams) {
                    this._syncingFromUrl = true;
                    this.parseUrlParams();
                    this._syncingFromUrl = false;
                }
            });
        }
    }

    openSaveModal() {
        // Collect current request data
        const method = document.getElementById('methodSelect').value;
        const fullUrl = document.getElementById('urlInput').value.trim();
        const body = document.getElementById('bodyEditor')?.value || '';

        if (!fullUrl) {
            alert('Please enter a URL before saving');
            return;
        }

        // Strip query params from URL (they're stored via the params object)
        const qIdx = fullUrl.indexOf('?');
        const url = qIdx !== -1 ? fullUrl.substring(0, qIdx) : fullUrl;

        // Build headers object
        const headers = {};
        this.currentRequest.headers.forEach(h => {
            if (h.key && h.value) {
                headers[h.key] = h.value;
            }
        });

        // Always re-parse params from the live URL so direct URL-bar edits are captured
        const params = {};
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
            this.currentRequest.params.forEach(p => {
                if (p.key) params[p.key] = p.value;
            });
        }

        const request = {
            id: this.currentRequest.id || crypto.randomUUID(),
            name: this.currentRequest.name || window.appState.activeRequest?.name || 'Untitled Request',
            method,
            url,
            headers,
            body: body || null,
            params
        };

        window.saveRequestModal.show(request);
    }

    attachTabContentListeners() {
        // Headers input listeners
        const headersEditor = document.getElementById('headersEditor');
        if (headersEditor) {
            headersEditor.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    const field = e.target.dataset.field;
                    this.currentRequest.headers[index][field] = e.target.value;
                });
            });
        }

        // Params input listeners (with URL sync)
        const paramsEditor = document.getElementById('paramsEditor');
        if (paramsEditor) {
            paramsEditor.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    const field = e.target.dataset.field;
                    this.currentRequest.params[index][field] = e.target.value;

                    if (!this._syncingFromUrl) {
                        this._syncingFromParams = true;
                        this.syncUrlFromParams();
                        this._syncingFromParams = false;
                    }
                });
            });

            paramsEditor.querySelectorAll('.param-delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.index);
                    this.currentRequest.params.splice(index, 1);
                    if (!this.currentRequest.params.length) {
                        this.currentRequest.params = [{ key: '', value: '' }];
                    }
                    this.updateParamsPanel();
                    this.syncUrlFromParams();
                });
            });
        }

        // Body editor listener + live highlight
        const bodyEditor = document.getElementById('bodyEditor');
        if (bodyEditor) {
            bodyEditor.addEventListener('input', (e) => {
                this.currentRequest.body = e.target.value;
                this.updateBodyHighlight();
                this.renderVariantTable();
            });
            bodyEditor.addEventListener('scroll', () => {
                const pre = document.getElementById('bodyHighlight');
                if (pre) pre.scrollTop = bodyEditor.scrollTop;
            });
            this.updateBodyHighlight();
        }

        // Add header button
        const addHeaderBtn = document.getElementById('addHeader');
        if (addHeaderBtn) {
            addHeaderBtn.addEventListener('click', () => {
                this.currentRequest.headers.push({ key: '', value: '' });
                this.renderAllTabs();
            });
        }

        // Add param button
        const addParamBtn = document.getElementById('addParam');
        if (addParamBtn) {
            addParamBtn.addEventListener('click', () => {
                this.currentRequest.params.push({ key: '', value: '' });
                this.renderAllTabs();
            });
        }

        // Body type pill buttons
        const bodyTypeGroup = document.getElementById('bodyTypeGroup');
        if (bodyTypeGroup) {
            bodyTypeGroup.addEventListener('click', (e) => {
                const btn = e.target.closest('.format-type-btn');
                if (!btn) return;
                bodyTypeGroup.querySelectorAll('.format-type-btn')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        }

        // Prettify/Minify buttons
        const prettifyBtn = document.getElementById('prettifyBtn');
        if (prettifyBtn) {
            prettifyBtn.addEventListener('click', () => this.prettifyBody());
        }

        const minifyBtn = document.getElementById('minifyBtn');
        if (minifyBtn) {
            minifyBtn.addEventListener('click', () => this.minifyBody());
        }
    }

    switchTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        // Add active to selected
        const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedPanel = document.getElementById(`${tabName}-panel`);

        if (selectedTab) selectedTab.classList.add('active');
        if (selectedPanel) selectedPanel.classList.add('active');
    }

    async parseCurlCommand(curlCommand) {
        try {
            const request = await window.api.parseCurl(curlCommand);
            this.loadRequest(request);
            alert('cURL command parsed successfully!');
        } catch (error) {
            alert('Failed to parse cURL command: ' + error);
        }
    }

    loadRequest(request) {
        this.currentRequest = {
            id: request.id,
            name: request.name,
            method: request.method,
            url: request.url,
            headers: Object.entries(request.headers || {}).map(([key, value]) => ({ key, value })),
            body: request.body || '',
            params: Object.entries(request.params || {}).map(([key, value]) => ({ key, value }))
        };

        // Ensure at least one empty row
        if (!this.currentRequest.headers.length) {
            this.currentRequest.headers = [{ key: '', value: '' }];
        }
        if (!this.currentRequest.params.length) {
            this.currentRequest.params = [{ key: '', value: '' }];
        }

        // Render tabs first (which will use currentRequest.body)
        this.renderAllTabs();

        // Then update URL bar fields
        const methodSelect = document.getElementById('methodSelect');
        const urlInput = document.getElementById('urlInput');

        if (methodSelect) {
            methodSelect.value = request.method;
            methodSelect.setAttribute('data-method', request.method);
        }
        if (urlInput) {
            // Build full URL with query params for display
            const paramPairs = this.currentRequest.params
                .filter(p => p.key)
                .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);
            urlInput.value = paramPairs.length > 0
                ? `${request.url}?${paramPairs.join('&')}`
                : request.url;
        }

        // Body is already set by renderAllTabs() from currentRequest.body

        this.fieldStrategies = {};
        this.renderVariantTable();
    }

    async sendRequest() {
        // Collect all form data
        const method = document.getElementById('methodSelect').value;
        const fullUrl = document.getElementById('urlInput').value.trim();
        const body = document.getElementById('bodyEditor')?.value || '';
        const repeatCount = parseInt(document.getElementById('repeatCount').value);
        const delayMs = parseInt(document.getElementById('delayMs').value);

        if (!fullUrl) {
            alert('Please enter a URL');
            return;
        }

        // Strip query params from URL (they're sent via the params object)
        const qIdx = fullUrl.indexOf('?');
        const url = qIdx !== -1 ? fullUrl.substring(0, qIdx) : fullUrl;

        // Build headers object
        const headers = {};
        this.currentRequest.headers.forEach(h => {
            if (h.key && h.value) {
                headers[h.key] = h.value;
            }
        });

        // Build params object
        const params = {};
        this.currentRequest.params.forEach(p => {
            if (p.key) {
                params[p.key] = p.value;
            }
        });

        const request = {
            id: crypto.randomUUID(),
            name: 'Untitled Request',
            method,
            url,
            headers,
            body: body || null,
            params
        };

        try {
            // Show loading state
            const sendBtn = document.getElementById('sendButton');
            sendBtn.textContent = 'Sending...';
            sendBtn.disabled = true;

            if (repeatCount > 1) {
                const bodyVariants = this.generateBodyVariants(body || '', repeatCount);
                const requests = bodyVariants.map(variantBody => ({
                    ...request,
                    id: crypto.randomUUID(),
                    body: variantBody || null
                }));
                const responses = await window.api.sendMultipleRequests(requests, delayMs);
                window.appState.setMultipleResponses(responses);
            } else {
                const response = await window.api.sendRequest(request);
                window.appState.setLastResponse(response);
            }

            // Reset button
            sendBtn.textContent = 'Send';
            sendBtn.disabled = false;
        } catch (error) {
            alert('Request failed: ' + error);
            const sendBtn = document.getElementById('sendButton');
            sendBtn.textContent = 'Send';
            sendBtn.disabled = false;
        }
    }

    renderVariantTable() {
        const container = document.getElementById('variantTableContainer');
        if (!container) return;

        const repeatCount = parseInt(document.getElementById('repeatCount')?.value || '1');
        const body = document.getElementById('bodyEditor')?.value || '';

        // Only show when repeat > 1 and body is valid JSON
        if (repeatCount <= 1 || !body.trim()) {
            container.innerHTML = '';
            return;
        }

        let parsed;
        try {
            parsed = JSON.parse(body);
        } catch {
            container.innerHTML = '';
            return;
        }

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            container.innerHTML = '';
            return;
        }

        const fields = Object.entries(parsed);
        if (fields.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Clean up strategies for fields that no longer exist
        const currentKeys = new Set(fields.map(([k]) => k));
        for (const key of Object.keys(this.fieldStrategies)) {
            if (!currentKeys.has(key)) delete this.fieldStrategies[key];
        }

        const rows = fields.map(([key, value]) => {
            const type = typeof value;
            const displayValue = JSON.stringify(value);
            const strategy = this.fieldStrategies[key] || 'keep';

            const activeClass = strategy !== 'keep' ? ' strategy-active' : '';

            if (type === 'string') {
                return `<tr>
                    <td>${this.escapeHtml(key)}</td>
                    <td>${this.escapeHtml(displayValue)}</td>
                    <td>
                        <select class="variant-strategy-select${activeClass}" data-field="${this.escapeHtml(key)}">
                            <option value="keep"${strategy === 'keep' ? ' selected' : ''}>Keep same</option>
                            <option value="auto_generate"${strategy === 'auto_generate' ? ' selected' : ''}>Auto generate</option>
                        </select>
                    </td>
                </tr>`;
            } else if (type === 'number') {
                return `<tr>
                    <td>${this.escapeHtml(key)}</td>
                    <td>${this.escapeHtml(displayValue)}</td>
                    <td>
                        <select class="variant-strategy-select${activeClass}" data-field="${this.escapeHtml(key)}">
                            <option value="keep"${strategy === 'keep' ? ' selected' : ''}>Keep same</option>
                            <option value="auto_increment"${strategy === 'auto_increment' ? ' selected' : ''}>Auto increment</option>
                        </select>
                    </td>
                </tr>`;
            } else {
                return `<tr>
                    <td>${this.escapeHtml(key)}</td>
                    <td>${this.escapeHtml(displayValue)}</td>
                    <td>
                        <select class="variant-strategy-select" disabled>
                            <option value="keep">Keep same</option>
                        </select>
                    </td>
                </tr>`;
            }
        }).join('');

        container.innerHTML = `
            <div class="variant-table-container">
                <h4>Body Variants</h4>
                <table class="variant-table">
                    <thead>
                        <tr>
                            <th>Field</th>
                            <th>Value</th>
                            <th>Modification</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        // Attach change listeners to strategy selects
        container.querySelectorAll('.variant-strategy-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.fieldStrategies[e.target.dataset.field] = e.target.value;
                e.target.classList.toggle('strategy-active', e.target.value !== 'keep');
            });
        });
    }

    escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    generateBodyVariants(body, count) {
        let parsed;
        try {
            parsed = JSON.parse(body);
        } catch {
            // Not valid JSON — return the same body for all requests
            return Array(count).fill(body);
        }

        const variants = [];
        for (let i = 0; i < count; i++) {
            const variant = { ...parsed };
            for (const [key, strategy] of Object.entries(this.fieldStrategies)) {
                if (strategy === 'auto_generate' && typeof variant[key] === 'string') {
                    variant[key] = `${parsed[key]}_${i + 1}`;
                } else if (strategy === 'auto_increment' && typeof variant[key] === 'number') {
                    variant[key] = parsed[key] + i;
                }
            }
            variants.push(JSON.stringify(variant));
        }
        return variants;
    }

    prettifyBody() {
        const bodyEditor = document.getElementById('bodyEditor');
        if (!bodyEditor) return;

        try {
            const json = JSON.parse(bodyEditor.value);
            bodyEditor.value = JSON.stringify(json, null, 2);
            this.currentRequest.body = bodyEditor.value;
            this.updateBodyHighlight();
        } catch (e) {
            alert('Invalid JSON');
        }
    }

    minifyBody() {
        const bodyEditor = document.getElementById('bodyEditor');
        if (!bodyEditor) return;

        try {
            const json = JSON.parse(bodyEditor.value);
            bodyEditor.value = JSON.stringify(json);
            this.currentRequest.body = bodyEditor.value;
            this.updateBodyHighlight();
        } catch (e) {
            alert('Invalid JSON');
        }
    }

    updateBodyHighlight() {
        const bodyEditor = document.getElementById('bodyEditor');
        const bodyHighlight = document.getElementById('bodyHighlight');
        if (!bodyEditor || !bodyHighlight) return;

        const text = bodyEditor.value;
        // Trailing newline ensures the last empty line in the textarea is reflected
        bodyHighlight.innerHTML = this.syntaxHighlight(text) + '\n';
        bodyHighlight.scrollTop = bodyEditor.scrollTop;
    }

    syntaxHighlight(text) {
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return escaped.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
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

    resetRequest() {
        this.currentRequest = {
            method: 'GET',
            url: '',
            headers: [{ key: '', value: '' }],
            body: '',
            params: [{ key: '', value: '' }]
        };
        this.renderAllTabs();
        const methodSelect = document.getElementById('methodSelect');
        const urlInput = document.getElementById('urlInput');
        if (methodSelect) { methodSelect.value = 'GET'; methodSelect.setAttribute('data-method', 'GET'); }
        if (urlInput) { urlInput.value = ''; urlInput.focus(); }
        this.fieldStrategies = {};
        this.renderVariantTable();
    }
}

// Initialize
window.requestBuilder = new RequestBuilder();
