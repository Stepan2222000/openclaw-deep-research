// Стандартные модули Node.js
import { readFileSync, readdirSync } from "node:fs"
import * as path from "node:path"

// ========================================
// ПУТИ
// ========================================

// Путь к папке assets плагина (вычисляется от текущего файла — lib/ → корень плагина)
const PLUGIN_DIR = path.dirname(path.dirname(new URL(import.meta.url).pathname))
// Все markdown-блоки промпта лежат тут
const ASSETS_DIR = `${PLUGIN_DIR}/assets`

// ========================================
// МАППИНГ ИНСТРУМЕНТОВ
// Ключ конфига → имя файла в assets/tools/
// Каждый файл содержит документацию одного инструмента для researcher-а.
// ========================================
const TOOL_FILES: Record<string, string> = {
	exa: "exa.md",
	scrapfly: "scrapfly.md",
	brave: "brave.md",
	ref: "ref.md",
	"agent-browser": "agent-browser.md",
	onepassword: "onepassword.md",
}

// ========================================
// КЛЮЧЕВЫЕ СЛОВА ДЛЯ ФИЛЬТРАЦИИ КАСКАДОВ
// Когда инструмент выключен — строки с этими словами
// вырезаются из cascades.md (деревья решений).
// Например: scrapfly выключен → убираем все строки с "ScrapFly", "web_get_page", "web_scrape"
// ========================================
const TOOL_CASCADE_KEYWORDS: Record<string, string[]> = {
	exa: ["Exa", "crawling_exa", "deep_search_exa", "web_search_exa", "get_code_context_exa", "company_research_exa", "linkedin_search_exa"],
	scrapfly: ["ScrapFly", "web_get_page", "web_scrape"],
	brave: ["Brave"],
	ref: ["Ref", "ref_read_url", "ref_search_documentation"],
	"agent-browser": ["agent-browser"],
	onepassword: [], // Нет в каскадах — нечего вырезать
}

// ========================================
// КОНФИГ ИНСТРУМЕНТОВ
// Пользователь включает/выключает в openclaw.json:
//   plugins.entries.openclaw-deep-research.config.tools.scrapfly = false
// Все включены по умолчанию.
// ========================================
export interface ToolsConfig {
	exa?: boolean
	scrapfly?: boolean
	brave?: boolean
	ref?: boolean
	"agent-browser"?: boolean
	onepassword?: boolean
}

const DEFAULT_CONFIG: Required<ToolsConfig> = {
	exa: true,
	scrapfly: true,
	brave: true,
	ref: true,
	"agent-browser": true,
	onepassword: true,
}

// ========================================
// НАТИВНЫЕ TOOLS OPENCLAW
// Некоторые инструменты — нативные tools OpenClaw (не через mcporter/exec).
// Их нужно добавить в tools.subagents.tools.allow чтобы researcher мог их использовать.
// Маппинг: ключ конфига → массив нативных tool names.
// web_fetch добавляется всегда (не привязан к toggle).
// ========================================
export const NATIVE_TOOLS: Record<string, string[]> = {
	brave: ["web_search"],
}

// ========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ========================================

// Читает файл из assets/, возвращает содержимое или пустую строку если файл не найден
function readAsset(filename: string): string {
	try {
		return readFileSync(`${ASSETS_DIR}/${filename}`, "utf-8")
	} catch {
		return ""
	}
}

// Вырезает строки из каскадов, содержащие ключевые слова выключенных инструментов.
// Заголовки, пустые строки и маркеры ``` не трогаем — только строки с упоминаниями инструментов.
function filterCascades(cascadesContent: string, disabledTools: string[]): string {
	const keywords: string[] = []
	for (const tool of disabledTools) {
		const kw = TOOL_CASCADE_KEYWORDS[tool]
		if (kw) keywords.push(...kw)
	}
	if (keywords.length === 0) return cascadesContent

	return cascadesContent
		.split("\n")
		.filter((line) => {
			if (line.startsWith("#") || line.trim() === "" || line.trim() === "```") return true
			return !keywords.some((kw) => line.includes(kw))
		})
		.join("\n")
}

// ========================================
// СБОРКА ПРОМПТА
// Главная функция — собирает AGENTS.md для researcher-а из блоков.
// Вызывается из commands/cli.ts при setup.
//
// Алгоритм:
// 1. Читает base-prompt.md (база: кто ты, ограничения, протокол, цикл, форматы, правила)
// 2. Для каждого включённого инструмента читает assets/tools/<name>.md
// 3. Читает cascades.md и вырезает строки с выключенными инструментами
// 4. Читает experience-instructions.md (всегда включён)
// 5. Читает все .md из assets/examples/ (примеры правильной работы)
// 6. Подставляет всё в плейсхолдеры {{TOOLS}}, {{CASCADES}}, {{EXPERIENCE}}, {{EXAMPLES}}
// ========================================
export function buildResearcherPrompt(toolsConfig?: ToolsConfig): string {
	const config = { ...DEFAULT_CONFIG, ...toolsConfig }

	// 1. Базовый промпт с плейсхолдерами
	let base = readAsset("base-prompt.md")

	// 2. Собираем блоки включённых инструментов
	const toolSections: string[] = []
	const disabledTools: string[] = []

	for (const [toolId, filename] of Object.entries(TOOL_FILES)) {
		if (config[toolId as keyof ToolsConfig]) {
			const content = readAsset(`tools/${filename}`)
			if (content) toolSections.push(content)
		} else {
			disabledTools.push(toolId)
		}
	}

	const toolsBlock = toolSections.join("\n\n")

	// 3. Каскады — вырезаем выключенные инструменты
	let cascades = readAsset("cascades.md")
	if (disabledTools.length > 0) {
		cascades = filterCascades(cascades, disabledTools)
	}

	// 4. Experience инструкции (всегда включены — не зависят от конфига)
	const experience = readAsset("experience-instructions.md")

	// 5. Примеры правильной работы — читаем все .md из assets/examples/
	// Новые примеры добавляются просто кладя файл в папку — подхватываются автоматически
	let examples = ""
	try {
		const examplesDir = `${ASSETS_DIR}/examples`
		const files = readdirSync(examplesDir).filter((f: string) => f.endsWith(".md")).sort()
		const sections = files.map((f: string) => readAsset(`examples/${f}`)).filter(Boolean)
		if (sections.length > 0) {
			examples = `## Примеры правильной работы\n\n${sections.join("\n\n")}`
		}
	} catch {
		// Папка examples/ не существует — пропускаем
	}

	// 6. Подставляем в плейсхолдеры
	base = base.replace("{{TOOLS}}", toolsBlock)
	base = base.replace("{{CASCADES}}", cascades)
	base = base.replace("{{EXPERIENCE}}", experience)
	base = base.replace("{{EXAMPLES}}", examples)

	return base
}
