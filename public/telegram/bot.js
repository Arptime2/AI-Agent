let lastUpdateId = null;
let pollingInterval = null;
let isRunning = false;
let telegramToken = '';
let chatId = '';

function getToken() {
  return telegramToken || localStorage.getItem('telegram_bot_token') || '';
}

function getChatId() {
  return chatId || localStorage.getItem('telegram_chat_id') || '';
}

function getApiUrl() {
  const token = getToken();
  return `https://api.telegram.org/bot${token}`;
}

async function apiRequest(method, data = {}) {
  const response = await fetch(`${getApiUrl()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

async function getUpdates() {
  try {
    const data = { timeout: 30 };
    if (lastUpdateId) data.offset = lastUpdateId + 1;
    
    const result = await apiRequest('getUpdates', data);
    
    if (result.ok && result.result) {
      for (const update of result.result) {
        lastUpdateId = update.update_id;
        await handleUpdate(update);
      }
    }
  } catch (error) {
    console.error('Polling error:', error);
  }
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return;
  
  const messageChatId = message.chat.id;
  const text = message.text;
  
  console.log(`Telegram message from ${messageChatId}: ${text}`);
  
  if (text === '/start') {
    await sendMessage(messageChatId, 'Welcome! Send me any message and I will forward it to the AI.');
    await sendMessage(messageChatId, 'The AI will respond and I will send the response back here.');
  } else if (text === '/help') {
    await sendMessage(messageChatId, 'Commands:\n/start - Start conversation\n/help - Show this help\n\nJust send any message to chat with the AI!');
  } else {
    await sendMessage(messageChatId, 'Processing your message...');
    
    try {
      // Use unified chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text, 
          channel: 'telegram',
          chatId: messageChatId 
        })
      });
      
      const result = await response.json();
      
      if (result.response) {
        await sendMessage(messageChatId, result.response);
      } else if (result.error) {
        await sendMessage(messageChatId, `Error: ${result.error}`);
      } else {
        await sendMessage(messageChatId, 'No response from AI');
      }
    } catch (error) {
      await sendMessage(messageChatId, `Error: ${error.message}`);
    }
  }
}

async function sendMessage(toChatId, text) {
  const chunks = text.match(/.{1,4000}/g) || [];
  
  for (const chunk of chunks) {
    await apiRequest('sendMessage', {
      chat_id: toChatId,
      text: chunk,
      parse_mode: 'Markdown'
    });
  }
}

async function sendToChat(text) {
  const theChatId = getChatId();
  if (!theChatId) {
    console.log('No CHAT_ID configured');
    return { error: 'Telegram chat ID not configured' };
  }
  
  try {
    // Use unified chat endpoint
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: text, 
        channel: 'telegram',
        chatId: theChatId 
      })
    });
    
    const result = await response.json();
    
    if (result.response) {
      await sendMessage(theChatId, result.response);
      return { success: true };
    } else {
      return { error: result.error || 'No response' };
    }
  } catch (error) {
    return { error: error.message };
  }
}

function startPolling() {
  if (isRunning) return { error: 'Already running' };
  
  const token = getToken();
  if (!token) {
    return { error: 'Bot token not configured' };
  }
  
  isRunning = true;
  console.log('Starting Telegram polling...');
  
  pollingInterval = setInterval(getUpdates, 1000);
  
  return { success: true, status: 'Polling started' };
}

function stopPolling() {
  if (!isRunning) return { error: 'Not running' };
  
  isRunning = false;
  
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  console.log('Telegram polling stopped');
  return { success: true, status: 'Polling stopped' };
}

function setToken(token) {
  telegramToken = token;
  localStorage.setItem('telegram_bot_token', token);
  return { success: true };
}

function setChatId(id) {
  chatId = id;
  localStorage.setItem('telegram_chat_id', id);
  return { success: true };
}

function getStatus() {
  return {
    tokenConfigured: !!getToken(),
    chatIdConfigured: !!getChatId(),
    isRunning
  };
}

function getUpdatesSync() {
  return { lastUpdateId, isRunning };
}

// Expose globally for browser
if (typeof window !== 'undefined') {
  window.telegramBot = {
    startPolling,
    stopPolling,
    sendToChat,
    setToken,
    setChatId,
    getStatus,
    getUpdatesSync
  };
}
