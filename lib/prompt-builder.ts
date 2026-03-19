import { readFileSync } from "node:fs"
import * as path from "node:path"

// Путь к папке assets плагина
const PLUGIN_DIR = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const ASSETS_DIR = `${PLUGIN_DIR}/assets`

// Маппинг: ключ конфига → имя файла в assets/tools/
const TOOL_FILES: Record<string, string> = {
	exa: "exa.md",
	scrapfly: "scrapfly.md",
	brave: "brave.md",
	ref: "ref.md",
	"agent-browser": "agent-browser.md",
	onepassword: "onepassword.md",
}

// Ключевые слова для вырезания строк из каскадов
const TOOL_CASCADE_KEYWORDS: Record<string, string[]> = {
	exa: ["Exa", "crawling_exa", "deep_search_exa", "web_search_exa", "get_code_context_exa", "company_research_exa", "linkedin_search_exa"],
	scrapfly: ["ScrapFly", "web_get_page", "web_scrape"],
	brave: ["Brave"],
	ref: ["Ref", "ref_read_url", "ref_search_documentation"],
	"agent-browser": ["agent-browser"],
	onepassword: [],
}

// Конфиг инструментов по умолчанию (все включены)
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

// Читает файл, возвращает содержимое или пустую строку
function readAsset(filename: string): string {
	try {
		return readFileSync(`${ASSETS_DIR}/${filename}`, "utf-8")
	} catch {
		return ""
	}
}

// Вырезает строки из каскадов, содержащие ключевые слова выключенных инструментов
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
			// Не трогаем заголовки и пустые строки
			if (line.startsWith("#") || line.trim() === "" || line.trim() === "```") return true
			// Убираем строки содержащие ключевые слова выключенных инструментов
			return !keywords.some((kw) => line.includes(kw))
		})
		.join("\n")
}

// Собирает полный промпт researcher-а из блоков
export function buildResearcherPrompt(toolsConfig?: ToolsConfig): string {
	const config = { ...DEFAULT_CONFIG, ...toolsConfig }

	// 1. Базовый промпт
	let base = readAsset("base-prompt.md")

	// 2. Собираем блоки инструментов
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

	// 3. Каскады с фильтрацией
	let cascades = readAsset("cascades.md")
	if (disabledTools.length > 0) {
		cascades = filterCascades(cascades, disabledTools)
	}

	// 4. Experience инструкции (всегда включены)
	const experience = readAsset("experience-instructions.md")

	// 5. Подставляем в шаблон
	base = base.replace("{{TOOLS}}", toolsBlock)
	base = base.replace("{{CASCADES}}", cascades)
	base = base.replace("{{EXPERIENCE}}", experience)

	return base
}
