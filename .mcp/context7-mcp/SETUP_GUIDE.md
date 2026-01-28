# Context7 MCP Server Setup - Muzika Project

## Installation Summary

✅ **Successfully installed Context7 MCP server** with the following configuration:

### Server Details
- **Server Name**: `github.com/upstash/context7-mcp`
- **Configuration File**: `/home/k/Downloads/muzika/mcp_config.json`
- **Installation Directory**: `/home/k/Downloads/muzika/.mcp/context7-mcp/`
- **Transport**: stdio (via npx)
- **Authentication**: API key configured

### Current Configuration

```json
{
    "mcpServers": {
        "github.com/upstash/context7-mcp": {
            "command": "npx",
            "args": [
                "-y",
                "@upstash/context7-mcp",
                "--api-key",
                "ctx7sk-1eeb01b3-7859-4086-a2ca-4bb3e9f236e6"
            ]
        },
        "github": {
            "command": "npx",
            "args": [
                "-y",
                "@modelcontextprotocol/server-github"
            ],
            "env": {
                "GITHUB_PERSONAL_ACCESS_TOKEN": "REPLACE_WITH_YOUR_TOKEN"
            }
        }
    }
}
```

## Available Tools

Context7 MCP provides two main tools:

### 1. `resolve-library-id`
**Purpose**: Resolves a general library name into a Context7-compatible library ID

**Parameters**:
- `query` (required): The user's question or task (used to rank results by relevance)
- `libraryName` (required): The name of the library to search for

**Example**:
```
resolve-library-id("Create a Next.js middleware", "Next.js")
```

### 2. `query-docs`
**Purpose**: Retrieves up-to-date documentation for a library using a Context7-compatible library ID

**Parameters**:
- `libraryId` (required): Exact Context7-compatible library ID (e.g., `/mongodb/docs`, `/vercel/next.js`)
- `query` (required): The question or task to get relevant documentation for

**Example**:
```
query-docs("/vercel/next.js", "Create middleware that checks JWT in cookies")
```

## How to Use

### Method 1: Simple Prompt with "use context7"
Add `use context7` to any coding-related prompt:

```txt
Create a Next.js middleware that checks for a valid JWT in cookies
and redirects unauthenticated users to `/login`. use context7
```

### Method 2: Specify Library ID
Use the slash syntax to specify the exact library:

```txt
Implement basic authentication with Supabase. use library /supabase/supabase for API and docs.
```

### Method 3: Specify Version
Mention the version in your prompt:

```txt
How do I set up Next.js 14 middleware? use context7
```

Context7 will automatically match the appropriate version.

## Key Benefits

✅ **Up-to-date Documentation**: Pulls real-time, version-specific docs from source
✅ **No Hallucinations**: Avoids outdated or non-existent APIs
✅ **Instant Context**: Documentation placed directly into your LLM's prompt
✅ **Version-Specific**: Automatically matches library versions

## Existing MCP Servers

The following MCP servers are also configured:

1. **GitHub**: `@modelcontextprotocol/server-github`
   - Requires: `GITHUB_PERSONAL_ACCESS_TOKEN` env variable

2. **Context7**: `github.com/upstash/context7-mcp` (newly installed)
   - API Key: Configured
   - Status: ✅ Ready

## Next Steps

1. Update your IDE/client's MCP configuration to reference `/home/k/Downloads/muzika/mcp_config.json`
2. Start using Context7 by adding `use context7` to your prompts
3. For higher rate limits, get a free API key at [context7.com/dashboard](https://context7.com/dashboard)

## Troubleshooting

If you encounter issues:

1. **API Key Issues**: Ensure the API key is valid at [context7.com/dashboard](https://context7.com/dashboard)
2. **NPX Not Found**: Install Node.js and npm
3. **Rate Limiting**: Get a free API key for higher limits

## Documentation

- [Context7 Website](https://context7.com)
- [Context7 GitHub](https://github.com/upstash/context7-mcp)
- [Context7 MCP Documentation](https://context7.com/docs)
- [NPM Package](https://www.npmjs.com/package/@upstash/context7-mcp)

---

**Installation Date**: January 28, 2026
**Project**: Muzika - Audio Karaoke Application
**Status**: ✅ Active and Ready
