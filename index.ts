// Импортируем тип API плагина из OpenClaw SDK
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core"
// Функция для определения домашней директории пользователя (~/)
import { homedir } from "node:os"

// Импорт наших модулей:
// - registerSetupCli: регистрирует CLI-команды (openclaw deep-research setup/status/...)
import { registerSetupCli } from "./commands/cli.ts"
// - updateIndexOnComplete: обновляет INDEX.md когда исследование завершено
import { updateIndexOnComplete } from "./lib/index-manager.ts"
// - buildBrief: создаёт шаблон брифа для исследования
// - readProgress: читает progress.md и парсит записи прогресса
// - findUnackedCommands: ищет команды в progress.md на которые агент не ответил
import { buildBrief, readProgress, findUnackedCommands } from "./lib/coordinator.ts"

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
		//   openclaw deep-research setup   — установка
		//   openclaw deep-research status  — проверка
		//   openclaw deep-research update-prompt — обновить промпт
		// Логика в отдельном файле commands/cli.ts
		// --------------------------------------------------
		registerSetupCli(api)

		// --------------------------------------------------
		// 2. ХУК: ПЕРЕД ПОСТРОЕНИЕМ ПРОМПТА
		// Срабатывает каждый раз перед запуском любого агента.
		// Мы проверяем — если это наш агент "researcher",
		// то добавляем ему в начало промпта текущую дату.
		// Для всех остальных агентов — просто выходим (return без значения).
		// --------------------------------------------------
		api.on("before_prompt_build", async (event: any, ctx: any) => {
			// Не наш агент — пропускаем
			if (ctx?.agentId !== "researcher") return

			// Формируем строку с текущей датой
			const date = new Date().toISOString().split("T")[0]
			const dynamicCtx = `<research-runtime>\nDate: ${date}\n</research-runtime>`

			// prependContext — OpenClaw вставит этот текст в начало промпта агента
			return { prependContext: dynamicCtx }
		})

		// --------------------------------------------------
		// 3. ХУК: ПОСЛЕ ЗАВЕРШЕНИЯ АГЕНТА
		// Когда любой агент заканчивает работу — проверяем,
		// был ли это наш researcher. Если да — обновляем INDEX.md:
		// ставим статус "завершён" и подтягиваем summary из research.md
		// --------------------------------------------------
		api.on("agent_end", async (event: any, ctx: any) => {
			// Не наш агент — пропускаем
			if (ctx?.agentId !== "researcher") return

			try {
				// label имеет формат "research-<slug>", например "research-web-frameworks-2026"
				const label = ctx.label as string | undefined
				if (label && label.startsWith("research-")) {
					// Извлекаем slug (имя исследования) из label
					const slug = label.replace("research-", "")
					// Обновляем запись в INDEX.md — статус "завершён" + summary
					await updateIndexOnComplete(slug)
				}
			} catch (err) {
				api.logger.error("deep-research: INDEX update failed", err)
			}
		})

		// --------------------------------------------------
		// 4. ХУК: ПЕРЕД ВЫЗОВОМ ИНСТРУМЕНТА (дебаг)
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
		// 5. СЛЕШ-КОМАНДА: /research <тема>
		// Пользователь пишет в чат: /research сравнение web frameworks 2026
		//
		// Плагин НЕ запускает исследование сам — он генерирует
		// инструкцию для главного агента с брифом и планом действий.
		// Агент потом сам создаёт файлы и запускает субагент-researcher.
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

				const date = new Date().toISOString().split("T")[0]

				// Пути к файлам исследования
				const openclawDir = `${homedir()}/.openclaw`
				const researchDir = `${openclawDir}/workspace/memory/research/${slug}`
				const experiencePath = `${openclawDir}/workspace/research/experience/${slug}.md`

				// Создаём brief — шаблон задания для исследования
				const brief = buildBrief(topic)

				// Возвращаем текстовое сообщение — инструкцию для агента
				// Агент прочитает это и выполнит шаги: создаст файлы, обновит INDEX, запустит субагент
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

		// --------------------------------------------------
		// 6. СЛЕШ-КОМАНДА: /research_status
		// Показывает список активных исследований.
		// Читает INDEX.md, фильтрует "в процессе",
		// для каждого подтягивает последний прогресс из progress.md.
		// --------------------------------------------------
		api.registerCommand({
			name: "research_status",
			description: "Check status of active researches",
			// acceptsArgs не нужен — команда без аргументов
			handler: async (ctx: any) => {
				try {
					// Динамический импорт — чтобы не грузить модуль если команду не вызвали
					const { readIndexEntries } = await import("./lib/index-manager.ts")

					// Читаем все записи из INDEX.md
					const entries = await readIndexEntries()
					// Оставляем только те, что ещё в процессе
					const active = entries.filter((e) => e.status === "в процессе")

					if (active.length === 0) {
						return { text: "Нет активных ресёрчей." }
					}

					// Формируем текстовый отчёт
					const lines = ["## Активные ресёрчи", ""]
					for (const entry of active) {
						lines.push(`### ${entry.slug}`)
						lines.push(`Дата: ${entry.date} | Путь: ${entry.path}`)

						try {
							// Читаем progress.md этого исследования
							const progressEntries = await readProgress(`${homedir()}/.openclaw/workspace/${entry.path}`)
							// Показываем последнюю запись прогресса
							const last = progressEntries[progressEntries.length - 1]
							if (last) {
								lines.push(`Последний прогресс: ${last.type} — ${last.content.slice(0, 200)}`)
							}
							// Проверяем — есть ли команды без ответа (ACK)
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

		// Лог при успешной загрузке плагина
		api.logger.info("deep-research: plugin loaded")
	},
}
