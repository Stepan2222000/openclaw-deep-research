// Импортируем тип API плагина из OpenClaw SDK
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core"

// Импорт наших модулей:
// - registerSetupCli: регистрирует CLI-команды (openclaw deep-research setup/status)
import { registerSetupCli } from "./commands/cli.ts"

// ========================================
// Главный экспорт плагина
// OpenClaw при загрузке ищет этот объект
// и вызывает register(api) для инициализации
// ========================================
export default {
	// Уникальный ID плагина — по нему OpenClaw его находит в конфиге
	id: "openclaw-deep-research",
	// Отображаемое имя в интерфейсе
	name: "Deep Research",
	// Описание для каталога плагинов
	description: "Autonomous deep research with sub-agents",

	// ========================================
	// Главная функция — вызывается один раз при старте Gateway
	// api — объект с методами для регистрации команд, хуков, инструментов
	// ========================================
	register(api: OpenClawPluginApi) {

		// --------------------------------------------------
		// 1. CLI-КОМАНДЫ
		// Регистрируем команды для терминала:
		//   openclaw deep-research setup   — установка и пересборка промпта
		//   openclaw deep-research status  — проверка конфигурации
		// Логика в отдельном файле commands/cli.ts
		// --------------------------------------------------
		registerSetupCli(api)

		// --------------------------------------------------
		// 2. ХУК: ПЕРЕД ВЫЗОВОМ ИНСТРУМЕНТА (дебаг)
		// Если researcher вызывает инструмент exec (выполнение команд),
		// логируем первые 200 символов параметров.
		// Нужно для отладки — чтобы видеть что researcher делает.
		// --------------------------------------------------
		api.on("before_tool_call", async (event: any, ctx: any) => {
			if (ctx?.agentId !== "researcher") return
			if (event.toolName === "exec") {
				api.logger.debug(`researcher exec: ${JSON.stringify(event.params).slice(0, 200)}`)
			}
		})

		// --------------------------------------------------
		// 3. СЛЕШ-КОМАНДА: /research <тема>
		// Пользователь пишет в чат: /research сравнение web frameworks 2026
		//
		// Плагин НЕ запускает исследование сам — он генерирует
		// инструкцию для координатора (главного агента).
		// Координатор сам составит brief, обсудит и запустит субагент.
		// --------------------------------------------------
		api.registerCommand({
			name: "research",
			description: "Start a deep research session. Usage: /research <topic>",
			// acceptsArgs: true — без этого /research тема НЕ сработает,
			// потому что по умолчанию команды не принимают аргументы
			acceptsArgs: true,
			// handler получает один объект ctx со всей информацией
			handler: async (ctx: any) => {
				// ctx.args — всё что после /research (тема исследования)
				const args = ctx.args?.trim()
				if (!args) {
					return { text: "Usage: /research <topic>\nExample: /research сравнение web frameworks 2026" }
				}

				const topic = args

				// Генерируем slug — короткое имя для папки и файлов
				// "Сравнение Web Frameworks 2026" → "сравнение-web-frameworks-2026"
				const slug = topic
					.toLowerCase()
					.replace(/[^a-zа-яё0-9\s-]/gi, "") // убираем спецсимволы
					.replace(/\s+/g, "-")                // пробелы → дефисы
					.slice(0, 60)                        // обрезаем до 60 символов

				// Пути к файлам исследования
				const researchDir = `/root/another-openclaw/research/${slug}`
				const experienceDir = `/root/another-openclaw/experience/`

				// Возвращаем текстовое сообщение — инструкцию для координатора
				return {
					text: [
						`## Deep Research: ${topic}`,
						"",
						`**Slug:** ${slug}`,
						`**Dir:** ${researchDir}`,
						`**Experience:** ${experienceDir}`,
						`**Model:** gpt-5.4, thinking: xhigh`,
						"",
						"Составь brief по SKILL.md, обсуди со Степаном, и запусти субагент.",
					].join("\n"),
				}
			},
		})

		// Лог при успешной загрузке плагина
		api.logger.info("deep-research: plugin loaded")
	},
}
