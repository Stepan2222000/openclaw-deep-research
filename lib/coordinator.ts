import { readFileSync, existsSync } from "node:fs"

export function buildBrief(topic: string, context?: string): string {
	const lines = [
		`Тема: ${topic}`,
		"",
		"Что нужно выяснить:",
		"1. [уточни вопросы со Степаном]",
		"",
		"Ожидаемый результат:",
		"- Структурированный отчёт с источниками",
	]
	if (context) {
		lines.push("", "Контекст:", context)
	}
	return lines.join("\n")
}

export interface SpawnTaskOptions {
	topic: string
	brief: string
	researchDir: string
	extractionMode: "DEFAULT" | "BROWSER_FIRST"
	experiencePath: string
	providedContext?: string
	followUp?: { basePath: string }
}

export function buildTask(opts: SpawnTaskOptions): string {
	const lines = [
		`Проведи глубокое исследование.`,
		"",
		`## Задание`,
		`**Тема:** ${opts.topic}`,
		`**Что нужно выяснить:** ${opts.brief}`,
		`**Файл результатов:** ${opts.researchDir}/research.md`,
		`**Файл прогресса:** ${opts.researchDir}/progress.md`,
		`**Файл опыта:** ${opts.experiencePath}`,
	]

	if (opts.extractionMode === "BROWSER_FIRST") {
		lines.push("")
		lines.push("## Режим extraction: BROWSER_FIRST")
		lines.push("Приоритет agent-browser. Просматривай все сайты через браузер. Другие инструменты — только для поиска.")
	}

	if (opts.providedContext) {
		lines.push("")
		lines.push("## Предоставленный контекст")
		lines.push(opts.providedContext)
	}

	if (opts.followUp) {
		lines.push("")
		lines.push("## Follow-up")
		lines.push(`Это follow-up исследование. Базовое исследование: ${opts.followUp.basePath}`)
		lines.push("")
		lines.push("Перед началом прочитай его. Используй как стартовую точку:")
		lines.push("- Sources из базы маркируй [BASE-S#], свои новые — [S1], [S2], ...")
		lines.push("- Не дублируй найденные факты — ссылайся на [BASE-S#]")
		lines.push("- Open Questions из базы, совпадающие с brief — попробуй закрыть")
		lines.push("- НЕ копируй всё подряд, бери только релевантное текущему brief")
	}

	lines.push("")
	lines.push("Начинай с понимания задания (Фаза 0), потом работай.")

	return lines.join("\n")
}

export interface ProgressEntry {
	time: string
	type: string
	content: string
}

export function readProgress(researchDir: string): ProgressEntry[] {
	const progressPath = `${researchDir}/progress.md`
	if (!existsSync(progressPath)) return []

	const content = readFileSync(progressPath, "utf-8")
	const entries: ProgressEntry[] = []

	// Parse entries between --- markers
	const blocks = content.split("---").filter((b) => b.trim())
	for (const block of blocks) {
		const trimmed = block.trim()
		// Match [HH:MM] TYPE pattern
		const match = trimmed.match(/^\[(\d{2}:\d{2})\]\s+(\w+)/)
		if (match) {
			entries.push({
				time: match[1],
				type: match[2],
				content: trimmed,
			})
		}
	}
	return entries
}

export function findUnackedCommands(entries: ProgressEntry[]): ProgressEntry[] {
	const commands = entries.filter((e) => e.type === "COMMAND")
	const acks = entries.filter((e) => e.type === "ACK")
	// Simple check: commands without a following ACK
	return commands.filter((cmd, i) => {
		const cmdIdx = entries.indexOf(cmd)
		const hasAck = acks.some((ack) => entries.indexOf(ack) > cmdIdx)
		return !hasAck
	})
}
