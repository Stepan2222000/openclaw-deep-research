// Стандартные модули Node.js для работы с файлами и путями
import * as fs from "node:fs"
import * as path from "node:path"
// homedir() возвращает домашнюю директорию: /root, /home/user, /Users/stepan и т.д.
import { homedir } from "node:os"
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core"
import { buildResearcherPrompt } from "../lib/prompt-builder.ts"

// ========================================
// ПУТИ — все ключевые директории и файлы
// ========================================

// Корневая папка OpenClaw (~/.openclaw)
const OPENCLAW_DIR = `${homedir()}/.openclaw`
// Главный конфиг OpenClaw — тут настройки агентов, плагинов, инструментов
const CONFIG_PATH = `${OPENCLAW_DIR}/openclaw.json`
// Рабочая директория субагента-researcher (его AGENTS.md и TOOLS.md лежат тут)
const WORKSPACE_RESEARCHER = `${OPENCLAW_DIR}/workspace-researcher`
// Путь к самому плагину (вычисляется из текущего файла — поднимаемся на 2 уровня вверх)
const PLUGIN_DIR = path.dirname(path.dirname(new URL(import.meta.url).pathname))
// Канонический путь к coordinator skill — OpenClaw загрузит его по manifest.skills
const PLUGIN_SKILL_PATH = `${PLUGIN_DIR}/skills/deep-research/SKILL.md`


// ========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ========================================

// Читает openclaw.json и возвращает объект конфига
// Если файла нет или он битый — возвращает пустой объект
function readConfig(): Record<string, any> {
	if (!fs.existsSync(CONFIG_PATH)) return {}
	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))
	} catch {
		return {}
	}
}

// Записывает объект конфига обратно в openclaw.json (с отступами для читаемости)
function writeConfig(config: Record<string, any>): void {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8")
}

// ========================================
// ПАТЧ КОНФИГА openclaw.json
// Добавляет всё необходимое для работы плагина.
// Возвращает список изменений (строки) — для вывода в консоль.
// Если всё уже настроено — возвращает пустой массив.
// ========================================
function patchConfig(config: Record<string, any>): string[] {
	const changes: string[] = []

	// Создаём секции если их нет
	if (!config.agents) config.agents = {}
	if (!config.agents.list) config.agents.list = []
	if (!config.plugins) config.plugins = {}
	if (!config.plugins.entries) config.plugins.entries = {}

	// --- 0. Гарантируем plugin entry ---
	// setup должен включать плагин и давать стабильную точку для plugin config
	let pluginEntry = config.plugins.entries["openclaw-deep-research"]
	if (!pluginEntry) {
		pluginEntry = { enabled: true, config: {} }
		config.plugins.entries["openclaw-deep-research"] = pluginEntry
		changes.push("plugins.entries: added openclaw-deep-research")
	}
	if (pluginEntry.enabled !== true) {
		pluginEntry.enabled = true
		changes.push("plugins.entries[openclaw-deep-research].enabled: set to true")
	}
	if (!pluginEntry.config) {
		pluginEntry.config = {}
	}

	// --- 1. Добавляем агента "researcher" в список агентов ---
	// Это субагент, который будет выполнять исследования автономно
	const existingResearcher = config.agents.list.find((a: any) => a.id === "researcher")
	if (!existingResearcher) {
		config.agents.list.push({
			id: "researcher",
			// workspace — директория с промптом агента (AGENTS.md)
			workspace: WORKSPACE_RESEARCHER,
			// researcher сам не может запускать субагентов (пустой список)
			subagents: { allowAgents: [] },
		})
		changes.push("agents.list: added researcher agent")
	}

	// --- 2. Разрешаем дефолтному агенту запускать researcher ---
	// Без этого главный агент не сможет вызвать sessions_spawn с agentId: "researcher"
	const defaultAgent = config.agents.list.find((a: any) => a.default === true || a.id === "default")
	if (!defaultAgent) {
		throw new Error("Default agent not found in agents.list. OpenClaw must have a default agent configured.")
	}
	// Добавляем "researcher" в allowAgents если ещё нет
	if (!defaultAgent.subagents) defaultAgent.subagents = {}
	const allowedAgents: string[] = defaultAgent.subagents.allowAgents || []
	if (!allowedAgents.includes("researcher")) {
		allowedAgents.push("researcher")
		defaultAgent.subagents.allowAgents = allowedAgents
		changes.push('agents.list[default].subagents.allowAgents: added "researcher"')
	}

	// --- 3. Увеличиваем лимит символов для промпта агента ---
	// Промпт researcher-а ~26K символов, стандартный лимит слишком мал
	if (!config.agents.defaults) config.agents.defaults = {}
	if (!config.agents.defaults.bootstrapMaxChars || config.agents.defaults.bootstrapMaxChars < 40000) {
		config.agents.defaults.bootstrapMaxChars = 40000
		changes.push("agents.defaults.bootstrapMaxChars: set to 40000")
	}

	// --- 3.5. Держим subagent-сессии очень долго ---
	// OpenClaw archiveAfterMinutes должен быть > 0,
	// поэтому ставим год хранения для продолжения ресёрчей.
	const RESEARCH_SESSION_RETENTION_MINUTES = 60 * 24 * 365
	if (!config.agents.defaults.subagents) config.agents.defaults.subagents = {}
	if (config.agents.defaults.subagents.archiveAfterMinutes !== RESEARCH_SESSION_RETENTION_MINUTES) {
		config.agents.defaults.subagents.archiveAfterMinutes = RESEARCH_SESSION_RETENTION_MINUTES
		changes.push(`agents.defaults.subagents.archiveAfterMinutes: set to ${RESEARCH_SESSION_RETENTION_MINUTES}`)
	}

	// --- 4. Разрешаем субагентам использовать инструмент exec ---
	// exec — выполнение shell-команд. Researcher-у он нужен для работы.
	if (!config.tools) config.tools = {}
	if (!config.tools.subagents) config.tools.subagents = {}
	if (!config.tools.subagents.tools) config.tools.subagents.tools = {}
	const allowedTools: string[] = config.tools.subagents.tools.allow || []
	if (!allowedTools.includes("exec")) {
		allowedTools.push("exec")
		config.tools.subagents.tools.allow = allowedTools
		changes.push('tools.subagents.tools.allow: added "exec"')
	}

	return changes
}

