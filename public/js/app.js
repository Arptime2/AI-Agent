class ChatApp {
  constructor() {
    this.messages = [];
    this.conversations = [];
    this.currentConversationId = null;
    this.isGenerating = false;
    this.tools = [];
    this.toolsDocs = '';

    this.messagesContainer = document.getElementById('messages');
    this.userInput = document.getElementById('userInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.typingIndicator = document.getElementById('typingIndicator');
    this.chatHistory = document.getElementById('chatHistory');
    this.newChatBtn = document.getElementById('newChat');
    this.modelNameEl = document.getElementById('modelName');

    this.toolPortInput = document.getElementById('toolPort');
    this.addToolBtn = document.getElementById('addToolBtn');
    this.toolsList = document.getElementById('toolsList');

    this.init();
  }

  init() {
    this.loadFromStorage();
    this.setupEventListeners();
    this.fetchModelInfo();
    this.fetchToolsDocs();
    this.renderMessages();
    this.renderChatHistory();
    this.renderTools();
    this.autoResizeTextarea();
    this.testAllTools();
  }

  setupEventListeners() {
    this.sendBtn.addEventListener('click', () => this.sendMessage());
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

  async fetchToolsDocs() {
    try {
      const response = await fetch('/api/tools-docs');
      if (response.ok) {
        this.toolsDocs = await response.text();
      }
    } catch (e) {
      this.toolsDocs = '';
    }
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

  async renderTools() {
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
        <button class="tool-remove" data-port="${tool.port}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      div.querySelector('.tool-remove').addEventListener('click', () => {
        this.removeTool(tool.port);
      });

      this.toolsList.appendChild(div);
    }
  }

  saveTools() {
    localStorage.setItem('lmstudio-chat-tools', JSON.stringify(this.tools));
  }

  loadTools() {
    try {
      const saved = localStorage.getItem('lmstudio-chat-tools');
      if (saved) {
        this.tools = JSON.parse(saved);
      }
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

    await this.askWhatNext();
  }

  async askWhatNext() {
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      console.log('[DECIDER] Last message is AI response, stopping');
      this.isGenerating = false;
      this.updateSendButton();
      return;
    }

    this.showTypingIndicator();
    this.isGenerating = true;
    this.updateSendButton();

    try {
      const lastUserMessage = this.getLastUserMessage();
      const toolsAvailable = this.tools.map(t => t.name);

      console.log('[DECIDER] Asking if TOOL, ANSWER, or DONE...');
      console.log('[DECIDER] Last user message:', lastUserMessage);
      console.log('[DECIDER] Available tools:', toolsAvailable);
      console.log('[DECIDER] All messages:', JSON.stringify(this.messages, null, 2));

      const response = await fetch('/api/decide/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastUserMessage, toolsAvailable })
      });

      if (!response.ok) throw new Error('Decider failed');

      const decision = (await response.text()).trim().toUpperCase();
      console.log('[DECIDER] Decision:', decision);

      if (decision === 'DONE' || decision === 'ANSWER') {
        await this.getNormalAnswer();
      } else if (decision === 'TOOL') {
        await this.askToolAndExecute();
      } else {
        await this.getNormalAnswer();
      }

    } catch (error) {
      console.error('[DECIDER] Error:', error);
      this.isGenerating = false;
      this.updateSendButton();
    }
  }

  async askToolAndExecute() {
    try {
      const lastUserMessage = this.getLastUserMessage();
      const toolsAvailable = this.tools.map(t => t.name);

      console.log('[TOOL-DECIDER] Asking which tool to use...');
      console.log('[TOOL-DECIDER] User message:', lastUserMessage);
      console.log('[TOOL-DECIDER] Available tools:', toolsAvailable);

      const response = await fetch('/api/decide/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastUserMessage, toolsAvailable })
      });

      if (!response.ok) throw new Error('Tool decider failed');

      const toolName = (await response.text()).trim();
      console.log('[TOOL-DECIDER] Selected tool:', toolName);

      const tool = this.findTool(toolName);

      if (!tool) {
        console.log('[TOOL-DECIDER] Tool not found:', toolName);
        this.hideTypingIndicator();
        this.addMessage('tool-result', `Error: Tool "${toolName}" not found`, { toolName });
        this.isGenerating = false;
        this.updateSendButton();
        return;
      }

      console.log('[TOOL-DECIDER] Found tool at port:', tool.port);
      await this.askToolParams(tool);

    } catch (error) {
      console.error('[TOOL-DECIDER] Error:', error);
      this.isGenerating = false;
      this.updateSendButton();
    }
  }

  async askToolParams(tool) {
    try {
      const promptRes = await fetch('/api/prompts/params');
      const paramsSystemPrompt = await promptRes.text();

      console.log('[PARAMS] Extracting params for tool:', tool.name);
      console.log('[PARAMS] System prompt:', paramsSystemPrompt);

      const conversationMessages = this.getConversationMessagesForAnswer();
      console.log('[PARAMS] Full conversation context:', JSON.stringify(conversationMessages, null, 2));

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: paramsSystemPrompt },
            ...conversationMessages
          ],
          max_tokens: 200,
          temperature: 0.1
        })
      });

      if (!response.ok) throw new Error('Failed to get params');

      const text = await response.text();
      console.log('[PARAMS] AI response:', text);

      const params = this.parseToolParams(text);
      console.log('[PARAMS] Extracted params:', JSON.stringify(params));

      await this.executeToolCall(tool.name, params);

    } catch (error) {
      console.error('[PARAMS] Error:', error);
      this.isGenerating = false;
      this.updateSendButton();
    }
  }

  parseToolParams(text) {
    try {
      const parsed = JSON.parse(text.trim());

      if (parsed.id && parsed.object && parsed.choices) {
        const content = parsed.choices?.[0]?.message?.content;
        if (content && typeof content === 'string') {
          try {
            return JSON.parse(content);
          } catch (e) {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
              try {
                return JSON.parse(match[0].trim());
              } catch (e2) {}
            }
          }
        }
        return {};
      }

      if (parsed.next && parsed.params) {
        return parsed.params;
      }

      if (parsed.operation || parsed.url || parsed.command) {
        return parsed;
      }

      return {};
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0].trim());
        } catch (e2) {}
      }
      return {};
    }
  }

  async getNormalAnswer() {
    try {
      const conversationMessages = this.getConversationMessagesForAnswer();

      console.log('[ANSWER] Getting normal AI response...');
      console.log('[ANSWER] Conversation messages:', JSON.stringify(conversationMessages, null, 2));

      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationMessages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error('Failed to get answer');

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';

      console.log('[ANSWER] AI response:', content);

      this.hideTypingIndicator();
      this.addMessage('assistant', content);
      this.isGenerating = false;
      this.updateSendButton();

    } catch (error) {
      console.error('[ANSWER] Error:', error);
      this.isGenerating = false;
      this.updateSendButton();
    }
  }

  getLastUserMessage() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        return this.messages[i].content;
      }
    }
    return '';
  }

  getConversationMessagesForAnswer() {
    return this.messages.map(m => {
      if (m.role === 'user') return { role: 'user', content: m.content };
      if (m.role === 'assistant') return { role: 'assistant', content: m.content };
      if (m.role === 'tool-call') return { role: 'user', content: `[Tool Call: ${m.toolName}]` };
      if (m.role === 'tool-result') return { role: 'user', content: `[Tool Result: ${m.toolName}]: ${m.content}` };
      return { role: 'user', content: m.content };
    });
  }

  async executeToolCall(toolName, params) {
    if (!toolName) return;

    const callNumber = Date.now();

    console.log('[TOOL-CALL] Executing:', toolName, 'params:', JSON.stringify(params));

    this.addMessage('tool-call', '', { toolName, toolArgs: params, callNumber });
    this.showTypingIndicator();

    try {
      const tool = this.findTool(toolName);
      if (!tool) {
        console.log('[TOOL-CALL] Tool not found:', toolName);
        this.hideTypingIndicator();
        this.addMessage('tool-result', `Error: Tool "${toolName}" not found`, { toolName, callNumber });
        this.isGenerating = false;
        this.updateSendButton();
        return;
      }

      console.log('[TOOL-CALL] Found tool at port:', tool.port);

      const { operation, ...restParams } = params;
      const baseUrl = `http://localhost:${tool.port}`;

      const filteredParams = {};
      for (const [key, value] of Object.entries(restParams)) {
        if (key.toLowerCase() !== 'tool' && key.toLowerCase() !== 'toolname') {
          filteredParams[key] = value;
        }
      }
      const queryParams = new URLSearchParams(filteredParams).toString();

      const possibleEndpoints = [];
      if (operation) possibleEndpoints.push(operation.toLowerCase().replace(/[^a-z0-9]/g, ''));
      possibleEndpoints.push(tool.name.split(' ')[0].toLowerCase());
      possibleEndpoints.push(tool.name.toLowerCase().replace(/[^a-z0-9]/g, ''));

      console.log('[TOOL-CALL] Trying endpoints:', possibleEndpoints);
      console.log('[TOOL-CALL] Params:', filteredParams);

      let response = null;

      for (const endpoint of possibleEndpoints) {
        if (!endpoint) continue;
        const url = queryParams ? `${baseUrl}/${endpoint}?${queryParams}` : `${baseUrl}/${endpoint}`;
        console.log('[TOOL-CALL] Fetching:', url);
        response = await fetch(url);
        console.log('[TOOL-CALL] Response status:', response.status);
        if (response.ok) break;
      }

      if (!response || !response.ok) throw new Error(`Tool returned ${response?.status || 404}`);

      const result = await response.json();
      const resultStr = JSON.stringify(result, null, 2);

      this.hideTypingIndicator();
      this.addMessage('tool-result', resultStr, { toolName, callNumber });

      this.messages.push({
        role: 'tool',
        content: resultStr,
        tool_name: toolName
      });

      await this.getNormalAnswer();
    } catch (error) {
      this.hideTypingIndicator();
      this.addMessage('tool-result', `Error: ${error.message}`, { toolName, callNumber });
      this.isGenerating = false;
      this.updateSendButton();
    }
  }

  findTool(toolName) {
    const name = toolName.toLowerCase();
    return this.tools.find(t => 
      t.name.toLowerCase() === name || 
      t.name.toLowerCase().includes(name) ||
      name.includes(t.name.toLowerCase().replace(/\s/g, ''))
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

  updateLastMessage(content) {
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage) {
      lastMessage.content = content;
      const messageEl = this.messagesContainer.lastElementChild;
      if (messageEl) {
        messageEl.querySelector('.message-content').innerHTML = this.formatMessage(content);
      }
    }
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
      const callNumber = message.callNumber ? ` :${message.callNumber}` : '';
      const argsStr = JSON.stringify(message.toolArgs || message.tool_args || {}, null, 2);
      contentHtml = `
        <div class="tool-call-header">
          <span class="tool-name">${this.escapeHtml(toolName)}${callNumber}</span>
        </div>
        <pre class="tool-args"><code>${this.escapeHtml(argsStr)}</code></pre>
      `;
    } else if (message.role === 'tool-result') {
      div.classList.add('tool-result');
      avatar = 'R';
      const callNumber = message.callNumber ? ` :${message.callNumber}` : '';
      contentHtml = `
        <div class="tool-result-header">
          <span class="tool-name">${this.escapeHtml(toolName)}${callNumber}</span>
        </div>
        <pre class="tool-result-content"><code>${this.escapeHtml(message.content)}</code></pre>
      `;
    }

    div.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">${contentHtml}</div>
    `;

    this.messagesContainer.appendChild(div);
    this.scrollToBottom();
  }

  formatMessage(content) {
    let formatted = this.parseMarkdown(content);
    return formatted;
  }

  parseMarkdown(text) {
    let html = text;
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>`;
    });

    html = html.replace(/```([^`]+)```/g, (match, code) => {
      return `<code>${this.escapeHtml(code.trim())}</code>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    html = html.replace(/\n/g, '<br>');

    const lines = html.split('<br>');
    let inList = false;
    let result = '';

    for (let line of lines) {
      if (line.startsWith('<li>')) {
        if (!inList) {
          if (result.endsWith('</p>')) result = result.slice(0, -4);
          result += '<ul>';
          inList = true;
        }
        result += line;
      } else {
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        if (line && !line.startsWith('<h') && !line.startsWith('<ul') && !line.startsWith('<blockquote')) {
          if (!result.endsWith('</p>') && !result.endsWith('</ul>') && !result.endsWith('</blockquote>')) {
            if (!result.endsWith('>')) result += '<p>';
          }
          if (line.trim() && !line.startsWith('<')) {
            result += line + '</p>';
          } else {
            result += line;
          }
        } else {
          result += line;
        }
      }
    }

    if (inList) result += '</ul>';

    return result;
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

  updateSendButton() {
    this.sendBtn.disabled = this.isGenerating;
  }

  newChat() {
    this.messages = [];
    this.messagesContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <h2>How can I help you?</h2>
        <p>Start a conversation with your LM Studio model</p>
      </div>
    `;
    this.saveToStorage();
  }

  renderMessages() {
    if (this.messages.length === 0) {
      this.messagesContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <h2>How can I help you?</h2>
          <p>Start a conversation with your LM Studio model</p>
        </div>
      `;
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
      if (index !== -1) {
        this.conversations[index] = conversation;
      }
    }

    localStorage.setItem('lmstudio-chat-conversations', JSON.stringify(this.conversations));
    this.renderChatHistory();
  }

  getConversationPreview() {
    for (const msg of this.messages) {
      if (msg.role === 'user' && msg.content) {
        return msg.content.slice(0, 30);
      }
      if (msg.role === 'assistant' && msg.content) {
        return msg.content.slice(0, 30);
      }
    }
    return 'New Chat';
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('lmstudio-chat-conversations');
      if (saved) {
        this.conversations = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
    this.loadTools();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
