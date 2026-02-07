# Browser Tool

Web search powered by local SearXNG instance.

## Usage

```json
{"tool": "browser", "params": {"search":"berlin"}}
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| query | Search terms (required) - can be first positional arg |
| limit | Max results (default: 10) |
| fetch | 'true' to summarize HTML from results (default: false) |
| summary | Custom instruction you should use always if you dont just want a general summary of the strcture for what to look for in the summary |

## Examples

Basic search:
```
{"tool": "browser", "params": {"search":"Python tutorials"}}
```

Limited results:
```
{"tool": "browser", "params": {"search":"cats","limit":5}}
```

Search and summarize with default summary:
```
{"tool": "browser", "params": {"search":"news berlin","fetch":"true"}}
```

Search and summarize with custom instruction:
```
{"tool": "browser", "params": {"search":"climate change","fetch":"true","summary":"extract the main statistics and numbers about carbon emissions"}}
```

Search and summarize for specific information:
```
{"tool": "browser", "params": {"search":"iPhone 15","fetch":"true","summary":"extract the price and release date"}}
```

## Response

```json
{
  "query": "cats",
  "count": 5,
  "results": [
    {
      "title": "Cat - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Cat",
      "snippet": "The domestic cat is a small carnivorous mammal...",
      "engine": "brave",
      "html": "The domestic cat (Felis catus) is a small carnivorous mammal..."
    }
  ]
}
```

## Tips

- Uses local SearXNG instance (DuckDuckGo, Brave backends)
- SearXNG runs in Docker at http://127.0.0.1:8080
- The `summary` parameter lets you control what information the AI extracts
- When `summary` is provided, the AI focuses on that specific information
- When `summary` is omitted, a general summary is created
- Some sites (login pages, redirects) may fail to fetch
