#!/usr/bin/env bash
# bootstrap.sh — find and run bootstrap-mcp.sh

find_bootstrap_script() {
  for path in "${BOOTSTRAP_SCRIPT_PATHS[@]}"; do
    local resolved
    resolved=$(realpath "$path" 2>/dev/null)
    if [[ -f "$resolved" ]]; then
      echo "$resolved"
      return 0
    fi
  done
  return 1
}

run_bootstrap() {
  local script
  script=$(find_bootstrap_script)

  if [[ -z "$script" ]]; then
    log_warn "  bootstrap-mcp.sh not found, skipping bootstrap"
    log_warn "  MCP servers may not work until bootstrap is run manually"
    return 1
  fi

  log_info "  Running bootstrap-mcp.sh..."
  if bash "$script" 2>&1 | sed 's/^/    /'; then
    log_success "  Bootstrap completed"
  else
    log_error "  Bootstrap failed"
    return 1
  fi
}

verify_mcporter() {
  if ! check_binary mcporter; then
    log_warn "  mcporter not installed, skipping verification"
    return 1
  fi

  local workspace="${OPENCLAW_DIR}/workspace-researcher"
  if [[ ! -d "$workspace" ]]; then
    workspace="${OPENCLAW_DIR}/workspace"
  fi

  if [[ -d "$workspace" ]]; then
    log_info "  Verifying MCP servers..."
    local output
    output=$(cd "$workspace" && timeout 30 mcporter list 2>&1) || true
    echo "$output" | sed 's/^/    /'
  fi
}
