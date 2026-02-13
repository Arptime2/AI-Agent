const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DATA_FILE = path.join(DATA_DIR, 'app-data.json');

// Default data structure
const defaultData = {
  conversations: [],
  currentConversationId: null,
  toolsEnabled: {},
  toolsConfirm: {},
  systemPrompt: '',
  lastUpdated: new Date().toISOString()
};

// Load data from file
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return { ...defaultData, ...data };
    }
  } catch (e) {
    console.error('Error loading data:', e);
  }
  return { ...defaultData };
}

// Save data to file
function saveData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving data:', e);
    return false;
  }
}

// Get specific key from data
function getDataKey(key) {
  const data = loadData();
  return data[key];
}

// Set specific key in data
function setDataKey(key, value) {
  const data = loadData();
  data[key] = value;
  return saveData(data);
}

module.exports = {
  loadData,
  saveData,
  getDataKey,
  setDataKey
};
