import type { OpenClawPluginApi } from "openclaw/plugin-sdk"
import { registerSetupCli } from "./commands/cli.ts"
import { updateIndexOnComplete } from "./lib/index-manager.ts"
import { buildBrief, readProgress, findUnackedCommands } from "./lib/coordinator.ts"

export default {
	id: "openclaw-deep-research",
	name: "Deep Research",
	description: "Autonomous deep research with sub-agents",

	register(api: OpenClawPluginApi) {
		// CLI commands: openclaw deep-research setup/status/update-prompt
		registerSetupCli(api)

		// Hook: before_agent_start — inject dynamic context for researcher
		api.on("before_agent_start", async (event: Record<string, unknown>, ctx: Record<string, unknown>) => {
			if (ctx?.agentId !== "researcher") return
			const date = new Date().toISOString().split("T")[0]
			const dynamicCtx = `<research-runtime>\nDate: ${date}\n</research-runtime>`
			return { prependContext: dynamicCtx }
		})

		// Hook: agent_end — update INDEX.md on researcher completion
		api.on("agent_end", async (event: Record<string, unknown>, ctx: Record<string, unknown>) => {
			if (ctx?.agentId !== "researcher") return
			try {
				const label = ctx.label as string | undefined
				if (label && label.startsWith("research-")) {
					const slug = label.replace("research-", "")
					await updateIndexOnComplete(slug)
				}
			} catch (err) {
				api.logger.error("deep-research: INDEX update failed", err)
			}
		})

		// Hook: before_tool_call — log exec calls from researcher (debug)
		api.on("before_tool_call", async (event: Record<string, unknown>, ctx: Record<string, unknown>) => {
			if (ctx?.agentId !== "researcher") return
			if (event.toolName === "exec") {
				api.logger.debug(`researcher exec: ${JSON.stringify(event.params).slice(0, 200)}`)
			}
		})

		// Slash command: /research
		api.registerCommand({
			name: "research",
			description: "Start a deep research session. Usage: /research <topic>",
			handler: async (args: string, ctx: Record<string, unknown>) => {
				if (!args || !args.trim()) {
					return { text: "Usage: /research <topic>\nExample: /research сравнение web frameworks 2026" }
				}

				const topic = args.trim()
				const slug = topic
					.toLowerCase()
					.replace(/[^a-zа-яё0-9\s-]/gi, "")
					.replace(/\s+/g, "-")
					.slice(0, 60)

				const date = new Date().toISOString().split("T")[0]
				const researchDir = `/root/.openclaw/workspace/memory/research/${slug}`
				const experiencePath = `/root/.openclaw/workspace/research/experience/${slug}.md`

				const brief = buildBrief(topic)

				return {
					text: [
						`## Deep Research: ${topic}`,
						"",
						`**Slug:** ${slug}`,
						`**Dir:** ${researchDir}`,
						`**Model:** agents.defaults.subagents (openai-codex/gpt-5.3-codex, thinking: xhigh)`,
						"",
						"**Brief:**",
						brief,
						"",
						"---",
						"Обсуди brief со Степаном, уточни вопросы. Когда готов — создай файлы и запусти:",
						"",
						"```",
						`# 1. Создать файлы`,
						`mkdir -p "${researchDir}"`,
						`# write research.md с заполненным brief`,
						`# write progress.md (пустой шаблон)`,
						"",
						`# 2. Обновить INDEX.md (статус: в процессе)`,
						"",
						`# 3. Запустить субагент`,
						`sessions_spawn(`,
						`  task: "<задание с темой, brief, путями, режимом extraction>",`,
						`  agentId: "researcher",`,
						`  model: "openai-codex/gpt-5.3-codex",`,
						`  thinking: "xhigh",`,
						`  label: "research-${slug}",`,
						`  cleanup: "keep",`,
						`  runTimeoutSeconds: 7200`,
						`)`,
						"```",
					].join("\n"),
				}
			},
		})

		// Slash command: /research_status
		api.registerCommand({
			name: "research_status",
			description: "Check status of active researches",
			handler: async (args: string, ctx: Record<string, unknown>) => {
				try {
					const { readIndexEntries } = await import("./lib/index-manager.ts")
					const entries = await readIndexEntries()
					const active = entries.filter((e) => e.status === "в процессе")

					if (active.length === 0) {
						return { text: "Нет активных ресёрчей." }
					}

					const lines = ["## Активные ресёрчи", ""]
					for (const entry of active) {
						lines.push(`### ${entry.slug}`)
						lines.push(`Дата: ${entry.date} | Путь: ${entry.path}`)

						try {
							const progressEntries = await readProgress(`/root/.openclaw/workspace/${entry.path}`)
							const last = progressEntries[progressEntries.length - 1]
							if (last) {
								lines.push(`Последний прогресс: ${last.type} — ${last.content.slice(0, 200)}`)
							}
							const unacked = findUnackedCommands(progressEntries)
							if (unacked.length > 0) {
								lines.push(`!! Есть команды без ACK: ${unacked.length}`)
							}
						} catch {
							lines.push("(progress.md не найден)")
						}
						lines.push("")
					}

					return { text: lines.join("\n") }
				} catch (err) {
					return { text: `Ошибка чтения INDEX.md: ${err}` }
				}
			},
		})

		api.logger.info("deep-research: plugin loaded")
	},
}
