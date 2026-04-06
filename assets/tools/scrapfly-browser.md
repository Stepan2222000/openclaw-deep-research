### ScrapFly Browser -- remote антидетект-браузер через agent-browser

CDP подключение к облачному браузеру ScrapFly (Scrapium/Chrome 146). Антидетект-профиль с Mac User-Agent, резидентные IP. Используется через обычный agent-browser.

#### Подключение

```bash
DISPLAY=:99 agent-browser connect "$SCRAPFLY_BROWSER_URL"
```

Env variable: `SCRAPFLY_BROWSER_URL=wss://browser.scrapfly.io/?api_key=...`

После подключения -- обычные команды agent-browser:

```bash
DISPLAY=:99 agent-browser open "https://example.com"
DISPLAY=:99 agent-browser snapshot -i
DISPLAY=:99 agent-browser click @e1
DISPLAY=:99 agent-browser close
```

#### Когда использовать

- Сайт с сильной anti-bot защитой, обычный agent-browser не справляется
- Серверный IP заблокирован, нужны резидентные прокси
- ScrapFly web_scrape не дал результата, нужен полный контроль браузера
- Нужен антидетект-профиль (Chrome 146, Mac UA, 30000+ spoofed signals)

#### Правила

- Закрывай сессию (`close`) после завершения работы
- Не используй одновременно с локальным agent-browser (один браузер за раз)
- **ВСЕГДА** `DISPLAY=:99` для всех команд
- Если `SCRAPFLY_BROWSER_URL` не задан -- используй обычный agent-browser
