# {{SERVER_NAME}} MCP Server Documentation

## Overview

{{SERVER_NAME}} is an MCP (Model Context Protocol) server providing:
- TODO: List main capabilities

## Tools

### example_tool

**Description:** TODO: Add tool description

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | The search query |
| format | "concise" \| "detailed" | No | Response format (default: concise) |

**Output:**
```json
{
  "message": "Result message",
  "data": { ... },
  "widget_uri": "ui://{{SERVER_ID}}/widget"
}
```

**Example:**
```json
{
  "name": "example_tool",
  "arguments": {
    "query": "test query",
    "format": "detailed"
  }
}
```

## Widget

The server provides an interactive widget via SEP-1865 MCP Apps protocol.

**Features:**
- Dark mode support
- Auto-refresh capability
- TODO: List widget features

**Usage:**
The widget is automatically loaded when the tool returns with `widget_uri`.

## Authentication

### OAuth 2.1 (Recommended)
For OAuth-capable MCP clients.

1. Client redirects to `/authorize`
2. User authenticates via panel.wtyczki.ai
3. Callback completes OAuth flow
4. Tools become available

### API Key
For non-OAuth clients and custom integrations.

```bash
# Example with curl
curl -X POST https://{{SERVER_ID}}.wtyczki.ai/mcp \
  -H "Authorization: Bearer wtyk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Error Handling

| Error Code | Description | Resolution |
|------------|-------------|------------|
| 401 | Invalid or expired API key | Regenerate key at panel.wtyczki.ai |
| 403 | User not registered | Register at panel.wtyczki.ai |
| 500 | Internal server error | Check Cloudflare Workers logs |

## Rate Limits

- TODO: Document rate limits if applicable
- AI Gateway: 60 requests/hour per user (if using AI)

## Support

- Issues: https://github.com/your-org/{{SERVER_ID}}-mcp/issues
- Documentation: https://docs.wtyczki.ai/{{SERVER_ID}}
