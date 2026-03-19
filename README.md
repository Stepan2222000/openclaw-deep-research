# Deep Research

Плагин для OpenClaw — автономные исследования через субагента с адаптивным циклом think → act.

## Установка

```bash
cd ~/.openclaw/extensions
git clone https://github.com/Stepan2222000/openclaw-deep-research.git
openclaw plugins enable openclaw-deep-research
openclaw deep-research setup
openclaw gateway --force
```

## Обновление

```bash
cd ~/.openclaw/extensions/openclaw-deep-research
git pull
openclaw deep-research setup
openclaw gateway --force
```

## Использование

### Запуск исследования

Написать в чат:
```
/research <тема>
```

Координатор (главный агент) составит brief, обсудит с вами и запустит субагент-researcher.

### Продолжение исследования

Попросить координатора продолжить — он найдёт sessionKey в INDEX.md и отправит `sessions_send` субагенту с новым заданием. Субагент продолжит с полным контекстом предыдущей работы.

### Мониторинг

Координатор следит за progress.md. Можно попросить его проверить статус, ответить на вопрос researcher-а или дать команду (STOP, REFOCUS, ADD_QUESTION).

## Конфигурация инструментов

В `openclaw.json` можно включать/выключать инструменты researcher-а:

```json
{
  "plugins": {
    "entries": {
      "openclaw-deep-research": {
        "config": {
          "tools": {
            "scrapfly": false,
            "onepassword": false
          }
        }
      }
    }
  }
}
```

После смены конфига — `openclaw deep-research setup` и рестарт Gateway.

Доступные инструменты: `exa`, `scrapfly`, `brave`, `ref`, `agent-browser`, `onepassword`. Все включены по умолчанию.

## Пути

- Исследования: `/root/another-openclaw/research/<slug>/`
- Experience: `/root/another-openclaw/experience/`
- INDEX: `/root/another-openclaw/research/INDEX.md`

## Модель по умолчанию

`gpt-5.4`, thinking: `xhigh`. Можно изменить при обсуждении brief.
