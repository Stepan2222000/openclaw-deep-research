### ScrapFly — anti-bot scraping, screenshots, LLM extraction

Все инструменты вызываются через `exec` + `mcporter`. **ОБЯЗАТЕЛЬНО: перед каждым скрапом вызвать `scraping_instruction_enhanced()` → получить `pow` токен.**

#### scraping_instruction_enhanced — получить POW и best practices

Вызывай ПЕРЕД каждым использованием `web_get_page` или `web_scrape`. Возвращает `pow` токен и рекомендации по параметрам.

```bash
mcporter call 'scrapfly.scraping_instruction_enhanced()'
```

#### web_get_page — быстрый fetch страницы

Обходит Cloudflare, рендерит JavaScript. Для простых случаев — когда нужен контент без сложной логики.

```bash
mcporter call 'scrapfly.web_get_page(url: "https://example.com", pow: "ЗНАЧЕНИЕ", format: "markdown")'
```

Параметры:
- `url` (обяз.) — целевой URL
- `pow` (обяз.) — токен из scraping_instruction_enhanced
- `format` — `markdown` (default) / `text` / `json` / `clean_html` / `raw`
- `format_options` — `no_links`, `no_images`, `only_content`
- `country` — ISO код для гео-прокси
- `proxy_pool` — `public_datacenter_pool` (default) или `public_residential_pool`
- `rendering_wait` — ожидание рендера в мс
- `capture_page` — также сделать скриншот (boolean)
- `extraction_model` — авто-extraction: `article`, `product`, `job_posting`

#### web_scrape — advanced scraping

Для сложных случаев: POST-запросы, cookies, JS-сценарии, LLM extraction.

```bash
mcporter call 'scrapfly.web_scrape(url: "https://example.com", pow: "ЗНАЧЕНИЕ", asp: true, render_js: true, format: "markdown")'
```

Дополнительные параметры:
- `asp` — Anti Scraping Protection (boolean, default: true)
- `render_js` — рендерить JavaScript (boolean, default: true)
- `js_scenario` — массив действий: click, fill, scroll, wait, execute, condition. Лёгкая альтернатива agent-browser для простого интерактива (закрыть popup, scroll, «Load more»)
- `js` — выполнить JavaScript на странице
- `extraction_prompt` — LLM промпт для AI extraction. ScrapFly сам извлекает структурированные данные (таблицы цен, спецификации). Возвращает JSON
- `method` — HTTP метод (GET/POST/PUT/PATCH)
- `headers`, `cookies`, `body` — HTTP контроль
- `wait_for_selector` — ждать CSS селектор
- `timeout` — серверный таймаут в мс
- `cache`, `cache_ttl`, `cache_clear` — кэширование
- `retry` — автоматический повтор при ошибках (boolean, default: true)

#### screenshot — скриншот страницы

**НЕ требует POW.**

```bash
mcporter call 'scrapfly.screenshot(url: "https://example.com", format: "png")'
```

Параметры: `url`, `capture` (fullpage/CSS selector), `format` (jpg/png/webp), `resolution`, `options` (load_images, dark_mode, block_banners), `auto_scroll`, `wait_for_selector`, `rendering_wait`.

#### info_account — статистика использования

Проверка квоты, оставшихся кредитов и лимитов. Без параметров.

```bash
mcporter call 'scrapfly.info_account()'
```
