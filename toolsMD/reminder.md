# Reminder Tool

Set and receive reminders. Works with automatic polling.

## Usage

```json
{"tool": "reminder", "params": {"text":"Meeting","time":"in 30 minutes"}}
{"tool": "reminder", "params": {"text":"Take out trash","time":"tomorrow at 9am"}}
{"tool": "reminder", "params": {"text":"Call mom","time":"15:30"}}
{"tool": "reminder", "params": {"list":true}}
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| text | Reminder message (required for create) |
| time | When to remind (see formats below) |
| list | true → list all upcoming reminders |

## Time Formats

- `in 30 minutes` - Relative time
- `in 2 hours` - Relative time
- `15:30` - Today at 15:30
- `9am` - Today at 9:00 AM
- `tomorrow at 9am` - Tomorrow 9:00 AM
- `2025-02-07T15:00:00` - ISO datetime

## Example

```
{"tool": "reminder", "params": {"text":"Take out trash","time":"in 30 minutes"}}
```

Response:
```json
{
  "success": true,
  "reminder": {
    "id": 1,
    "text": "Take out trash",
    "due": "2025-02-07T15:30:00Z"
  }
}
```

## Important

Always call the **time** tool first to get current time before creating a reminder!

## How It Works

1. AI calls reminder tool to set a reminder
2. Server polls every 10 seconds for due reminders
3. When due, reminder appears in chat automatically
4. AI responds to the reminder

## Notifications

Reminders appear as chat messages from the Reminder tool:
```
REMINDER: Take out trash
```
