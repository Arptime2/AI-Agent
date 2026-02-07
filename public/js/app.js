class ChatApp {
  constructor() {
    this.messages = [];
    this.conversations = [];
    this.currentConversationId = null;
    this.isGenerating = false;
    this.abortController = null;
    this.notificationPollInterval = null;
    this.tools = [];
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
    this.toolPortInput = document.getElementById('toolPort');
    this.addToolBtn = document.getElementById('addToolBtn');
    this.toolsList = document.getElementById('toolsList');

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
    this.renderTools();
    this.autoResizeTextarea();
    this.testAllTools();
    this.startNotificationPolling();
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
    this.addToolBtn.addEventListener('click', () => this.addTool());
    this.toolPortInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addTool();
    });
  }

  async addTool() {
    const port = this.toolPortInput.value.trim();
    if (!port) return;
    const toolName = await this.detectToolName(port);
    const existingTool = this.tools.find(t => t.port === port);
    if (existingTool) {
      existingTool.name = toolName || existingTool.name;
    } else {
      this.tools.push({ port, name: toolName || `Tool :${port}`, active: false });
    }
    this.toolPortInput.value = '';
    this.saveTools();
    await this.renderTools();
    this.testAllTools();

    try {
      await fetch('/api/register-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName || `Tool :${port}`, port })
      });
    } catch (e) {
      console.error('Failed to register tool on server:', e);
    }
  }

  async detectToolName(port) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        const data = await response.json();
        return data.tool || data.name || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  removeTool(port) {
    this.tools = this.tools.filter(t => t.port !== port);
    this.saveTools();
    this.renderTools();
  }

  async testTool(tool) {
    try {
      const response = await fetch(`http://localhost:${tool.port}/health`);
      if (response.ok) {
        tool.active = true;
        const data = await response.json();
        if (data.tool && data.tool !== tool.name) {
          tool.name = data.tool;
        }
      } else {
        tool.active = false;
      }
    } catch (e) {
      tool.active = false;
    }
    return tool;
  }

  async testAllTools() {
    for (const tool of this.tools) {
      await this.testTool(tool);
    }
    this.renderTools();
    this.saveTools();
  }

  renderTools() {
    this.toolsList.innerHTML = '';
    if (this.tools.length === 0) {
      this.toolsList.innerHTML = '<p style="padding: 12px; color: var(--text-muted); font-size: 13px;">No tools added</p>';
      return;
    }
    for (const tool of this.tools) {
      const div = document.createElement('div');
      div.className = 'tool-item';
      div.innerHTML = `
        <span class="tool-status ${tool.active ? 'active' : 'inactive'}"></span>
        <div class="tool-info">
          <div class="tool-name">${this.escapeHtml(tool.name)}</div>
          <div class="tool-port">:${tool.port}</div>
        </div>
        <button class="tool-remove" data-port="${tool.port}">✕</button>
      `;
      div.querySelector('.tool-remove').addEventListener('click', () => this.removeTool(tool.port));
      this.toolsList.appendChild(div);
    }
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

      this.abortController = new AbortController();
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...conversation
          ],
          max_tokens: 1000
        }),
        signal: this.abortController.signal
      });
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
        console.log('Generation stopped by user');
      } else {
        console.error('Error in getAIResponse:', error);
      }
      this.isGenerating = false;
      this.abortController = null;
      this.updateButtons();
    }
  }

  parseToolCall(content) {
    const jsonMatch = content.match(/\{"tool"\s*:\s*"([^"]+)"\s*,\s*"params"\s*:\s*\{[\s\S]*?\}\}/);
    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[0]);
        if (json.tool && json.params) {
          console.log('Tool call detected:', json.tool, json.params);
          return { name: json.tool, params: json.params };
        }
      } catch (e) {
        console.error('Failed to parse tool JSON:', e);
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

      this.abortController = new AbortController();
      const response = await fetch('/api/tool-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, port: tool.port, params }),
        signal: this.abortController.signal
      });
      this.abortController = null;

      const result = await response.json();
      const resultStr = JSON.stringify(result, null, 2);
      console.log('Tool result:', resultStr);

      this.hideTypingIndicator();
      this.addMessage('tool-result', resultStr, { toolName, callNumber });
      this.messages.push({ role: 'tool', content: resultStr, tool_name: toolName });

      await this.getAIResponse();
    } catch (error) {
      this.hideTypingIndicator();
      this.abortController = null;

      if (error.name === 'AbortError') {
        console.log('Tool execution stopped by user');
        this.addMessage('tool-result', 'Stopped by user', { toolName, callNumber });
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

      this.abortController = new AbortController();
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
        signal: this.abortController.signal
      });
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
        console.log('Continue check stopped by user');
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
      if (m.role === 'user') return { role: 'user', content: m.content };
      if (m.role === 'assistant') return { role: 'assistant', content: m.content };
      if (m.role === 'tool-call') return { role: 'user', content: `[Tool Call: ${m.toolName}]` };
      if (m.role === 'tool-result') return { role: 'user', content: `[Tool Result: ${m.toolName}]: ${m.content}` };
      return { role: 'user', content: m.content };
    });
  }

  async findTool(toolName) {
    try {
      const response = await fetch('/api/tools');
      if (response.ok) {
        const tools = await response.json();
        const name = toolName.toLowerCase();
        return tools.find(t =>
          t.name.toLowerCase() === name ||
          t.name.toLowerCase().replace(/\s+/g, '') === name.replace(/\s+/g, '') ||
          t.name.toLowerCase().includes(name) ||
          name.includes(t.name.toLowerCase().replace(/\s/g, '')) ||
          t.name.split(' ')[0].toLowerCase() === name
        );
      }
    } catch (e) {
      console.error('Failed to fetch tools from server:', e);
    }
    return null;
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
    let contentHtml = this.formatMessage(message.content);
    const toolName = message.toolName || message.tool_name || 'Unknown';

    if (message.role === 'user') {
      avatar = 'U';
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
      contentHtml = `<div class="tool-result-header"><span class="tool-name">${this.escapeHtml(toolName)}${callNumber}</span></div><pre class="tool-result-content"><code>${this.escapeHtml(message.content)}</code></pre>`;
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
