# Fetch Tool

Make HTTP/HTTPS requests to URLs.

## When to Use

Use this tool when the user:
- Wants to fetch data from a URL
- Asks for information from a website
- Needs to get JSON from an API

## How to Call

```json
{"next":"tool","tool":"fetch","params":{"url":"https://example.com/api/data"}}
```

### Endpoints

| Endpoint | Parameters | Description |
|----------|------------|-------------|
| fetch | url | Make GET request, returns status and data |
| json | url | Make GET request, expects JSON response |

## Examples

```
{"next":"tool","tool":"fetch","params":{"url":"https://api.github.com/users/octocat"}}
{"next":"tool","tool":"fetch","params":{"url":"https://httpbin.org/ip"}}
```

## Response

**fetch endpoint:**
```json
{
  "status": 200,
  "data": "..."
}
```

**json endpoint:**
```json
{
  "status": 200,
  "json": { ... }
}
```

## Notes

- Maximum 5 second timeout
- Returns first 500 chars of non-JSON responses
- Returns error if URL is missing or request fails
