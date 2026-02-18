import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"

const INDEX_PATH = "/root/.openclaw/workspace/memory/research/INDEX.md"
const RESEARCH_BASE = "/root/.openclaw/workspace/memory/research"

export interface IndexEntry {
	slug: string
	date: string
	status: string
	summary: string
	path: string
}

/**
 * Parse INDEX.md in list format:
 * ## slug-name
 * - **Дата:** 2026-02-15
 * - **Статус:** завершён
 * - **Сводка:** Short summary text
 * - **Путь:** `memory/research/slug-name/`
 */
export function readIndexEntries(): IndexEntry[] {
	if (!existsSync(INDEX_PATH)) return []
	const content = readFileSync(INDEX_PATH, "utf-8")
	const entries: IndexEntry[] = []

	// Split by ## headings (level 2)
	const sections = content.split(/^## /m).filter((s) => s.trim())

	for (const section of sections) {
		const lines = section.split("\n")
		const slug = lines[0]?.trim()
		if (!slug || slug.startsWith("#")) continue // skip the main title

		const entry: IndexEntry = {
			slug,
			date: "",
			status: "",
			summary: "—",
			path: `memory/research/${slug}/`,
		}

		for (const line of lines) {
			const dateMatch = line.match(/\*\*Дата:\*\*\s*(.+)/)
			if (dateMatch) entry.date = dateMatch[1].trim()

			const statusMatch = line.match(/\*\*Статус:\*\*\s*(.+)/)
			if (statusMatch) entry.status = statusMatch[1].trim()

			const summaryMatch = line.match(/\*\*Сводка:\*\*\s*(.+)/)
			if (summaryMatch) entry.summary = summaryMatch[1].trim()

			const pathMatch = line.match(/\*\*Путь:\*\*\s*`?([^`]+)`?/)
			if (pathMatch) entry.path = pathMatch[1].trim()
		}

		if (entry.date) {
			entries.push(entry)
		}
	}
	return entries
}

function writeIndex(entries: IndexEntry[]): void {
	const dir = INDEX_PATH.substring(0, INDEX_PATH.lastIndexOf("/"))
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

	const sections = entries.map(
		(e) =>
			`## ${e.slug}\n- **Дата:** ${e.date}\n- **Статус:** ${e.status}\n- **Сводка:** ${e.summary}\n- **Путь:** \`${e.path}\``,
	)
	const date = new Date().toISOString().split("T")[0]
	const content = `# Research Index\n\nАвтоматически обновляемый индекс исследований.\nПоследнее обновление: ${date}\n\n---\n\n${sections.join("\n\n")}\n`
	writeFileSync(INDEX_PATH, content, "utf-8")
}

export function addEntry(slug: string, status: string, summary: string): void {
	const entries = readIndexEntries()
	const date = new Date().toISOString().split("T")[0]
	const path = `memory/research/${slug}/`
	entries.push({ slug, date, status, summary, path })
	writeIndex(entries)
}

export function updateEntry(slug: string, updates: Partial<Pick<IndexEntry, "status" | "summary">>): void {
	const entries = readIndexEntries()
	const entry = entries.find((e) => e.slug === slug)
	if (!entry) return
	if (updates.status) entry.status = updates.status
	if (updates.summary) entry.summary = updates.summary
	writeIndex(entries)
}

export async function updateIndexOnComplete(slug: string): Promise<void> {
	const researchPath = `${RESEARCH_BASE}/${slug}/research.md`
	let summary = "завершён"

	if (existsSync(researchPath)) {
		try {
			const content = readFileSync(researchPath, "utf-8")
			const summaryMatch = content.match(/## Rolling Summary\n([\s\S]*?)(?=\n## |\n---|\Z)/)
			if (summaryMatch && summaryMatch[1]) {
				const raw = summaryMatch[1].trim()
				summary = raw.slice(0, 200).replace(/\n/g, " ").trim()
				if (raw.length > 200) summary += "..."
			}
		} catch {
			// Ignore read errors
		}
	}

	updateEntry(slug, { status: "завершён", summary })
}
