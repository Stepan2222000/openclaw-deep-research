import * as fs from "node:fs"
import * as path from "node:path"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk"

const OPENCLAW_DIR = "/root/.openclaw"
const CONFIG_PATH = `${OPENCLAW_DIR}/openclaw.json`
const WORKSPACE_RESEARCHER = `${OPENCLAW_DIR}/workspace-researcher`
const SKILL_DIR = `${OPENCLAW_DIR}/workspace/skills/deep-research`
const PLUGIN_DIR = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const ASSETS_DIR = `${PLUGIN_DIR}/assets`
const SUPERMEMORY_CAPTURE = `${OPENCLAW_DIR}/extensions/openclaw-supermemory/hooks/capture.ts`

function readConfig(): Record<string, any> {
	if (!fs.existsSync(CONFIG_PATH)) return {}
	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))
	} catch {
		return {}
	}
}

function writeConfig(config: Record<string, any>): void {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8")
}

function copyAsset(assetName: string, destPath: string): boolean {
	const src = `${ASSETS_DIR}/${assetName}`
	if (!fs.existsSync(src)) {
		console.log(`  ✗ Asset not found: ${src}`)
		return false
	}
	const destDir = path.dirname(destPath)
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true })
	}
	fs.copyFileSync(src, destPath)
	return true
}

function patchConfig(config: Record<string, any>): string[] {
	const changes: string[] = []

	// 1. agents.list — add researcher
	if (!config.agents) config.agents = {}
	if (!config.agents.list) config.agents.list = []

	const existingAgent = config.agents.list.find((a: any) => a.id === "researcher")
	if (!existingAgent) {
		config.agents.list.push({
			id: "researcher",
			workspace: WORKSPACE_RESEARCHER,
			bootstrapMaxChars: 40000,
			subagents: { allowAgents: [] },
		})
		changes.push("agents.list: added researcher agent")
	}

	// 2. allowAgents — add "researcher" to defaults
	if (!config.agents.defaults) config.agents.defaults = {}
	if (!config.agents.defaults.subagents) config.agents.defaults.subagents = {}
	const allowAgents: string[] = config.agents.defaults.subagents.allowAgents || []
	if (!allowAgents.includes("researcher")) {
		allowAgents.push("researcher")
		config.agents.defaults.subagents.allowAgents = allowAgents
		changes.push('agents.defaults.subagents.allowAgents: added "researcher"')
	}

	// 3. exec in subagent tools allow
	if (!config.tools) config.tools = {}
	if (!config.tools.subagents) config.tools.subagents = {}
	if (!config.tools.subagents.tools) config.tools.subagents.tools = {}
	const allow: string[] = config.tools.subagents.tools.allow || []
	if (!allow.includes("exec")) {
		allow.push("exec")
		config.tools.subagents.tools.allow = allow
		changes.push('tools.subagents.tools.allow: added "exec"')
	}

	// 4. plugin entry
	if (!config.plugins) config.plugins = {}
	if (!config.plugins.entries) config.plugins.entries = {}
	if (!config.plugins.entries["openclaw-deep-research"]) {
		config.plugins.entries["openclaw-deep-research"] = { enabled: true, config: {} }
		changes.push("plugins.entries: added openclaw-deep-research")
	}

	return changes
}

function patchSupermemory(): boolean {
	const MARKER = "Deep Research: block capture"

	if (!fs.existsSync(SUPERMEMORY_CAPTURE)) {
		console.log("  ⚠ Supermemory capture.ts not found — skipping patch")
		return false
	}

	const content = fs.readFileSync(SUPERMEMORY_CAPTURE, "utf-8")
	if (content.includes(MARKER)) {
		console.log("  ✓ Supermemory capture patch already applied")
		return true
	}

	const oldSig = "return async (event: Record<string, unknown>) => {"
	if (!content.includes(oldSig)) {
		console.log("  ⚠ Supermemory capture signature changed — manual patch needed")
		return false
	}

	const newSig = `return async (event: Record<string, unknown>, ctx?: Record<string, unknown>) => {\n\t\t// ${MARKER} for researcher sub-agents\n\t\tif ((ctx as any)?.agentId === "researcher") return\n`
	const patched = content.replace(oldSig, newSig)
	fs.writeFileSync(SUPERMEMORY_CAPTURE, patched, "utf-8")
	console.log("  ✓ Supermemory capture patch applied")
	return true
}