// ========================================
// ГЛАВНАЯ ФУНКЦИЯ — РЕГИСТРАЦИЯ CLI-КОМАНД
// Вызывается из index.ts при загрузке плагина.
// Регистрирует команду "deep-research" с двумя подкомандами:
//   openclaw deep-research setup
//   openclaw deep-research status
// ========================================
export function registerSetupCli(api: OpenClawPluginApi): void {
	api.registerCli(
		({ program }: { program: any }) => {
			// Корневая команда
			const cmd = program
				.command("deep-research")
				.description("Deep Research plugin management")

			// --------------------------------------------------
			// ПОДКОМАНДА: setup
			// Полная установка плагина — собирает workspace researcher-а и патчит конфиг.
			// Запускается один раз после установки плагина.
			// --------------------------------------------------
			cmd
				.command("setup")
				.description("Install deep research workspace and configuration")
				.action(async () => {
					console.log("\n🔬 Deep Research Setup\n")

					// Шаг 1: Читаем и патчим конфиг.
					// Сначала гарантируем plugin entry, чтобы prompt собирался
					// уже из актуального config.plugins.entries[pluginId].config.
					console.log("Updating openclaw.json...")
					const config = readConfig()
					const changes = patchConfig(config)
					const pluginCfg = config.plugins.entries["openclaw-deep-research"]?.config

					// Шаг 2: Создаём рабочую директорию researcher-а и собираем промпт
					// Промпт собирается из блоков (base + включённые инструменты + каскады)
					// и записывается в AGENTS.md как системный промпт субагента.
					console.log("\nInstalling researcher workspace...")
					if (!fs.existsSync(WORKSPACE_RESEARCHER)) {
						fs.mkdirSync(WORKSPACE_RESEARCHER, { recursive: true })
					}
					const researcherPrompt = buildResearcherPrompt(pluginCfg?.tools)
					fs.writeFileSync(`${WORKSPACE_RESEARCHER}/AGENTS.md`, researcherPrompt, "utf-8")
					console.log(`  ✓ AGENTS.md → ${WORKSPACE_RESEARCHER}/ (${researcherPrompt.length} chars)`)
					const toolsMd = "# Tools\n\nИнструменты описаны в AGENTS.md.\n"
					fs.writeFileSync(`${WORKSPACE_RESEARCHER}/TOOLS.md`, toolsMd, "utf-8")
					console.log(`  ✓ TOOLS.md → ${WORKSPACE_RESEARCHER}/`)

					// Шаг 3: Записываем патченный конфиг одним проходом
					if (changes.length > 0) {
						writeConfig(config)
						for (const c of changes) console.log(`  ✓ ${c}`)
					} else {
						console.log("  ✓ Configuration already up to date")
					}

					// Шаг 4: Создаём INDEX.md если его ещё нет
					// INDEX.md — реестр всех исследований (статус, дата, путь)
					const indexPath = `/root/another-openclaw/research/INDEX.md`
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

			// --------------------------------------------------
			// ПОДКОМАНДА: status
			// Проверяет что всё установлено правильно.
			// Показывает галочки/крестики для каждого компонента.
			// --------------------------------------------------
			cmd
				.command("status")
				.description("Check deep research configuration")
				.action(async () => {
					console.log("\n🔬 Deep Research Status\n")

					// Проверяем конфиг: есть ли агент researcher, разрешения, плагин
					const config = readConfig()
					const hasAgent = config.agents?.list?.some((a: any) => a.id === "researcher")
					const defaultAgent = config.agents?.list?.find((a: any) => a.default === true || a.id === "default")
					const hasAllow = defaultAgent?.subagents?.allowAgents?.includes("researcher")
					const hasExec = config.tools?.subagents?.tools?.allow?.includes("exec")
					const hasPlugin = !!config.plugins?.entries?.["openclaw-deep-research"]

					console.log(`  Config:`)
					console.log(`    agents.list[researcher]:  ${hasAgent ? "✓" : "✗"}`)
					console.log(`    allowAgents[researcher]:  ${hasAllow ? "✓" : "✗"}`)
					console.log(`    exec in allow-list:       ${hasExec ? "✓" : "✗"}`)
					console.log(`    plugin entry:             ${hasPlugin ? "✓" : "✗"}`)

					// Проверяем файлы: plugin skill, AGENTS.md, TOOLS.md, INDEX.md
					console.log(`\n  Files:`)
					const files = [
						[PLUGIN_SKILL_PATH, "Plugin skill (skills/deep-research/SKILL.md)"],
						[`${WORKSPACE_RESEARCHER}/AGENTS.md`, "Researcher prompt (AGENTS.md)"],
						[`${WORKSPACE_RESEARCHER}/TOOLS.md`, "Researcher TOOLS.md"],
						[`/root/another-openclaw/research/INDEX.md`, "INDEX.md"],
					]
					for (const [p, label] of files) {
						const exists = fs.existsSync(p)
						console.log(`    ${label}: ${exists ? "✓" : "✗"}`)
					}

					console.log("")
				})

		},
		// Регистрируем "deep-research" как CLI-команду OpenClaw
		{ commands: ["deep-research"] },
	)
}
