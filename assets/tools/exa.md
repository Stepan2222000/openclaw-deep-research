### Exa — семантический поиск, crawling, deep research

Все инструменты вызываются через `exec` + `mcporter`.

#### web_search_exa — основной семантический поиск

Понимает смысл запроса, не только ключевые слова. Лучший выбор для большинства запросов.

```bash
mcporter call 'exa.web_search_exa(query: "AI research agents best practices", numResults: 5)'
```

Параметры:
- `query` — поисковый запрос (работает на EN и RU)
- `numResults` — количество (default 8)
- `type` — `"auto"` (default) или `"fast"` (быстрый)
- `livecrawl` — `"fallback"` (default) или `"preferred"` (приоритет живому краулу)
- `contextMaxCharacters` — лимит символов контекста (default 10000)

#### deep_search_exa — глубокий поиск

Автоматически расширяет запрос (создаёт вариации), ищет параллельно, ранжирует и генерирует summary для каждого результата. Лучше web_search_exa для сложных и широких тем.

```bash
mcporter call 'exa.deep_search_exa(query: "current state of AI agents for research automation", numResults: 5)'
```

Параметры:
- `query` — основной запрос
- `numResults` — количество результатов
- `additionalQueries` — массив дополнительных вариаций запроса (опционально, иначе Exa сгенерирует сам)
- `category` — `company`, `research paper`, `people`
- `livecrawl` — `"fallback"` (default) или `"preferred"`

#### get_code_context_exa — поиск кода и API документации

Источники: GitHub, Stack Overflow, docs.

```bash
mcporter call 'exa.get_code_context_exa(query: "playwright page.goto examples", tokensNum: 3000)'
```

Параметры:
- `query` — запрос по коду/API
- `tokensNum` — объём контекста (1000-50000, default 5000)

#### company_research_exa — исследование компаний

```bash
mcporter call 'exa.company_research_exa(companyName: "Anthropic", numResults: 3)'
```

#### linkedin_search_exa — поиск людей и компаний в LinkedIn

```bash
mcporter call 'exa.linkedin_search_exa(query: "CTO Anthropic", numResults: 5)'
```

#### crawling_exa — PRIMARY extraction

Извлекает чистый контент страницы (обработанный, без навигации и мусора). Работает на большинстве популярных сайтов.

```bash
mcporter call 'exa.crawling_exa(url: "https://example.com/page", maxCharacters: 5000)'
```

Параметры:
- `url` — целевой URL
- `maxCharacters` — лимит символов (default 3000)

Если вернул устаревший контент — повтори поиск или используй другой инструмент. Если URL не в индексе Exa — переходи к следующему уровню.

#### deep_researcher_start — делегирование исследования

Запускает автономный AI-агент Exa, который сам ищет, читает страницы и пишет отчёт. Работает параллельно. Использовать когда тема слишком широкая и хочешь делегировать изучение подтемы.

**Правило:** не использовать для основных вопросов brief — только для вспомогательных подтем.

```bash
mcporter call 'exa.deep_researcher_start(instructions: "Detailed research about topic X")'
```

Параметры:
- `instructions` — детальное описание задачи
- `model` — `"exa-research-fast"`, `"exa-research"` (default), `"exa-research-pro"`
- `outputSchema` — JSON schema для структурированного вывода

#### deep_researcher_check

```bash
mcporter call 'exa.deep_researcher_check(researchId: "ID_из_start")'
```