export function registerSetupCli(api: OpenClawPluginApi): void {
	api.registerCli(
		({ program }: { program: any }) => {
			const cmd = program
				.command("deep-research")
				.description("Deep Research plugin management")

			cmd
				.command("setup")
				.description("Install deep research skill, workspace and configuration")
				.action(async () => {
					console.log("\n🔬 Deep Research Setup\n")

					// 1. Install SKILL.md
					console.log("Installing skill...")
					if (copyAsset("SKILL.md", `${SKILL_DIR}/SKILL.md`)) {
						console.log(`  ✓ SKILL.md → ${SKILL_DIR}/`)
					}

					// 2. Install workspace-researcher
					console.log("\nInstalling researcher workspace...")
					if (!fs.existsSync(WORKSPACE_RESEARCHER)) {
						fs.mkdirSync(WORKSPACE_RESEARCHER, { recursive: true })
					}
					if (copyAsset("researcher-prompt.md", `${WORKSPACE_RESEARCHER}/AGENTS.md`)) {
						console.log(`  ✓ AGENTS.md → ${WORKSPACE_RESEARCHER}/`)
					}
					// Minimal TOOLS.md
					const toolsMd = "# Tools\n\nВсе инструменты и их документация описаны в AGENTS.md.\n"
					fs.writeFileSync(`${WORKSPACE_RESEARCHER}/TOOLS.md`, toolsMd, "utf-8")
					console.log(`  ✓ TOOLS.md → ${WORKSPACE_RESEARCHER}/`)

					// 3. Patch openclaw.json
					console.log("\nUpdating openclaw.json...")
					const config = readConfig()
					const changes = patchConfig(config)
					if (changes.length > 0) {
						writeConfig(config)
						for (const c of changes) console.log(`  ✓ ${c}`)
					} else {
						console.log("  ✓ Configuration already up to date")
					}

					// 4. Patch Supermemory
					console.log("\nPatching Supermemory capture...")
					patchSupermemory()

					// 5. Create INDEX.md if missing
					const indexPath = `${OPENCLAW_DIR}/workspace/memory/research/INDEX.md`
					if (!fs.existsSync(indexPath)) {
						console.log("\nCreating INDEX.md...")
						const indexDir = path.dirname(indexPath)
						if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true })
						const date = new Date().toISOString().split("T")[0]
						fs.writeFileSync(
							indexPath,
							`# Research Index\n\nАвтоматически обновляемый индекс исследований.\nПоследнее обновление: ${date}\n\n---\n`,
							"utf-8",
						)
						console.log(`  ✓ ${indexPath}`)
					}

					console.log("\n✓ Setup complete!")
					console.log("  Restart OpenClaw to apply: openclaw gateway --force\n")
				})

			cmd
				.command("status")
				.description("Check deep research configuration")
				.action(async () => {
					console.log("\n🔬 Deep Research Status\n")

					// Check config
					const config = readConfig()
					const hasAgent = config.agents?.list?.some((a: any) => a.id === "researcher")
					const hasAllow = config.agents?.defaults?.subagents?.allowAgents?.includes("researcher")
					const hasExec = config.tools?.subagents?.tools?.allow?.includes("exec")
					const hasPlugin = !!config.plugins?.entries?.["openclaw-deep-research"]

					console.log(`  Config:`)
					console.log(`    agents.list[researcher]:  ${hasAgent ? "✓" : "✗"}`)
					console.log(`    allowAgents[researcher]:  ${hasAllow ? "✓" : "✗"}`)
					console.log(`    exec in allow-list:       ${hasExec ? "✓" : "✗"}`)
					console.log(`    plugin entry:             ${hasPlugin ? "✓" : "✗"}`)

					// Check files
					console.log(`\n  Files:`)
					const files = [
						[`${SKILL_DIR}/SKILL.md`, "Skill (SKILL.md)"],
						[`${WORKSPACE_RESEARCHER}/AGENTS.md`, "Researcher prompt (AGENTS.md)"],
						[`${WORKSPACE_RESEARCHER}/TOOLS.md`, "Researcher TOOLS.md"],
						[`${OPENCLAW_DIR}/workspace/memory/research/INDEX.md`, "INDEX.md"],
					]
					for (const [p, label] of files) {
						const exists = fs.existsSync(p)
						console.log(`    ${label}: ${exists ? "✓" : "✗"}`)
					}

					// Check supermemory patch
					console.log(`\n  Supermemory patch:`)
					if (fs.existsSync(SUPERMEMORY_CAPTURE)) {
						const content = fs.readFileSync(SUPERMEMORY_CAPTURE, "utf-8")
						const patched = content.includes("Deep Research: block capture")
						console.log(`    capture.ts: ${patched ? "✓ patched" : "✗ not patched"}`)
					} else {
						console.log("    capture.ts: ⚠ file not found")
					}

					console.log("")
				})

			cmd
				.command("update-prompt")
				.description("Update researcher prompt from plugin assets")
				.action(async () => {
					console.log("\nUpdating researcher prompt...")
					if (copyAsset("researcher-prompt.md", `${WORKSPACE_RESEARCHER}/AGENTS.md`)) {
						console.log(`  ✓ AGENTS.md updated`)
					}
					if (copyAsset("SKILL.md", `${SKILL_DIR}/SKILL.md`)) {
						console.log(`  ✓ SKILL.md updated`)
					}
					console.log("")
				})
		},
		{ commands: ["deep-research"] },
	)
}
