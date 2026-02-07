# Time Tool

Get the current date and time.

## When to Use

Use this tool whenever the user asks about:
- The current time
- Today's date
- What time it is
- Current timestamp or datetime
- Timezone information

## How to Call

```json
{"tool": "time", "params": {}}
```

## Response

Returns an object with:

| Field | Description |
|-------|-------------|
| iso | ISO 8601 formatted date/time string |
| unix | Unix timestamp in seconds |
| local | Formatted local date/time string |
| timezone | Current timezone name |
| hour | Current hour (0-23) |
| minute | Current minute (0-59) |
| second | Current second (0-59) |

## Example

User asks: "What time is it?"

You respond:
```json
{"tool": "time", "params": {}}
```

You receive:
```json
{
  "iso": "2026-02-01T18:31:00.000Z",
  "unix": 1909343400,
  "local": "2/1/2026, 6:31:00 PM",
  "timezone": "America/New_York",
  "hour": 18,
  "minute": 31,
  "second": 0
}
```

Then give the final answer with the time information.
