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
```

Всегда последняя версия из main. После обновления — рестарт Gateway.

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
  "agent-browser": { "type": "boolean", "default": true }
}
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
├── base-prompt.md          # База: кто ты, ограничения, протокол, цикл, форматы, правила
├── cascades.md             # Каскады поиска и extraction (шаблон)
└── tools/
    ├── exa.md              # Exa: поиск, crawling, deep researcher
    ├── scrapfly.md         # ScrapFly: web_get_page, web_scrape, screenshot
    ├── brave.md            # Brave Search
    ├── ref.md              # Ref: search + read_url
    ├── agent-browser.md    # Browser automation (agent-browser CLI)
    └── files.md            # read/write/edit, web_fetch (всегда включён)
```

### Сборка промпта (хук before_prompt_build)

```
base-prompt.md
+ "## Инструменты\n"
+ exa.md           (если tools.exa = true)
+ scrapfly.md      (если tools.scrapfly = true)
+ brave.md         (если tools.brave = true)
+ ref.md           (если tools.ref = true)
+ agent-browser.md (если tools.agent-browser = true)
+ files.md         (всегда)
+ cascades.md      (с вырезанными строками выключенных инструментов)
```

### Каскады

`cascades.md` — шаблон с деревьями решений. Хук вырезает строки, содержащие упоминания выключенных инструментов. Каскады удобнее держать в файле, а не генерировать кодом — проще читать и редактировать.

