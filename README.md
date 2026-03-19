# openclaw-deep-research

OpenClaw plugin for autonomous deep research with sub-agents.

## What it does

- **Researcher sub-agent** with prompt assembled from modular markdown blocks during `setup`
- **Coordinator skill** (SKILL.md) — instructions for the main agent on how to manage research sessions
- **Tool toggles** in plugin config — include or exclude Exa, ScrapFly, Brave, Ref, agent-browser, 1Password
- **Slash command** — `/research`
- **CLI** — `openclaw deep-research setup/status`

## Architecture

```
User → Coordinator (reads SKILL.md) → sessions_spawn(agentId: "researcher")
                                           ↓
                     setup builds workspace-researcher/AGENTS.md from assets/*
                                           ↓
                                    Researcher sub-agent works
                                    (Exa, ScrapFly, agent-browser, etc.)
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
- Build researcher workspace with AGENTS.md prompt
- Patch `openclaw.json` (agents.list, allowAgents, exec)
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
openclaw deep-research setup   # Initial setup or prompt rebuild
openclaw deep-research status  # Check configuration
```

## File Structure

```
openclaw-deep-research/
├── index.ts              # Plugin entry: command registration and debug logging
├── package.json
├── openclaw.plugin.json
├── tsconfig.json
├── assets/
│   ├── base-prompt.md              # Base researcher prompt with placeholders
│   ├── cascades.md                 # Search and extraction cascades
│   ├── experience-instructions.md  # Experience logging instructions
│   ├── SKILL.md                    # Coordinator instructions
│   └── tools/                      # Per-tool prompt blocks
├── commands/
│   └── cli.ts                      # setup, status
├── lib/
│   └── prompt-builder.ts           # AGENTS.md assembly from assets
└── .claude/
    └── skills/                     # Local Claude/Codex skills
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
