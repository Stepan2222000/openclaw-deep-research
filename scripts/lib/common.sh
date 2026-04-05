#!/usr/bin/env bash
# common.sh — shared utilities for setup-tools

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

readonly OPENCLAW_DIR="${HOME}/.openclaw"
readonly ENV_FILE="${OPENCLAW_DIR}/.env"
readonly TEMPLATE_CONFIG="${OPENCLAW_DIR}/config/mcporter.template.json"
readonly BOOTSTRAP_SCRIPT_PATHS=(
  "$(dirname "$(dirname "${BASH_SOURCE[0]}")")/../scripts/bootstrap-mcp.sh"
  "${HOME}/another-openclaw/scripts/bootstrap-mcp.sh"
)

log_info()    { printf "${CYAN}%s${NC}\n" "$*"; }
log_success() { printf "${GREEN}%s${NC}\n" "$*"; }
log_warn()    { printf "${YELLOW}%s${NC}\n" "$*"; }
log_error()   { printf "${RED}%s${NC}\n" "$*" >&2; }
log_bold()    { printf "${BOLD}%s${NC}\n" "$*"; }

# Read a variable from .env file
read_env() {
  local var_name="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 1
  fi
  grep -E "^${var_name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-
}

# Write or update a variable in .env file
write_env() {
  local var_name="$1"
  local value="$2"

  if [[ ! -f "$ENV_FILE" ]]; then
    log_error ".env file not found at $ENV_FILE"
    return 1
  fi

  if grep -qE "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
    # Update existing
    local tmp
    tmp=$(mktemp)
    sed "s|^${var_name}=.*|${var_name}=${value}|" "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    # Append
    echo "${var_name}=${value}" >> "$ENV_FILE"
  fi
}

# Prompt user for a value, showing current if exists
prompt_value() {
  local prompt_text="$1"
  local var_name="$2"
  local current
  current=$(read_env "$var_name")

  if [[ -n "$current" ]]; then
    local masked="${current:0:8}...${current: -4}"
    printf "  ${prompt_text} [current: %s]: " "$masked"
  else
    printf "  ${prompt_text}: "
  fi

  local input
  read -r input
  if [[ -n "$input" ]]; then
    write_env "$var_name" "$input"
    echo "$input"
  else
    echo "$current"
  fi
}

# Check if a binary exists
check_binary() {
  command -v "$1" >/dev/null 2>&1
}

# Check if jq is available
require_jq() {
  if ! check_binary jq; then
    log_error "jq is required but not installed. Install it: apt install jq"
    exit 1
  fi
}
