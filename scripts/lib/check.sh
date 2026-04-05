#!/usr/bin/env bash
# check.sh — status checking for each tool

# Returns: "connected", "key_missing", "not_configured", "binary_missing", "error"
check_tool_status() {
  local tool_id="$1"
  local tool_type="${TOOL_TYPE[$tool_id]}"

  case "$tool_type" in
    mcp)
      local env_var="${TOOL_ENV_VARS[$tool_id]}"
      local key_value
      key_value=$(read_env "$env_var")
      if [[ -z "$key_value" ]]; then
        echo "key_missing"
        return
      fi
      # Check if server is in mcporter.template.json
      local mcp_name="${TOOL_MCP_NAME[$tool_id]}"
      if [[ -f "$TEMPLATE_CONFIG" ]] && jq -e ".mcpServers.\"$mcp_name\"" "$TEMPLATE_CONFIG" >/dev/null 2>&1; then
        echo "connected"
      else
        echo "not_configured"
      fi
      ;;
    cdp)
      local env_var="${TOOL_ENV_VARS[$tool_id]}"
      local key_value
      key_value=$(read_env "$env_var")
      if [[ -z "$key_value" ]]; then
        echo "key_missing"
        return
      fi
      local browser_url
      browser_url=$(read_env "$SCRAPFLY_BROWSER_ENV")
      if [[ -n "$browser_url" ]]; then
        echo "connected"
      else
        echo "not_configured"
      fi
      ;;
    env)
      local env_var="${TOOL_ENV_VARS[$tool_id]}"
      local key_value
      key_value=$(read_env "$env_var")
      if [[ -n "$key_value" ]]; then
        echo "connected"
      else
        echo "key_missing"
      fi
      ;;
    binary)
      local binary="${TOOL_BINARY[$tool_id]}"
      if check_binary "$binary"; then
        echo "connected"
      else
        echo "binary_missing"
      fi
      ;;
    *)
      echo "error"
      ;;
  esac
}

# Print colored status
print_status() {
  local status="$1"
  case "$status" in
    connected)      printf "${GREEN}connected${NC}" ;;
    key_missing)    printf "${YELLOW}key missing${NC}" ;;
    not_configured) printf "${YELLOW}not configured${NC}" ;;
    binary_missing) printf "${RED}not installed${NC}" ;;
    *)              printf "${RED}error${NC}" ;;
  esac
}

# Show all tools with status
show_all_status() {
  printf "\n"
  log_bold "  Tools Status"
  printf "\n"
  local i=1
  for tool in "${TOOLS[@]}"; do
    local status
    status=$(check_tool_status "$tool")
    local display="${TOOL_DISPLAY[$tool]}"
    printf "  %d. %-50s [" "$i" "$display"
    print_status "$status"
    printf "]\n"
    ((i++))
  done
  printf "\n"
}
