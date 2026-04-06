### ScrapFly — scraping, облачный браузер, гео-прокси, LLM extraction

Все инструменты вызываются через `exec` + `mcporter`. **ОБЯЗАТЕЛЬНО: перед каждым скрапом вызвать `scraping_instruction_enhanced()` → получить `pow` токен.**

#### scraping_instruction_enhanced — получить POW и best practices

Вызывай ПЕРЕД каждым использованием `web_get_page` или `web_scrape`. Возвращает `pow` токен и рекомендации по параметрам.

```bash
mcporter call 'scrapfly.scraping_instruction_enhanced()'
```

#### web_get_page — быстрый fetch страницы

Для простых случаев — когда нужен контент без сложной логики. Автоматически включает `render_js: true` и `asp: true` — передавать не нужно.

```bash
mcporter call 'scrapfly.web_get_page(url: "https://example.com", pow: "ЗНАЧЕНИЕ", format: "markdown")'
```

Параметры:
- `url` (обяз.) — целевой URL
- `pow` (обяз.) — токен из scraping_instruction_enhanced
- `format` — `markdown` (default) / `text` / `json` / `clean_html` / `raw`
- `format_options` — `no_links`, `no_images`, `only_content`
- `country` — ISO код страны для гео-прокси (например `ru`, `us`, `de`)
- `proxy_pool` — `public_datacenter_pool` (default) или `public_residential_pool`
- `rendering_wait` — ожидание рендера в мс
- `capture_page` — также сделать скриншот (boolean)
- `extraction_model` — авто-extraction: `article`, `product`, `job_posting`

#### web_scrape — облачный браузер + advanced scraping

Полноценный облачный браузер (включай `render_js: true` и `asp: true` явно). Обходит anti-bot, работает через гео-прокси (residential IP из любой страны). Поддерживает многошаговые сценарии (заполнение форм, клики, скролл).

Когда использовать вместо agent-browser:
- Сайт блокирует серверный IP → ScrapFly через residential proxy пройдёт
- Нужна простая автоматизация (логин, скролл, клик по кнопке) без сложной навигации
- Нужен контент с гео-привязкой (например российский маркетплейс с `country: "ru"`)

```bash
mcporter call 'scrapfly.web_scrape(url: "https://example.com", pow: "ЗНАЧЕНИЕ", render_js: true, country: "ru", proxy_pool: "public_residential_pool", format: "markdown")'
```

Параметры:
- `asp` — Anti Scraping Protection (boolean, **default: false** — ставь `true` явно)
- `render_js` — запустить облачный браузер (boolean, **default: false** — ставь `true` явно)
- `country` — ISO код страны для прокси. Можно несколько: `"ca,us"`. Можно исключить: `"-mx,-au"`
- `proxy_pool` — `public_datacenter_pool` (default, дешёвый) или `public_residential_pool` (дороже, но обходит больше защит)
- `extraction_prompt` — LLM промпт для AI extraction. ScrapFly сам извлекает структурированные данные. Возвращает JSON
- `extraction_model` — авто-extraction: `article`, `product`, `job_posting`
- `js` — standalone JavaScript для выполнения на странице (строка, отдельно от `js_scenario`)
- `format_options` — опции формата: `no_links`, `no_images`, `only_content`
- `lang` — предпочтительный язык ответа (ISO код)
- `method` — HTTP метод (GET/POST/PUT/PATCH)
- `headers`, `cookies`, `body` — HTTP контроль
- `wait_for_selector` — ждать CSS/XPath селектор перед извлечением контента
- `timeout` — серверный таймаут в мс
- `cache`, `cache_ttl`, `cache_clear` — кэширование
- `retry` — автоматический повтор при ошибках (boolean, default: true)

#### js_scenario — многошаговые сценарии в облачном браузере

Передаётся как JSON массив в параметре `js_scenario` инструмента `web_scrape`. Требует `render_js: true`. Общий лимит: 25 секунд.

Доступные действия:

**click** — клик по элементу
```json
{"click": {"selector": "button.submit"}}
```

**fill** — ввод текста в поле
```json
{"fill": {"selector": "#email", "value": "user@example.com", "clear": true}}
```

**select** — выбор из dropdown
```json
{"select": {"selector": "select#country", "value": "US"}}
```
Для кастомных dropdown:
```json
{"select": {"selector": ".dropdown-trigger", "option_selector": ".dropdown-item", "text": "Germany"}}
```

**scroll** — прокрутка
```json
{"scroll": {"selector": "bottom"}}
{"scroll": {"selector": "bottom", "infinite": 5}}
{"scroll": {"selector": "bottom", "infinite": 3, "click_selector": ".load-more"}}
```

**wait** — пауза (мс)
```json
{"wait": 2000}
```

**wait_for_navigation** — ждать перехода после клика
```json
{"wait_for_navigation": {"timeout": 5000}}
```

**wait_for_selector** — ждать появления/исчезновения элемента
```json
{"wait_for_selector": {"selector": "#results", "state": "visible", "timeout": 10000}}
```

**execute** — выполнить JavaScript
```json
{"execute": {"script": "return document.title", "timeout": 3000}}
```

Пример: логин на сайте
```bash
mcporter call 'scrapfly.web_scrape(url: "https://example.com/login", pow: "ЗНАЧЕНИЕ", render_js: true, js_scenario: [{"fill": {"selector": "input[name=username]", "value": "user"}}, {"fill": {"selector": "input[name=password]", "value": "pass"}}, {"click": {"selector": "button[type=submit]"}}, {"wait_for_navigation": {"timeout": 5000}}])'
```

Пример: бесконечный скролл
```bash
mcporter call 'scrapfly.web_scrape(url: "https://example.com/products", pow: "ЗНАЧЕНИЕ", render_js: true, js_scenario: [{"wait": 1000}, {"scroll": {"selector": "bottom", "infinite": 5}}, {"wait": 2000}])'
```

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

#### info_api_key — информация о текущем API ключе

Без параметров.

```bash
mcporter call 'scrapfly.info_api_key()'
```
