#!/bin/bash
# Patch Supermemory capture.ts to block capture for researcher sub-agents
# Run after updating openclaw-supermemory plugin

CAPTURE_FILE="/root/.openclaw/extensions/openclaw-supermemory/hooks/capture.ts"
MARKER="Deep Research: block capture"

if [ ! -f "$CAPTURE_FILE" ]; then
  echo "ERROR: $CAPTURE_FILE not found"
  exit 1
fi

if grep -q "$MARKER" "$CAPTURE_FILE" 2>/dev/null; then
  echo "Patch already applied"
  exit 0
fi

# Check that the expected signature exists
if ! grep -q 'return async (event: Record<string, unknown>) => {' "$CAPTURE_FILE"; then
  echo "ERROR: Expected function signature not found in $CAPTURE_FILE"
  echo "Supermemory may have changed. Manual patching required."
  exit 1
fi

echo "Applying Supermemory capture patch..."
sed -i 's/return async (event: Record<string, unknown>) => {/return async (event: Record<string, unknown>, ctx?: Record<string, unknown>) => {\n\t\t\/\/ Deep Research: block capture for researcher sub-agents\n\t\tif ((ctx as any)?.agentId === "researcher") return\n/' "$CAPTURE_FILE"

if grep -q "$MARKER" "$CAPTURE_FILE"; then
  echo "Patch applied successfully"
else
  echo "ERROR: Patch application failed"
  exit 1
fi
