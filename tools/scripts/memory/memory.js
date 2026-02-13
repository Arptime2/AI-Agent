const fs = require('fs');
const path = require('path');
const { createTool } = require('../../../server-lib');

const DATA_FILE = path.join(__dirname, 'data', 'memories.json');

function loadMemories() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { memories: [] };
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { memories: [] };
  }
}

function saveMemories(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Store new memory
function store(params) {
  const memory = params.memory || params.text;
  let triggers = params.triggers || params.trigger;

  if (!memory) {
    return { error: 'memory parameter is required' };
  }

  if (!triggers) {
    return { error: 'triggers parameter is required (array of trigger words)' };
  }

  // Handle triggers: can be array, comma-separated string, or single string
  let triggerArray;
  if (Array.isArray(triggers)) {
    triggerArray = triggers;
  } else if (typeof triggers === 'string' && triggers.includes(',')) {
    triggerArray = triggers.split(',').map(t => t.trim());
  } else {
    triggerArray = [triggers];
  }
  
  if (triggerArray.length === 0) {
    return { error: 'At least one trigger word is required' };
  }

  const data = loadMemories();
  const id = generateId();
  
  data.memories.push({
    id,
    memory: memory.trim(),
    triggers: triggerArray.map(t => t.toLowerCase().trim())
  });
  
  saveMemories(data);
  
  return {
    success: true,
    id,
    memory: memory.trim(),
    triggers: triggerArray.map(t => t.toLowerCase().trim())
  };
}

// Retrieve memories based on text content
function retrieve(params) {
  const text = params.text || params.input;

  if (!text) {
    return { error: 'text parameter is required' };
  }

  const data = loadMemories();
  const triggeredMemories = [];
  const triggeredWords = new Set();
  
  for (const mem of data.memories) {
    for (const trigger of mem.triggers) {
      const regex = new RegExp(`\\b${trigger}\\b`, 'i');
      if (regex.test(text.toLowerCase())) {
        triggeredMemories.push(mem.memory);
        triggeredWords.add(trigger);
        break;
      }
    }
  }
  
  return {
    memories: [...new Set(triggeredMemories)],
    triggered: Array.from(triggeredWords),
    count: triggeredMemories.length
  };
}

// List memories by trigger words
function list(params) {
  const triggers = params.triggers || params.trigger;

  if (!triggers) {
    return { error: 'triggers parameter is required' };
  }

  const triggerList = Array.isArray(triggers) ? triggers : [triggers];
  
  if (triggerList.length === 0) {
    return { error: 'At least one trigger word is required' };
  }

  const data = loadMemories();
  const matchedMemories = [];
  const matchedTriggers = new Set();
  
  for (const mem of data.memories) {
    for (const trigger of triggerList) {
      const triggerLower = trigger.toLowerCase().trim();
      if (mem.triggers.includes(triggerLower)) {
        matchedMemories.push(mem.memory);
        matchedTriggers.add(triggerLower);
        break;
      }
    }
  }
  
  return {
    memories: [...new Set(matchedMemories)],
    matchedTriggers: Array.from(matchedTriggers),
    count: matchedMemories.length
  };
}

// Overwrite existing memory
function overwrite(params) {
  const id = params.id;
  const memory = params.memory || params.text;
  const triggers = params.triggers || params.trigger;

  if (!id) {
    return { error: 'id parameter is required' };
  }

  if (!memory) {
    return { error: 'memory parameter is required' };
  }

  if (!triggers) {
    return { error: 'triggers parameter is required' };
  }

  const triggerArray = Array.isArray(triggers) ? triggers : [triggers];
  
  if (triggerArray.length === 0) {
    return { error: 'At least one trigger word is required' };
  }

  const data = loadMemories();
  const index = data.memories.findIndex(m => m.id === id);
  
  if (index === -1) {
    return { error: 'Memory not found' };
  }
  
  data.memories[index] = {
    id,
    memory: memory.trim(),
    triggers: triggerArray.map(t => t.toLowerCase().trim())
  };
  
  saveMemories(data);
  
  return {
    success: true,
    id,
    memory: memory.trim(),
    triggers: triggerArray
  };
}

// Delete memory
function remove(params) {
  const id = params.id;

  if (!id) {
    return { error: 'id parameter is required' };
  }

  const data = loadMemories();
  const initialLength = data.memories.length;
  data.memories = data.memories.filter(m => m.id !== id);
  
  if (data.memories.length === initialLength) {
    return { error: 'Memory not found' };
  }
  
  saveMemories(data);
  
  return {
    success: true,
    deleted: id
  };
}

// Get all memories
function all(params) {
  const data = loadMemories();
  return {
    memories: data.memories,
    count: data.memories.length
  };
}

createTool('Memory', {
  store,
  retrieve,
  list,
  overwrite,
  remove,
  delete: remove,
  all,
  '': store,
  default: store
});
