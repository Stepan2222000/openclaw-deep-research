#!/usr/bin/env bash
# setup-tools.sh — interactive setup for all research tools
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/registry.sh"
source "$SCRIPT_DIR/lib/check.sh"
source "$SCRIPT_DIR/lib/mcp.sh"
source "$SCRIPT_DIR/lib/bootstrap.sh"

require_jq

# ────────────────────────────────────────
# Ensure Xvfb is installed and running on :99
# ────────────────────────────────────────
ensure_xvfb() {
  # Check if Xvfb is running
  if pgrep -f "Xvfb :99" >/dev/null 2>&1; then
    log_success "  Xvfb already running on :99"
    return 0
  fi

  # Check if installed
  if ! check_binary Xvfb; then
    log_info "  Installing Xvfb (virtual display)..."
    if apt-get install -y xvfb 2>&1 | tail -1 | sed 's/^/    /'; then
      log_success "  Xvfb installed"
    else
      log_error "  Failed to install Xvfb"
      log_info "  agent-browser needs DISPLAY=:99 — install Xvfb manually"
      return 1
    fi
  fi

  # Start Xvfb
  log_info "  Starting Xvfb on :99..."
  Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -ac &
  sleep 1
  if pgrep -f "Xvfb :99" >/dev/null 2>&1; then
    log_success "  Xvfb running on :99"
  else
    log_error "  Failed to start Xvfb"
    return 1
  fi
}

# ────────────────────────────────────────
# Install a binary tool
# ────────────────────────────────────────
install_binary() {
  local tool_id="$1"
  local binary="${TOOL_BINARY[$tool_id]}"

  log_info "  Installing $binary via npm..."
  if npm install -g "$binary" 2>&1 | sed 's/^/    /'; then
    if [[ "$binary" == "agent-browser" ]]; then
      # Chrome binaries
      log_info "  Installing Chrome browser..."
      "$binary" install 2>&1 | sed 's/^/    /'

      # Xvfb (virtual display)
      ensure_xvfb
    fi
    log_success "  $binary installed ($("$binary" --version 2>/dev/null || echo 'done'))"
  else
    log_error "  Failed to install $binary"
    return 1
  fi
}

# ────────────────────────────────────────
# Configure a single tool
# ────────────────────────────────────────
configure_tool() {
  local tool_id="$1"
  local tool_type="${TOOL_TYPE[$tool_id]}"
  local env_var="${TOOL_ENV_VARS[$tool_id]}"

  printf "\n"
  log_bold "  Configuring: ${TOOL_DISPLAY[$tool_id]}"

  # Step 1: Ensure API key / env var
  if [[ -n "$env_var" ]]; then
    local current
    current=$(read_env "$env_var")
    if [[ -n "$current" ]]; then
      local masked="${current:0:8}...${current: -4}"
      log_success "  $env_var found ($masked)"
      printf "  Keep current value? [Y/n]: "
      local keep
      read -r keep
      if [[ "$keep" =~ ^[Nn] ]]; then
        printf "  Enter new $env_var: "
        local new_val
        read -r new_val
        if [[ -n "$new_val" ]]; then
          write_env "$env_var" "$new_val"
          log_success "  Updated $env_var"
        fi
      fi
    else
      printf "  Enter $env_var: "
      local new_val
      read -r new_val
      if [[ -z "$new_val" ]]; then
        log_warn "  Skipped — no key provided"
        return 1
      fi
      write_env "$env_var" "$new_val"
      log_success "  Saved $env_var"
    fi
  fi

  # Step 2: Type-specific setup
  case "$tool_type" in
    mcp)
      if ! mcp_has_server "${TOOL_MCP_NAME[$tool_id]}"; then
        mcp_add_server "$tool_id"
      else
        log_success "  MCP server already in template"
      fi
      ;;
    cdp)
      # ScrapFly Browser: generate SCRAPFLY_BROWSER_URL from SCRAPFLY_API_KEY
      local api_key
      api_key=$(read_env "SCRAPFLY_API_KEY")
      if [[ -n "$api_key" ]]; then
        local browser_url="wss://browser.scrapfly.io/?api_key=${api_key}"
        write_env "$SCRAPFLY_BROWSER_ENV" "$browser_url"
        log_success "  Set $SCRAPFLY_BROWSER_ENV"
      else
        log_error "  SCRAPFLY_API_KEY required for ScrapFly Browser"
        return 1
      fi
      ;;
    env)
      log_success "  Done — key is in .env"
      ;;
    binary)
      local binary="${TOOL_BINARY[$tool_id]}"
      if check_binary "$binary"; then
        log_success "  $binary found at $(which "$binary") ($(${binary} --version 2>/dev/null || echo '?'))"
        printf "  Reinstall/update? [y/N]: "
        local update
        read -r update
        if [[ "$update" =~ ^[Yy] ]]; then
          install_binary "$tool_id"
        fi
      else
        log_warn "  $binary not found in PATH"
        printf "  Install now? [Y/n]: "
        local install
        read -r install
        if [[ ! "$install" =~ ^[Nn] ]]; then
          install_binary "$tool_id"
        else
          return 1
        fi
      fi
      ;;
  esac

  return 0
}

# ────────────────────────────────────────
# Main
# ────────────────────────────────────────
main() {
  printf "\n"
  log_bold "  🔬 Deep Research — Tool Setup"
  printf "\n"

  if [[ ! -f "$ENV_FILE" ]]; then
    log_error "  .env not found at $ENV_FILE"
    log_info "  Create it first: cp $OPENCLAW_DIR/.env.example $ENV_FILE"
    exit 1
  fi

  # Show current status
  show_all_status

  # Selection
  printf "  Enter tool numbers to configure (space-separated), or 'all': "
  local input
  read -r input

  if [[ -z "$input" ]]; then
    log_info "  Nothing selected, exiting."
    exit 0
  fi

  local selected=()
  if [[ "$input" == "all" ]]; then
    selected=("${TOOLS[@]}")
  else
    for num in $input; do
      local idx=$((num - 1))
      if [[ $idx -ge 0 && $idx -lt ${#TOOLS[@]} ]]; then
        selected+=("${TOOLS[$idx]}")
      else
        log_warn "  Invalid number: $num"
      fi
    done
  fi

  if [[ ${#selected[@]} -eq 0 ]]; then
    log_info "  Nothing selected, exiting."
    exit 0
  fi

  # Configure each selected tool
  local mcp_changed=false
  for tool in "${selected[@]}"; do
    if configure_tool "$tool"; then
      if [[ "${TOOL_TYPE[$tool]}" == "mcp" ]]; then
        mcp_changed=true
      fi
    fi
  done

  # Run bootstrap if any MCP tools were added/changed
  if [[ "$mcp_changed" == true ]]; then
    printf "\n"
    log_bold "  Running MCP bootstrap..."
    run_bootstrap
  fi

  # Verify
  printf "\n"
  log_bold "  Verification"
  verify_mcporter

  # Final status
  printf "\n"
  log_bold "  Final Status"
  show_all_status

  log_success "  Setup complete!"
  printf "\n"
}

main "$@"
