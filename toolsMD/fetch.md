# Fetch Tool

Fetch URLs and summarize their content using AI.

## Usage

```json
{"tool": "fetch", "params": {"url":"https://example.com"}}
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| url | URL to fetch (required) |
| summary | Custom instruction for what to look for in the summary |

## Examples

Fetch and summarize with default summary:
```
{"tool": "fetch", "params": {"url":"https://en.wikipedia.org/wiki/Cat"}}
```

Fetch and summarize with custom instruction:
```
{"tool": "fetch", "params": {"url":"https://news.ycombinator.com","summary":"extract all job postings with their titles and companies"}}
```

Fetch and extract specific information:
```
{"tool": "fetch", "params": {"url":"https://www.amazon.com/product-page","summary":"extract the price and rating"}}
```

## Response

```json
{
  "url": "https://example.com",
  "summary": "This page is about..."
}
```

## Tips

- Uses http/https modules with proper User-Agent headers
- The `summary` parameter lets you control what information the AI extracts
- When `summary` is provided, the AI focuses on that specific information
- When `summary` is omitted, a general summary is created
- First 15000 characters of HTML are used for summarization
- Some sites (login pages, redirects) may fail to fetch
