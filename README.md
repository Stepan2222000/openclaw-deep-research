# openclaw-deep-research

OpenClaw plugin for autonomous deep research with sub-agents.

## What it does

- **Researcher sub-agent** with full tool documentation (Exa, ScrapFly, agent-browser, Brave Search, web_fetch, Ref) — delivered via dedicated workspace
- **Coordinator skill** (SKILL.md) — instructions for the main agent on how to manage research sessions
- **Plugin hooks** — dynamic context injection, automatic INDEX.md updates, Supermemory capture blocking
- **Slash commands** — `/research`, `/research-status`
- **CLI** — `openclaw deep-research setup/status/update-prompt`

## Architecture

```
User → Coordinator (reads SKILL.md) → sessions_spawn(agentId: "researcher")
                                           ↓
                            Plugin hook: before_agent_start → inject date
                            OpenClaw: loads workspace-researcher/AGENTS.md
                                           ↓
                                    Researcher sub-agent works
                                    (Exa, ScrapFly, agent-browser, etc.)
                                           ↓
                            Plugin hook: agent_end → update INDEX.md, block capture
```

## Installation

1. Clone into OpenClaw extensions:
```bash
git clone https://github.com/Stepan2222000/openclaw-deep-research.git \
  ~/.openclaw/extensions/openclaw-deep-research
```

2. Run setup:
```bash
openclaw deep-research setup
```

This will:
- Install SKILL.md to `workspace/skills/deep-research/`
- Create researcher workspace with AGENTS.md prompt
- Patch `openclaw.json` (agents.list, allowAgents, exec)
- Patch Supermemory capture (block capture for researcher)
- Create INDEX.md if missing

3. Restart OpenClaw:
```bash
openclaw gateway --force
```

## Usage

Ask the main agent to research a topic, or use `/research <topic>`.

The coordinator will:
1. Build a brief and discuss with you
2. Create research files
3. Spawn the researcher sub-agent
4. Monitor progress via progress.md
5. Deliver results when done

## CLI Commands

```bash
openclaw deep-research setup          # Initial setup
openclaw deep-research status         # Check configuration
openclaw deep-research update-prompt  # Update prompts after plugin update
```

## File Structure

```
openclaw-deep-research/
├── index.ts              # Plugin entry: hooks, commands, CLI
├── package.json
├── openclaw.plugin.json
├── tsconfig.json
├── assets/
│   ├── researcher-prompt.md   # Sub-agent prompt (AGENTS.md)
│   └── SKILL.md               # Coordinator instructions
├── commands/
│   └── cli.ts                 # setup, status, update-prompt
├── lib/
│   ├── coordinator.ts         # Brief builder, progress reader
│   ├── index-manager.ts       # INDEX.md CRUD
│   └── templates.ts           # Research file templates
└── scripts/
    └── patch-supermemory.sh   # Standalone Supermemory patch
```

## Tools available to researcher

| Server | Tools | Purpose |
|--------|-------|---------|
| Exa | 8 | Semantic search, crawling, deep researcher |
| Ref | 2 | Documentation search + smart URL reading |
| ScrapFly | 4 | Anti-bot scraping, screenshots, LLM extraction |
| Brave | 1 | Keyword search |
| agent-browser | CLI | Full browser automation |
| Native | 3 | web_fetch, read/write/edit |

## License

MIT
