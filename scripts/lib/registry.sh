#!/usr/bin/env bash
# registry.sh — tool registry: known MCP servers, env vars, URL templates

# All known tools
TOOLS=(exa ref scrapfly scrapfly-browser composio brave onepassword agent-browser)

# Tool types: mcp (mcporter server), cdp (browser CDP), env (just env var), binary (just check exists)
declare -A TOOL_TYPE=(
  [exa]=mcp
  [ref]=mcp
  [scrapfly]=mcp
  [scrapfly-browser]=cdp
  [composio]=mcp
  [brave]=env
  [onepassword]=env
  [agent-browser]=binary
)

# Display names
declare -A TOOL_DISPLAY=(
  [exa]="Exa (semantic search, crawling)"
  [ref]="Ref (documentation search)"
  [scrapfly]="ScrapFly (anti-bot scraping, screenshots)"
  [scrapfly-browser]="ScrapFly Browser (remote anti-detect browser)"
  [composio]="Composio (integrations, Gmail, remote sandbox)"
  [brave]="Brave Search (keyword search)"
  [onepassword]="1Password (credential management)"
  [agent-browser]="Agent Browser (browser automation)"
)

# Required env vars per tool
declare -A TOOL_ENV_VARS=(
  [exa]="EXA_API_KEY"
  [ref]="REF_API_KEY"
  [scrapfly]="SCRAPFLY_API_KEY"
  [scrapfly-browser]="SCRAPFLY_API_KEY"
  [composio]="COMPOSIO_CONSUMER_KEY"
  [brave]="BRAVE_API_KEY"
  [onepassword]="OP_SERVICE_ACCOUNT_TOKEN"
  [agent-browser]=""
)

# MCP server name in mcporter.template.json (empty = not an MCP tool)
declare -A TOOL_MCP_NAME=(
  [exa]="exa"
  [ref]="ref"
  [scrapfly]="scrapfly"
  [composio]="composio"
)

# MCP URL templates (with ${VAR} placeholders)
declare -A TOOL_MCP_URL=(
  [exa]='https://mcp.exa.ai/mcp?exaApiKey=${EXA_API_KEY}&tools=web_search_exa,crawling_exa,get_code_context_exa,web_search_advanced_exa'
  [ref]='https://api.ref.tools/mcp?apiKey=${REF_API_KEY}'
  [scrapfly]='https://mcp.scrapfly.io/mcp?key=${SCRAPFLY_API_KEY}'
  [composio]=''  # composio uses headers, handled specially
)

# MCP headers (JSON object, only for servers that use header auth)
declare -A TOOL_MCP_HEADERS=(
  [composio]='{"x-consumer-api-key": "${COMPOSIO_CONSUMER_KEY}"}'
)

# Composio base URL (no key in URL, key is in headers)
COMPOSIO_BASE_URL="https://connect.composio.dev/mcp"

# CDP env var name (for scrapfly-browser)
SCRAPFLY_BROWSER_ENV="SCRAPFLY_BROWSER_URL"
SCRAPFLY_BROWSER_URL_TEMPLATE='wss://browser.scrapfly.io/?api_key=${SCRAPFLY_API_KEY}'

# Binary names for binary-type tools
declare -A TOOL_BINARY=(
  [agent-browser]="agent-browser"
)
