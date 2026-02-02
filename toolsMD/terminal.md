# Terminal Tool

Execute shell commands.

## When to Use

Use this tool when the user asks to:
- Run a terminal command
- Execute a shell operation
- Check system information
- Run git commands
- List files or directories
- Read or write files

## How to Call

```json
{"next":"tool","tool":"terminal","params":{"command":"ls -la","timeout":5000}}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| command | string | The shell command to execute |
| timeout | number | Timeout in milliseconds (default: 10000) |

### Endpoints

| Endpoint | Description |
|----------|-------------|
| terminal | Async execution with timeout (default) |
| runSync | Synchronous execution |

## Examples

```
{"next":"tool","tool":"terminal","params":{"command":"ls -la"}}
{"next":"tool","tool":"terminal","params":{"command":"pwd"}}
{"next":"tool","tool":"terminal","params":{"command":"cat file.txt"}}
{"next":"tool","tool":"terminal","params":{"command":"git status"}}
```

## Response

Returns an object with:

| Field | Description |
|-------|-------------|
| command | The executed command |
| exitCode | Process exit code (0 = success) |
| stdout | Standard output (truncated to 5000 chars) |
| stderr | Standard error (truncated to 1000 chars) |
| error | Error message if command failed |

## Notes

- Maximum output is truncated to prevent huge responses
- Commands timeout after 10 seconds by default
- Only safe commands should be used
