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

		// Координатор (главный агент) сам определяет когда запускать ресёрч
		// по SKILL.md — без отдельной слеш-команды.
		// Пользователь просто пишет в чат "исследуй тему X".

		// Лог при успешной загрузке плагина
		api.logger.info("deep-research: plugin loaded")
	},
}
