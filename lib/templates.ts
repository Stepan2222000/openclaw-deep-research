export function researchTemplate(topic: string, date: string, brief: string): string {
	return `# Research: ${topic}
Дата: ${date}

## Brief
${brief}

## Rolling Summary
(обновляется по ходу исследования)

## Key Findings
(нумерованный список с ссылками [S#])

## Sources
(нумерованный список URL с описаниями)

## Open Questions
(что осталось невыясненным)

## Log
(хронологический лог действий)
`
}

export function progressTemplate(topic: string): string {
	return `# Progress: ${topic}
`
}
