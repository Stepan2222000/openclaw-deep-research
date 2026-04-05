#!/usr/bin/env bash
# mcp.sh — manage mcporter.template.json

# Check if MCP server exists in template
mcp_has_server() {
  local server_name="$1"
  [[ -f "$TEMPLATE_CONFIG" ]] && jq -e ".mcpServers.\"$server_name\"" "$TEMPLATE_CONFIG" >/dev/null 2>&1
}

# Add MCP server to template
mcp_add_server() {
  local tool_id="$1"
  local mcp_name="${TOOL_MCP_NAME[$tool_id]}"

  if [[ -z "$mcp_name" ]]; then
    log_error "Tool $tool_id has no MCP server name"
    return 1
  fi

  if [[ ! -f "$TEMPLATE_CONFIG" ]]; then
    # Create minimal template
    mkdir -p "$(dirname "$TEMPLATE_CONFIG")"
    echo '{"mcpServers": {}, "imports": []}' > "$TEMPLATE_CONFIG"
  fi

  local url="${TOOL_MCP_URL[$tool_id]}"
  local headers="${TOOL_MCP_HEADERS[$tool_id]:-}"

  local tmp
  tmp=$(mktemp)

  if [[ "$tool_id" == "composio" ]]; then
    # Composio uses baseUrl + headers
    jq --arg name "$mcp_name" \
       --arg url "$COMPOSIO_BASE_URL" \
       --argjson headers "$headers" \
       '.mcpServers[$name] = {"baseUrl": $url, "headers": $headers}' \
       "$TEMPLATE_CONFIG" > "$tmp"
  elif [[ -n "$url" ]]; then
    # Standard: baseUrl only
    jq --arg name "$mcp_name" \
       --arg url "$url" \
       '.mcpServers[$name] = {"baseUrl": $url}' \
       "$TEMPLATE_CONFIG" > "$tmp"
  else
    log_error "No URL template for $tool_id"
    rm -f "$tmp"
    return 1
  fi

  if jq empty "$tmp" 2>/dev/null; then
    mv "$tmp" "$TEMPLATE_CONFIG"
    log_success "  + Added $mcp_name to mcporter.template.json"
  else
    log_error "  Failed to update mcporter.template.json"
    rm -f "$tmp"
    return 1
  fi
}

# Remove MCP server from template
mcp_remove_server() {
  local tool_id="$1"
  local mcp_name="${TOOL_MCP_NAME[$tool_id]}"

  if [[ ! -f "$TEMPLATE_CONFIG" ]]; then
    return 0
  fi

  local tmp
  tmp=$(mktemp)
  jq --arg name "$mcp_name" 'del(.mcpServers[$name])' "$TEMPLATE_CONFIG" > "$tmp"
  mv "$tmp" "$TEMPLATE_CONFIG"
  log_success "  - Removed $mcp_name from mcporter.template.json"
}
