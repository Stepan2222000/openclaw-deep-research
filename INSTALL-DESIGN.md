# Дизайн установки и обновления плагина

## Цель

Пользователь клонирует репозиторий — плагин сразу оказывается в `~/.openclaw/extensions/` и готов к работе. Обновление — через `git pull`.

## Установка

```bash
cd ~/.openclaw/extensions
git clone https://github.com/Stepan2222000/openclaw-deep-research.git
openclaw plugins enable openclaw-deep-research
openclaw deep-research setup
```

Результат: `~/.openclaw/extensions/openclaw-deep-research/` — OpenClaw обнаруживает плагин при следующем старте Gateway.

## Команда `setup`

Когда выполняется: один раз, сразу после клонирования и `plugins enable`.

Что делает:
1. Копирует SKILL.md в папку скиллов OpenClaw — чтобы главный агент знал как обрабатывать `/research`
2. Создаёт workspace researcher-а — папку с промптом субагента (AGENTS.md, TOOLS.md)
3. Патчит openclaw.json — добавляет агента researcher, разрешения, лимиты, запись плагина
4. Создаёт INDEX.md — пустой реестр исследований

После setup нужен рестарт Gateway: `openclaw gateway --force`

## Обновление

```bash
cd ~/.openclaw/extensions/openclaw-deep-research
git pull
openclaw deep-research setup
```

`setup` идемпотентен — безопасно запускать повторно. Пересобирает AGENTS.md из блоков, обновляет SKILL.md, проверяет конфиг. После — рестарт Gateway.

## Динамический промпт researcher-а

### Проблема

Промпт researcher-а монолитный (~800 строк). Нет способа включить/выключить инструменты — например, убрать ScrapFly если не нужен.

### Решение

Промпт собирается динамически из блоков. Пользователь включает/выключает инструменты в конфиге плагина. Хук `before_prompt_build` при каждом запуске researcher-а читает конфиг и собирает промпт только из включённых блоков.

### Конфиг плагина

В `openclaw.plugin.json` добавляется `configSchema` с инструментами:

```json
"tools": {
  "exa": { "type": "boolean", "default": true },
  "scrapfly": { "type": "boolean", "default": true },
  "brave": { "type": "boolean", "default": true },
  "ref": { "type": "boolean", "default": true },
  "agent-browser": { "type": "boolean", "default": true },
  "onepassword": { "type": "boolean", "default": true }
}
```

Модель по умолчанию: `gpt-5.4` xhigh. Пользователь может изменить при обсуждении brief.

```json
"tools": { "onepassword": false }
```

Пользователь меняет в `openclaw.json`:
```json
"plugins": {
  "entries": {
    "openclaw-deep-research": {
      "config": {
        "tools": { "scrapfly": false }
      }
    }
  }
}
```

### Файловая структура assets/

```
assets/
├── base-prompt.md              # База: кто ты, ограничения, протокол, цикл, форматы, правила
├── experience-instructions.md  # Инструкции по ведению experience файлов (всегда включён)
├── cascades.md                 # Каскады поиска и extraction (шаблон)
└── tools/
    ├── exa.md                  # Exa: поиск, crawling, deep researcher
    ├── scrapfly.md             # ScrapFly: web_get_page, web_scrape, screenshot
    ├── brave.md                # Brave Search
    ├── ref.md                  # Ref: search + read_url
    ├── agent-browser.md        # Browser automation (agent-browser CLI)
    └── onepassword.md          # 1Password: доступ к учётным данным (toggle)
```

### Сборка промпта (хук before_prompt_build)

```
base-prompt.md
  {{TOOLS}} заменяется на:
    + exa.md              (если tools.exa = true)
    + scrapfly.md         (если tools.scrapfly = true)
    + brave.md            (если tools.brave = true)
    + ref.md              (если tools.ref = true)
    + agent-browser.md    (если tools.agent-browser = true)
    + onepassword.md      (если tools.onepassword = true)
  {{CASCADES}} заменяется на:
    + cascades.md         (с вырезанными строками выключенных инструментов)
  {{EXPERIENCE}} заменяется на:
    + experience-instructions.md (всегда)
```

### Каскады

`cascades.md` — шаблон с деревьями решений. Хук вырезает строки, содержащие упоминания выключенных инструментов. Каскады удобнее держать в файле, а не генерировать кодом — проще читать и редактировать.

## Пути

- Ресёрчи: `/root/another-openclaw/research/<slug>/`
- Experience: `/root/another-openclaw/experience/<тема-или-домен>.md` (общий для всех агентов, дописывается)
- INDEX.md: `/root/another-openclaw/research/INDEX.md`

## Продолжение ресёрча

### Принцип

Сессии субагентов не архивируются (`archiveAfterMinutes: 0`). Координатор может отправить `sessions_send` в старую сессию — субагент получает полный контекст и продолжает.

### Конфиг (setup прописывает автоматически)

```json
"agents.defaults.subagents.archiveAfterMinutes": 0
```

### INDEX.md — хранит sessionKey

```markdown
## web-frameworks-2026
- **Дата:** 2026-03-19
- **Статус:** завершён
- **Сводка:** ...
- **Путь:** research/web-frameworks-2026/
- **Session:** agent:researcher:subagent:abc-123-def
```

Координатор записывает sessionKey из announce в INDEX.md.

### Алгоритм продолжения

1. Пользователь: "продолжи ресёрч web-frameworks-2026"
2. Координатор ищет в INDEX.md → находит sessionKey
3. `sessions_send(sessionKey, "Продолжи: <новое задание>")` — субагент просыпается с полным контекстом
4. Если сессия пропала (gateway рестарт потерял запись) → новый `sessions_spawn` с follow-up task, передавая путь к research.md
5. Обновить INDEX.md: статус "в процессе", новый sessionKey если был новый spawn

### Experience — общий опыт

Файлы по сайтам/темам: `experience/arxiv.md`, `experience/cloudflare-sites.md`. Каждый ресёрч дописывает секцию с датой. Общий для всех агентов и ресёрчей.

