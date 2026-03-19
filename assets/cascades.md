## Каскады

### Каскад поиска

```
НУЖНО НАЙТИ ИНФОРМАЦИЮ?
├── Концептуальный / смысловой запрос → Exa web_search_exa (PRIMARY)
├── Сложная / широкая тема (нужен глубокий охват) → Exa deep_search_exa
├── Код / API / документация → Exa get_code_context_exa
├── Компания → Exa company_research_exa
├── Люди / LinkedIn → Exa linkedin_search_exa
├── Конкретный факт / свежие новости / точное название → Brave web_search
├── Найти техническую документацию → Ref ref_search_documentation
└── Нужны оба взгляда — семантический + keyword → Exa + Brave
```

### Каскад extraction (от основного к fallback)

```
НУЖНО ПРОЧИТАТЬ СТРАНИЦУ ПО URL?
│
├── crawling_exa (PRIMARY — чистый контент, работает на большинстве сайтов)
│   ├── Контент получен → готово
│   └── URL не в индексе / ошибка?
│       │
│       ├── Это техническая документация?
│       │   └── ДА → ref_read_url (умное чтение, ~5K релевантных токенов)
│       │
│       ├── Страница НЕ защищена (статика, блог, wiki)
│       │   └── web_fetch (бесплатный, мгновенный)
│       │
│       ├── Страница защищена (Cloudflare, anti-bot)
│       │   └── ScrapFly web_get_page (с POW!)
│       │       └── Нужен простой интерактив (закрыть popup, scroll, "Load more")?
│       │           └── ScrapFly web_scrape + js_scenario
│       │
│       └── Всё провалилось → agent-browser
│
├── ИЗВЕСТНО ЗАЩИЩЁННЫЙ САЙТ → сразу ScrapFly (пропустить crawling_exa)
├── НУЖНЫ СТРУКТУРИРОВАННЫЕ ДАННЫЕ → ScrapFly web_scrape + extraction_prompt
├── НУЖЕН ИНТЕРАКТИВ (SPA, формы, навигация, фильтры) → сразу agent-browser
│
└── OVERRIDE: координатор указал BROWSER_FIRST режим
    └── agent-browser для ВСЕХ сайтов (каскад не используется)
```

### Режимы extraction

**DEFAULT** — стандартный каскад, описанный выше. Используется по умолчанию.

**BROWSER_FIRST** — координатор явно указывает в task: «приоритет agent-browser». Открывай все сайты в browser, смотри что на них. Другие инструменты — только когда browser не нужен (поиск всё равно через Exa/Brave).
