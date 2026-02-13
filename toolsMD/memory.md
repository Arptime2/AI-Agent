# Memory Tool

Store and retrieve long-term memories. You can save important facts, preferences, and context to remember across conversations. Use this often to remember anything with the retrieve operation of this tool.

## When to Use store operation

Use this tool to remember:
- User preferences (themes, settings, formats)
- Important facts about the user or other important topics
- Recurring topics or interests
- Context that should persist across chats
- Personal information the user wants remembered

Do NOT store:
- Every message or temporary context

## When to Retrieve

Call **retrieve** operation of the store tool before ANY and EVERY responses directly to the user to check if any memories should influence your response to see if memories already exist that might help:

**Call retrieve when:**
- User asks a question that might relate to stored preferences or things that could be stored
- User mentions topics that could have associated memories
- Before giving advice or recommendations
- When the user input contains keywords that might trigger memories
- The topic seems new


**What text to use:**
Use the **user's input message** as the text parameter:
```json
{"tool": "memory", "params": {"operation":"retrieve","text":"User's exact message here"}}
```

**Example workflow:**
1. User asks: "What's a good IDE?"
2. AI retrieves: `{"operation":"retrieve","text":"What's a good IDE?"}`
3. Tool returns: `{memories: ["User is a software developer"], triggered: ["IDE"]}`
4. AI responds: "Since you're a software developer, I'd recommend VS Code..."

**Guideline:** Retrieve on roughly 30-50% of responses when context might be relevant.

## How to Call

All operations use the `operation` parameter:

```json
{"tool": "memory", "params": {"operation":"store","memory":"User prefers dark mode","triggers":["dark","theme"]}}
```

## Operations

| Operation | Description |
|-----------|-------------|
| store | Save a new memory with trigger words |
| retrieve | Check if memories are triggered by text |
| list | Get memories matching specific trigger words |
| overwrite | Update an existing memory |
| delete | Remove a memory by ID |
| all | Get all stored memories |

## Store Memory

Save a new memory with trigger words.

```json
{"tool": "memory", "params": {"operation":"store","memory":"User prefers dark mode","triggers":["dark","theme","preference"]}}
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| operation | yes | Must be "store" |
| memory | yes | The memory text to store |
| triggers | yes | Array of words that trigger this memory |

**Response:**
```json
{
  "success": true,
  "id": "abc123",
  "memory": "User prefers dark mode",
  "triggers": ["dark", "theme", "preference"]
}
```

## Retrieve Memories

Check if any memories are triggered by input text.

```json
{"tool": "memory", "params": {"operation":"retrieve","text":"I want to enable dark mode"}}
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| operation | yes | Must be "retrieve" |
| text | yes | Text to check for trigger words |

**Response:**
```json
{
  "memories": ["User prefers dark mode", "User likes blue accent colors"],
  "triggered": ["dark", "mode"],
  "count": 2
}
```

## List Memories

Get all memories that match specific trigger words.

```json
{"tool": "memory", "params": {"operation":"list","triggers":["dark","theme"]}}
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| operation | yes | Must be "list" |
| triggers | yes | Array of trigger words to search for |

**Response:**
```json
{
  "memories": ["User prefers dark mode", "User likes high contrast themes"],
  "matchedTriggers": ["dark", "theme"],
  "count": 2
}
```

## Overwrite Memory

Update an existing memory.

```json
{"tool": "memory", "params": {"operation":"overwrite","id":"abc123","memory":"User prefers light mode now","triggers":["light","mode"]}}
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| operation | yes | Must be "overwrite" |
| id | yes | Memory ID to update |
| memory | yes | New memory text |
| triggers | yes | New trigger words |

**Response:**
```json
{
  "success": true,
  "id": "abc123",
  "memory": "User prefers light mode now",
  "triggers": ["light", "mode"]
}
```

## Delete Memory

Remove a memory by ID.

```json
{"tool": "memory", "params": {"operation":"delete","id":"abc123"}}
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| operation | yes | Must be "delete" |
| id | yes | Memory ID to delete |

**Response:**
```json
{
  "success": true,
  "deleted": "abc123"
}
```

## Get All Memories

List all stored memories.

```json
{"tool": "memory", "params": {"operation":"all"}}
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| operation | yes | Must be "all" |

**Response:**
```json
{
  "memories": [
    {
      "id": "abc123",
      "memory": "User prefers dark mode",
      "triggers": ["dark", "theme"]
    }
  ],
  "count": 1
}
```

## How It Works

1. **Store**: AI saves a memory with trigger words
   ```json
   {"tool": "memory", "params": {"operation":"store","memory":"User is a software developer","triggers":["developer","coding","programming","job"]}}
   ```

2. **Retrieve**: Before responding, AI checks if input triggers any memories
   ```json
   {"tool": "memory", "params": {"operation":"retrieve","text":"What IDE do you recommend for coding?"}}
   ```
   
3. **Use**: AI uses triggered memories to personalize response
   - Response: "Since you're a software developer, I'd recommend VS Code..."

## Matching Logic

- **Case-insensitive**: "Dark" matches "dark"
- **Whole word only**: "dark" matches but "darkness" does not
- **Multiple triggers**: Memory triggers if ANY trigger word matches
- **No timestamps**: Memories persist indefinitely until deleted

## Examples

**Storing a preference:**
```
User: "I prefer responses in bullet points"
AI: {"tool": "memory", "params": {"operation":"store","memory":"User prefers bullet point format","triggers":["bullet","format","list","points"]}}
```

**Retrieving context:**
```
User: "Can you summarize that?"
AI checks: {"tool": "memory", "params": {"operation":"retrieve","text":"Can you summarize that?"}}
Result: {memories: ["User prefers bullet point format"], triggered: []}
AI responds with bullet points
```

**Listing by trigger:**
```
AI: {"tool": "memory", "params": {"operation":"list","triggers":["preference","like"]}}
Result: All memories with "preference" or "like" in triggers
```

**Deleting old memory:**
```
AI: {"tool": "memory", "params": {"operation":"delete","id":"abc123"}}
```
