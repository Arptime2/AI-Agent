class ChatApp {
  constructor() {
    this.messages = [];
    this.conversations = [];
    this.currentConversationId = null;
    this.isGenerating = false;
    this.abortController = null;
    this.notificationPollInterval = null;
    this.tools = [];
    this.pendingToolCall = null;
    this.systemPrompt = '';
    this.continuePrompt = 'Continue? Reply with just "yes" or "no".';

    this.messagesContainer = document.getElementById('messages');
    this.userInput = document.getElementById('userInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.typingIndicator = document.getElementById('typingIndicator');
    this.chatHistory = document.getElementById('chatHistory');
    this.newChatBtn = document.getElementById('newChat');
    this.modelNameEl = document.getElementById('modelName');
    this.toolsList = document.getElementById('toolsList');

    this.modal = document.getElementById('confirm-modal');
    this.confirmToolName = document.getElementById('confirm-tool-name');
    this.confirmToolAction = document.getElementById('confirm-tool-action');
    this.confirmToolParams = document.getElementById('confirm-tool-params');
    this.confirmDeny = document.getElementById('confirm-deny');
    this.confirmAllow = document.getElementById('confirm-allow');

    this.init();
  }

  async init() {
    await this.loadSystemPrompt();
    await this.loadContinuePrompt();
    this.loadFromStorage();
    this.setupEventListeners();
    this.fetchModelInfo();
    this.renderMessages();
    this.renderChatHistory();
    this.autoResizeTextarea();
    await this.loadToolsFromServer();
    this.setupModalListeners();
    this.startNotificationPolling();
  }

  async loadToolsFromServer() {
    try {
      const response = await fetch('/api/tools');
      if (response.ok) {
        const serverTools = await response.json();
        const enabledMap = this.getEnabledTools();
        this.tools = serverTools.map(t => ({
          ...t,
          enabled: enabledMap[t.name.toLowerCase()] !== false,
          requireConfirm: this.getToolConfirm(t.name)
        }));
        this.renderTools();
        this.saveTools();
      }
    } catch (e) {
      console.error('Failed to load tools from server:', e);
    }
  }

  getEnabledTools() {
    try {
      const saved = localStorage.getItem('lmstudio-chat-tools-enabled');
      if (!saved) return {};
      const map = JSON.parse(saved);
      const normalized = {};
      for (const [key, value] of Object.entries(map)) {
        normalized[key.toLowerCase()] = value;
      }
      return normalized;
    } catch (e) {
      return {};
    }
  }

  setToolEnabled(name, enabled) {
    const map = this.getEnabledTools();
    map[name.toLowerCase()] = enabled;
    localStorage.setItem('lmstudio-chat-tools-enabled', JSON.stringify(map));
  }

  setupModalListeners() {
    this.confirmDeny.addEventListener('click', () => this.denyTool());
    this.confirmAllow.addEventListener('click', () => this.confirmTool());
  }

  showConfirmModal(toolName, action, params) {
    this.confirmToolName.textContent = toolName;
    this.confirmToolAction.textContent = action;
    this.confirmToolParams.textContent = JSON.stringify(params, null, 2);
    this.modal.style.display = 'flex';
  }

  hideConfirmModal() {
    this.modal.style.display = 'none';
    this.pendingToolCall = null;
  }

  confirmTool() {
    const pendingCall = this.pendingToolCall;
    this.hideConfirmModal();
    if (pendingCall) {
      this.executeConfirmedTool(pendingCall);
    }
  }

  denyTool() {
    const pendingCall = this.pendingToolCall;
    this.hideConfirmModal();
    if (pendingCall) {
      const { toolName, callNumber } = pendingCall;
      this.addMessage('tool-result', `Execution denied by user`, { toolName, callNumber });
      this.isGenerating = false;
      this.hideTypingIndicator();
      this.updateButtons();
    }
  }

  async checkNotifications() {
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      if (data.notifications && data.notifications.length > 0) {
        for (const n of data.notifications) {
          this.addMessage('tool-result', n.message, {
            toolName: n.toolName,
            callNumber: Date.now()
          });
        }
        await this.getAIResponse();
      }
    } catch (e) {}
  }

  startNotificationPolling() {
    this.notificationPollInterval = setInterval(async () => {
      await this.checkNotifications();
    }, 15000);
  }

  async loadContinuePrompt() {
    try {
      const response = await fetch('/api/continue-prompt');
      const data = await response.json();
      this.continuePrompt = data.continuePrompt || this.continuePrompt;
    } catch (e) {
      console.error('Failed to load continue prompt:', e);
    }
  }

  async loadSystemPrompt() {
    try {
      const response = await fetch('/api/system-prompt');
      const data = await response.json();
      this.systemPrompt = data.systemPrompt;
    } catch (e) {
      console.error('Failed to load system prompt:', e);
    }
  }

  setupEventListeners() {
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.stopBtn.addEventListener('click', () => this.stopGeneration());
    this.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.newChatBtn.addEventListener('click', () => this.newChat());
  }

  removeTool(port) {
    this.tools = this.tools.filter(t => t.port !== port);
    this.saveTools();
    this.renderTools();
  }

  toggleTool(port) {
    const tool = this.tools.find(t => t.port === port);
    if (tool) {
      tool.enabled = !tool.enabled;
      this.setToolEnabled(tool.name, tool.enabled);
      this.renderTools();
      this.saveTools();
    }
  }

  toggleToolConfirm(port) {
    const tool = this.tools.find(t => t.port === port);
    if (tool) {
      tool.requireConfirm = !tool.requireConfirm;
      this.setToolConfirm(tool.name, tool.requireConfirm);
      this.renderTools();
      this.saveTools();
    }
  }

  setToolConfirm(name, requireConfirm) {
    const map = this.getEnabledTools();
    const key = name.toLowerCase() + '_confirm';
    map[key] = requireConfirm;
    localStorage.setItem('lmstudio-chat-tools-enabled', JSON.stringify(map));
  }

  getToolConfirm(name) {
    const map = this.getEnabledTools();
    const key = name.toLowerCase() + '_confirm';
    return map[key] === true;
  }

  saveTools() {
    localStorage.setItem('lmstudio-chat-tools', JSON.stringify(this.tools));
  }

  loadTools() {
    try {
      const saved = localStorage.getItem('lmstudio-chat-tools');
      if (saved) this.tools = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load tools:', e);
    }
  }

  autoResizeTextarea() {
    this.userInput.addEventListener('input', () => {
      this.userInput.style.height = 'auto';
      this.userInput.style.height = Math.min(this.userInput.scrollHeight, 200) + 'px';
    });
  }

  async fetchModelInfo() {
    try {
      const response = await fetch('/api/models');
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          this.modelNameEl.textContent = data.data[0].id;
        } else {
          this.modelNameEl.textContent = 'No model loaded';
        }
      } else {
        this.modelNameEl.textContent = 'LM Studio';
      }
    } catch (error) {
      this.modelNameEl.textContent = 'LM Studio';
    }
  }

  async sendMessage() {
    const content = this.userInput.value.trim();
    if (!content || this.isGenerating) return;
    this.addMessage('user', content);
    this.userInput.value = '';
    this.userInput.style.height = 'auto';
    await this.getAIResponse();
  }

  async getAIResponse() {
    this.showTypingIndicator();
    this.isGenerating = true;
    this.updateButtons();

    try {
      const conversation = this.getConversationMessages();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      this.abortController = controller;

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...conversation
          ],
          max_tokens: 8000
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      this.abortController = null;

      if (!response.ok) throw new Error('AI request failed');

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';

      this.hideTypingIndicator();
      this.addMessage('assistant', content);

      const toolCall = this.parseToolCall(content);
      if (toolCall) {
        await this.executeToolCall(toolCall.name, toolCall.params);
      } else {
        this.isGenerating = false;
        this.updateButtons();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        const isTimeout = error.message && error.message.includes('timeout');
        if (isTimeout) {
          this.hideTypingIndicator();
          this.addMessage('assistant', 'Request timed out. Please try again.');
        }
        console.log('Generation stopped by user or timeout');
      } else {
        console.error('Error in getAIResponse:', error);
      }
      this.isGenerating = false;
      this.abortController = null;
      this.updateButtons();
    }
  }

  parseToolCall(content) {
    const start = content.indexOf('{');
    if (start === -1) return null;

    for (let i = start + 1; i <= content.length; i++) {
      const candidate = content.substring(start, i);
      try {
        const json = JSON.parse(candidate);
        if (json.tool && json.params && typeof json.params === 'object') {
          console.log('Tool call detected:', json.tool, json.params);
          return { name: json.tool, params: json.params };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  async executeToolCall(toolName, params) {
    const callNumber = Date.now();
    this.addMessage('tool-call', '', { toolName, toolArgs: params, callNumber });
    this.showTypingIndicator();

    try {
      const tool = await this.findTool(toolName);
      console.log('Executing tool:', toolName, 'params:', params, 'found:', !!tool);

      if (!tool) {
        this.hideTypingIndicator();
        this.addMessage('tool-result', `Error: Tool "${toolName}" not found`, { toolName, callNumber });
        await this.getAIResponse();
        return;
      }

      if (!tool.enabled) {
        this.hideTypingIndicator();
        this.addMessage('tool-result', `Error: Tool "${toolName}" is disabled`, { toolName, callNumber });
        await this.getAIResponse();
        return;
      }

      this.pendingToolCall = { toolName, params, callNumber };
      if (!tool.requireConfirm) {
        this.confirmTool();
      } else {
        const action = Object.keys(params)[0] || 'unknown';
        this.showConfirmModal(toolName, action, params);
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.addMessage('tool-result', `Error: ${error.message}`, { toolName, callNumber });
      await this.getAIResponse();
    }
  }

  async executeConfirmedTool(pendingCall) {
    const { toolName, params, callNumber } = pendingCall;

    try {
      const tool = await this.findTool(toolName);
      if (!tool) {
        this.hideTypingIndicator();
        this.addMessage('tool-result', `Error: Tool "${toolName}" not found`, { toolName, callNumber });
        await this.getAIResponse();
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      this.abortController = controller;

      const response = await fetch('/api/tool-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, port: tool.port, params }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      this.abortController = null;

      const result = await response.json();
      const { raw, ...resultData } = result;
      
      // Extract the actual content for display
      let content;
      if (resultData.result !== undefined) {
        content = resultData.result;
      } else {
        content = JSON.stringify(resultData, null, 2);
      }
      
      console.log('Tool result:', content);

      this.hideTypingIndicator();
      this.addMessage('tool-result', content, { toolName, callNumber, raw });
      this.messages.push({ role: 'tool', content, tool_name: toolName });

      await this.getAIResponse();
    } catch (error) {
      this.hideTypingIndicator();
      this.abortController = null;

      if (error.name === 'AbortError') {
        const isTimeout = error.message && error.message.includes('timeout');
        console.log(isTimeout ? 'Tool execution timed out' : 'Tool execution stopped by user');
        this.addMessage('tool-result', isTimeout ? 'Tool call timed out' : 'Stopped by user', { toolName, callNumber });
        this.isGenerating = false;
        this.updateButtons();
      } else {
        console.error('Tool execution error:', error);
        this.addMessage('tool-result', `Error: ${error.message}`, { toolName, callNumber });
        await this.getAIResponse();
      }
    }
  }

  async askContinue() {
    this.showTypingIndicator();

    try {
      const conversation = this.getConversationMessages();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      this.abortController = controller;

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...conversation,
            { role: 'user', content: this.continuePrompt }
          ],
          max_tokens: 10
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      this.abortController = null;

      if (!response.ok) throw new Error('Continue check failed');

      const data = await response.json();
      const content = (data.choices?.[0]?.message?.content || '').toLowerCase().trim();

      this.hideTypingIndicator();

      if (content.includes('yes')) {
        await this.getAIResponse();
      } else {
        this.isGenerating = false;
        this.updateButtons();
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        const isTimeout = error.message && error.message.includes('timeout');
        console.log(isTimeout ? 'Continue check timed out' : 'Continue check stopped by user');
      } else {
        console.error('Error in askContinue:', error);
      }
      this.hideTypingIndicator();
      this.abortController = null;
      this.isGenerating = false;
      this.updateButtons();
    }
  }

  getConversationMessages() {
    return this.messages.map(m => {
      let content = m.content;
      if (typeof content !== 'string') {
        try {
          content = JSON.stringify(content);
        } catch (e) {
          content = String(content);
        }
      }
      if (m.role === 'user') return { role: 'user', content };
      if (m.role === 'assistant') return { role: 'assistant', content };
      if (m.role === 'tool-call') return { role: 'user', content: `[Tool Call: ${m.toolName}]` };
      if (m.role === 'tool-result') {
        return { role: 'user', content: `[Tool Result: ${m.toolName}]: ${content}` };
      }
      return { role: 'user', content };
    });
  }

  async findTool(toolName) {
    const name = toolName.toLowerCase();
    return this.tools.find(t =>
      t.name.toLowerCase() === name ||
      t.name.toLowerCase().replace(/\s+/g, '') === name.replace(/\s+/g, '') ||
      t.name.toLowerCase().includes(name) ||
      name.includes(t.name.toLowerCase().replace(/\s/g, '')) ||
      t.name.split(' ')[0].toLowerCase() === name
    );
  }

  addMessage(role, content, extra = {}) {
    const message = {
      id: Date.now(),
      role,
      content,
      timestamp: new Date().toISOString(),
      ...extra
    };
    this.messages.push(message);
    this.renderMessage(message);
    this.saveToStorage();
  }

  renderMessage(message) {
    const div = document.createElement('div');
    div.className = `message ${message.role}`;
    div.dataset.id = message.id;

    let avatar = 'AI';
    let contentHtml;
    const toolName = message.toolName || message.tool_name || 'Unknown';

    if (message.role === 'user') {
      avatar = 'U';
      contentHtml = this.formatMessage(message.content);
    } else if (message.role === 'assistant') {
      contentHtml = this.formatMessage(message.content);
    } else if (message.role === 'tool-call') {
      div.classList.add('tool-call');
      avatar = 'T';
      const callNumber = message.callNumber ? ` ${this.formatTimestamp(message.callNumber)}` : '';
      const argsStr = JSON.stringify(message.toolArgs || message.tool_args || {}, null, 2);
      contentHtml = `<div class="tool-call-header"><span class="tool-name">${this.escapeHtml(toolName)}${callNumber}</span></div><pre class="tool-args"><code>${this.escapeHtml(argsStr)}</code></pre>`;
    } else if (message.role === 'tool-result') {
      div.classList.add('tool-result');
      avatar = 'R';
      const callNumber = message.callNumber ? ` ${this.formatTimestamp(message.callNumber)}` : '';
      let content;
      if (typeof message.content === 'string') {
        content = message.content;
      } else {
        content = JSON.stringify(message.content, null, 2);
      }
      contentHtml = `<div class="tool-result-header"><span class="tool-name">${this.escapeHtml(toolName)}${callNumber}</span></div><pre class="tool-result-content"><code>${this.escapeHtml(content)}</code></pre>`;
    }

    div.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content">${contentHtml}</div>`;
    this.messagesContainer.appendChild(div);
    this.scrollToBottom();
  }

  formatMessage(content) {
    return this.parseMarkdown(content);
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  parseMarkdown(text) {
    // Check if content is primarily HTML/code
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(text);
    const hasCodeKeywords = /function|class |import |export |const |let |var |=>|{|}|console\./.test(text);
    
    if (hasHtmlTags || (hasCodeKeywords && text.length > 100)) {
      // Wrap code/HTML in code block for display
      const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code>${escaped}</code></pre>`.replace(/\n/g, '<br>');
    }
    
    let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => `<pre><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>`);
    html = html.replace(/```([^`]+)```/g, (match, code) => `<code>${this.escapeHtml(code.trim())}</code>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*?]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*?]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  showTypingIndicator() {
    this.typingIndicator.classList.add('visible');
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    this.typingIndicator.classList.remove('visible');
  }

  updateButtons() {
    this.sendBtn.style.display = this.isGenerating ? 'none' : 'flex';
    this.stopBtn.style.display = this.isGenerating ? 'flex' : 'none';
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isGenerating = false;
    this.hideTypingIndicator();
    this.updateButtons();
  }

  newChat() {
    this.messages = [];
    this.messagesContainer.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><h2>How can I help you?</h2><p>Start a conversation with your LM Studio model</p></div>`;
    this.saveToStorage();
  }

  renderMessages() {
    if (this.messages.length === 0) {
      this.messagesContainer.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><h2>How can I help you?</h2><p>Start a conversation with your LM Studio model</p></div>`;
      return;
    }
    this.messagesContainer.innerHTML = '';
    this.messages.forEach(msg => this.renderMessage(msg));
  }

  renderChatHistory() {
    this.chatHistory.innerHTML = '';
    if (this.conversations.length === 0) {
      this.chatHistory.innerHTML = '<p style="padding: 12px; color: var(--text-muted); font-size: 13px;">No previous conversations</p>';
      return;
    }
    this.conversations.slice().reverse().forEach(conv => {
      const div = document.createElement('div');
      div.className = 'chat-history-item';
      div.textContent = conv.preview || 'New Chat';
      div.addEventListener('click', () => this.loadConversation(conv.id));
      this.chatHistory.appendChild(div);
    });
  }

  renderTools() {
    this.toolsList.innerHTML = '';
    if (this.tools.length === 0) {
      this.toolsList.innerHTML = '<p style="padding: 12px; color: var(--text-muted); font-size: 13px;">No tools available</p>';
      return;
    }
      this.tools.forEach(tool => {
      const div = document.createElement('div');
      div.className = 'tool-item';
      const enabledClass = tool.enabled ? 'enabled' : 'disabled';
      const confirmClass = tool.requireConfirm ? 'enabled' : 'disabled';
      const enabledIcon = tool.enabled ? '✓' : '';
      const confirmIcon = tool.requireConfirm ? '⚠' : '';
      div.innerHTML = `
        <div class="tool-info">
          <span class="tool-name">${this.escapeHtml(tool.name)}</span>
        </div>
        <button class="tool-btn ${enabledClass}" data-port="${tool.port}" data-action="toggle">${enabledIcon}</button>
        <button class="tool-btn confirm-btn ${confirmClass}" data-port="${tool.port}" data-action="confirm">${confirmIcon}</button>
        <span class="tool-port">:${tool.port}</span>
      `;
      div.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const port = parseInt(btn.dataset.port);
          const action = btn.dataset.action;
          if (action === 'toggle') this.toggleTool(port);
          else if (action === 'confirm') this.toggleToolConfirm(port);
        });
      });
      this.toolsList.appendChild(div);
    });
  }

  loadConversation(id) {
    const conv = this.conversations.find(c => c.id === id);
    if (conv) {
      this.messages = conv.messages || [];
      this.renderMessages();
    }
  }

  saveToStorage() {
    const conversation = {
      id: this.currentConversationId || Date.now(),
      messages: [...this.messages],
      preview: this.getConversationPreview(),
      updatedAt: new Date().toISOString()
    };
    if (!this.currentConversationId) {
      this.currentConversationId = conversation.id;
      this.conversations.push(conversation);
    } else {
      const index = this.conversations.findIndex(c => c.id === this.currentConversationId);
      if (index !== -1) this.conversations[index] = conversation;
    }
    this.conversations = this.conversations.slice(-5);
    localStorage.setItem('lmstudio-chat-conversations', JSON.stringify(this.conversations));
    this.renderChatHistory();
  }

  getConversationPreview() {
    for (const msg of this.messages) {
      if (msg.role === 'user' && msg.content) return msg.content.slice(0, 30);
      if (msg.role === 'assistant' && msg.content) return msg.content.slice(0, 30);
    }
    return 'New Chat';
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('lmstudio-chat-conversations');
      if (saved) this.conversations = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
    this.loadTools();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
