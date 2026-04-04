### Exa — семантический поиск, crawling

Все инструменты вызываются через `exec` + `mcporter`.

#### web_search_exa — основной семантический поиск

Понимает смысл запроса, не только ключевые слова. Лучший выбор для большинства запросов.

```bash
mcporter call 'exa.web_search_exa(query: "AI research agents best practices", numResults: 5)'
```

Параметры:
- `query` — поисковый запрос (работает на EN и RU)
- `numResults` — количество (1-100, default 8)
- `type` — `"auto"` (default) или `"fast"` (быстрый)
- `freshness` — фильтр свежести: `"24h"`, `"week"`, `"month"`, `"year"`, `"any"`
- `includeDomains` — массив доменов для ограничения поиска, например `["arxiv.org", "github.com"]`

#### web_search_advanced_exa — расширенный поиск с фильтрами

Полный контроль: категории, даты, домены, текстовые фильтры, summary. Заменяет deprecated `deep_search_exa`, `company_research_exa`, `linkedin_search_exa`.

```bash
mcporter call 'exa.web_search_advanced_exa(query: "transformer architecture", numResults: 5, category: "research paper", includeDomains: ["arxiv.org"])'
```

Основные параметры:
- `query` — поисковый запрос
- `numResults` — количество (1-100, default 10)
- `type` — `"auto"` (default), `"fast"`, `"neural"` (глубокий семантический)
- `category` — фильтр категории: `"company"`, `"research paper"`, `"news"`, `"pdf"`, `"github"`, `"personal site"`, `"people"`, `"financial report"`
- `includeDomains` / `excludeDomains` — фильтр по доменам

Фильтры по датам:
- `startPublishedDate` / `endPublishedDate` — дата публикации (ISO 8601: `"2026-01-01"`)
- `startCrawlDate` / `endCrawlDate` — дата краула

Текстовые фильтры:
- `includeText` — включить только результаты, содержащие ВСЕ указанные строки
- `excludeText` — исключить результаты, содержащие ЛЮБУЮ из строк

Дополнительно:
- `additionalQueries` — массив вариаций запроса для расширения охвата
- `enableSummary` — генерация summary для каждого результата (boolean)
- `summaryQuery` — фокус-запрос для summary
- `userLocation` — ISO код страны для гео-таргетинга (`"US"`, `"RU"`, `"DE"`)

Примеры использования:
```bash
# Поиск компании (замена company_research_exa)
mcporter call 'exa.web_search_advanced_exa(query: "Anthropic", numResults: 3, category: "company")'

# Поиск людей (замена linkedin_search_exa)
mcporter call 'exa.web_search_advanced_exa(query: "CTO Anthropic", numResults: 5, category: "people")'

# Свежие новости за последний месяц
mcporter call 'exa.web_search_advanced_exa(query: "AI regulation EU", numResults: 5, category: "news", startPublishedDate: "2026-03-01")'

# Глубокий поиск с вариациями (замена deep_search_exa)
mcporter call 'exa.web_search_advanced_exa(query: "AI agents research automation", numResults: 5, type: "neural", additionalQueries: ["autonomous research tools", "LLM-powered investigation"])'
```

#### get_code_context_exa — поиск кода и API документации

Источники: GitHub, Stack Overflow, docs.

```bash
mcporter call 'exa.get_code_context_exa(query: "playwright page.goto examples", numResults: 5)'
```

Параметры:
- `query` — запрос по коду/API
- `numResults` — количество результатов (1-20, default 8)

#### crawling_exa — PRIMARY extraction

Извлекает чистый контент страницы (обработанный, без навигации и мусора). Работает на большинстве популярных сайтов.

```bash
mcporter call 'exa.crawling_exa(urls: ["https://example.com/page"], maxCharacters: 5000)'
```

Параметры:
- `urls` — массив URL (можно несколько за один вызов)
- `maxCharacters` — лимит символов на страницу (default 3000)
- `maxAgeHours` — максимальный возраст кеша в часах (0 = всегда свежий)
- `subpages` — количество подстраниц для дополнительного краула
- `subpageTarget` — ключевые слова для приоритизации подстраниц

Если вернул устаревший контент — повтори с `maxAgeHours: 0`. Если URL не в индексе Exa — переходи к следующему уровню.
