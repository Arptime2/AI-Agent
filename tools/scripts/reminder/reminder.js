const fs = require('fs');
const path = require('path');
const http = require('http');
const { createTool } = require('../../../server-lib');

const DATA_FILE = path.join(__dirname, 'reminders.json');
const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;

function loadReminders() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { nextId: 1, reminders: [] };
  }
}

function saveReminders(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function parseTime(timeStr, now) {
  const inMatch = timeStr.match(/in\s+(\d+)\s+(minutes?|hours?)/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const ms = unit.startsWith('minute') ? amount * 60 * 1000 : amount * 60 * 60 * 1000;
    return new Date(now.getTime() + ms);
  }

  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    const result = new Date(now);
    result.setHours(hours, minutes, 0, 0);
    
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  const iso = new Date(timeStr);
  if (!isNaN(iso.getTime())) return iso;

  return null;
}

async function create(params) {
  const text = params.text || params.message;
  const timeStr = params.time || params.at;

  if (!text || !timeStr) {
    return { error: 'Both "text" and "time" parameters are required.' };
  }

  const now = new Date();
  const due = parseTime(timeStr, now);

  if (!due) {
    return { error: 'Invalid time format. Use "in 30 minutes", "15:30", "tomorrow at 9am", or ISO format.' };
  }

  const data = loadReminders();
  const id = data.nextId++;
  data.reminders.push({ id, text, due: due.toISOString() });
  saveReminders(data);

  return {
    success: true,
    reminder: {
      id,
      text,
      due: due.toISOString()
    }
  };
}

async function check() {
  const now = new Date();
  const data = loadReminders();
  
  const due = data.reminders.filter(r => new Date(r.due) <= now);
  const upcoming = data.reminders
    .filter(r => new Date(r.due) > now)
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  data.reminders = upcoming;
  saveReminders(data);

  return {
    notifications: due.map(r => ({
      id: r.id,
      text: r.text,
      due: r.due
    })),
    upcoming_count: upcoming.length
  };
}

async function list() {
  const data = loadReminders();
  const sorted = [...data.reminders].sort((a, b) => new Date(a.due) - new Date(b.due));

  return {
    reminders: sorted.map(r => ({
      id: r.id,
      text: r.text,
      due: r.due
    })),
    count: sorted.length
  };
}

async function registerWithServer() {
  const port = process.argv[2];
  if (!port) return;

  try {
    await fetch(`http://${SERVER_HOST}:${SERVER_PORT}/api/register-polling-tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'Reminder',
        url: `http://localhost:${port}`,
        interval: 10000,
        template: 'REMINDER: {text}'
      })
    });
    console.log('Registered with server for polling');
  } catch (e) {
    console.error('Failed to register with server:', e.message);
  }
}

registerWithServer();

createTool('Reminder', {
  create,
  check,
  list,
  poll: check,
  '': create,
  default: create
});
