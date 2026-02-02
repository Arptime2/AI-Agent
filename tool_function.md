# Tool Functionality - Issues and Explanation

## Current Problems

### 1. AI Doesn't Follow "Only Output JSON" Rule

**Expected behavior:** AI should output ONLY the JSON tool call
```json
{"tool": "terminal", "params": {"command": "echo hello"}}
```

**Actual behavior:** AI outputs conversational text before/after JSON:
```
I understand you'd like me to use the terminal tool. Let me do that:

{"tool": "terminal", "params": {...}}

I've used the tool as requested.
```

### 2. AI Calls Tool Multiple Times

**Request:** "Call the tool once"

**Expected:** One tool call

**Actual:** AI calls the tool 2-5 times repeatedly

### 3. AI Repeats Same Content

The AI repeats the same tool call and same conversational text multiple times in a single response.

## Root Causes

### A. System Prompt Not Strict Enough

The system prompt says:
> "IMPORTANT: When you need to call a tool, output ONLY a JSON object..."

But this rule isn't being enforced by LM Studio. The model ignores this instruction and adds conversational text anyway.

### B. Streaming Response Issue

When AI streams a response, the UI displays content in real-time. This creates confusion because:
1. User sees partial responses
2. AI continues adding content to the same message
3. Tool calls appear multiple times as the stream continues

### C. No Validation of Output Format

The system doesn't validate that the AI's output follows the JSON-only rule. There's no mechanism to:
- Reject responses with conversational text
- Strip out non-JSON content
- Enforce the "only JSON" constraint

### D. Model Behavior

The Qwen model (and many others) naturally produce conversational text. Even with explicit instructions, it tends to:
- Explain what it's doing
- Add context before/after tool calls
- Be "helpful" by providing additional information

## How Tool Calling Currently Works

### 1. AI Receives Request
```
User: "Use the terminal tool once"
```

### 2. AI Generates Response
The AI should output ONLY:
```json
{"tool": "terminal", "params": {"command": "..."}}
```

But instead outputs conversational text + JSON.

### 3. Client Parses Response
Client looks for `{"tool": ` pattern in the text.

### 4. Client Calls Tool
Client extracts tool name and params, makes HTTP request to tool server.

### 5. Tool Result Returned
Tool server returns result (JSON).

### 6. Client Shows Result
Tool call and result displayed in UI.

### 7. Client Sends Result to AI
Tool result is sent back to AI for continuation.

### 8. AI Continues
AI should now provide the final response based on tool result.

## Current Flow (Broken)

```
User Request
    ↓
AI generates response (conversational text + JSON)
    ↓
Client displays partial response
    ↓
Client detects tool call, executes tool
    ↓
Tool result displayed
    ↓
Client sends result to AI
    ↓
AI continues generating (adds more conversational text)
    ↓
AI calls tool AGAIN (unintentionally)
    ↓
Repeat until frustrated user stops conversation
```

## Desired Flow (Correct)

```
User Request
    ↓
AI outputs ONLY: {"tool": "terminal", "params": {...}}
    ↓
Client detects JSON, executes tool
    ↓
Tool result displayed
    ↓
Client sends result to AI
    ↓
AI outputs ONLY: Final response (no JSON, just text)
    ↓
Done
```

## Why This Happens

### For Repeated Tool Calls:
1. AI outputs conversational text saying it will call the tool
2. Then outputs the tool call JSON
3. Then continues generating more text
4. During continued generation, AI accidentally calls the tool again
5. Result: 2+ tool calls for 1 request

### For Conversational Text:
1. The model is trained to be helpful and explain
2. Even with "only JSON" instruction, it adds context
3. No enforcement mechanism exists to prevent this

## Possible Solutions

### Solution 1: Post-Process AI Output (Recommended)

In `app.js`, before displaying AI messages:
- Extract only the JSON part (look for `{"tool":`)
- Discard all conversational text
- Only show the extracted tool call or final response

### Solution 2: Stricter System Prompt

Add consequences to the system prompt:
```
If you output anything other than valid JSON for tool calls, the tool will fail.
Output format: {"tool": "name", "params": {...}}
Do not add explanations, greetings, or any other text.
```

### Solution 3: Validate in Server

Add an endpoint that validates tool call format:
```js
app.post('/api/validate-tool-call', (req, res) => {
  const { output } = req.body;
  const isValid = /^ \{\s*"tool"\s*:/.test(output);
  res.json({ valid: isValid });
});
```

### Solution 4: Better Tool Description

Update `toolsMD/` files to be more explicit:
```
IMPORTANT: You must output EXACTLY ONE JSON object and nothing else.
Do not add explanations before or after the JSON.
Format: {"tool": "name", "params": {...}}
```

## Current Status

| Feature | Status |
|---------|--------|
| Tool discovery | ✅ Works |
| Tool execution | ✅ Works |
| Tool result display | ✅ Works |
| Tool calling from AI | ⚠️ Broken (conversational text) |
| Single tool call | ⚠️ Broken (multiple calls) |
| Only JSON output | ❌ Not enforced |

## Conclusion

The tool infrastructure (servers, endpoints, client) works correctly. The issue is entirely with AI behavior - it doesn't follow the "only output JSON" rule, resulting in:

1. Unnecessary conversational text
2. Multiple unintended tool calls
3. Confusing user experience

The fix requires either:
1. Post-processing AI output (strip non-JSON)
2. A model that strictly follows instructions
3. A validation layer that rejects non-JSON output
