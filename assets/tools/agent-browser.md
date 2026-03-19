### Браузер (agent-browser)

CLI для browser automation через Chrome/Chromium CDP. Последний уровень каскада extraction, но PRIMARY для интерактива.

#### Обязательные настройки

**ВСЕГДА** запускать с `DISPLAY=:99` и `--headed`. Xvfb работает на `:99` (1920x1080).

```bash
DISPLAY=:99 agent-browser --headed open "https://example.com"
```

Последующие команды подключаются к уже запущенному браузеру:

```bash
DISPLAY=:99 agent-browser snapshot -i
DISPLAY=:99 agent-browser click @e3
DISPLAY=:99 agent-browser close
```

#### Core Workflow

1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` — получить refs (@e1, @e2, ...)
3. **Interact**: использовать refs для click, fill, select
4. **Re-snapshot**: после навигации или изменений DOM — обновить refs

```bash
DISPLAY=:99 agent-browser --headed open https://example.com/form
DISPLAY=:99 agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"

DISPLAY=:99 agent-browser fill @e1 "user@example.com"
DISPLAY=:99 agent-browser fill @e2 "password123"
DISPLAY=:99 agent-browser click @e3
DISPLAY=:99 agent-browser wait --load networkidle
DISPLAY=:99 agent-browser snapshot -i  # ОБЯЗАТЕЛЬНО — refs сбросились
```

#### Command Chaining

Команды можно чейнить через `&&`. Браузер работает через background daemon.

```bash
DISPLAY=:99 agent-browser --headed open URL && DISPLAY=:99 agent-browser wait --load networkidle && DISPLAY=:99 agent-browser snapshot -i
```

Когда чейнить: когда не нужно читать вывод промежуточной команды. Запускать отдельно: когда нужно прочитать snapshot (получить refs), потом взаимодействовать.

#### Batch Execution

Несколько команд в одном вызове через JSON:

```bash
echo '[
  ["open", "https://example.com"],
  ["snapshot", "-i"],
  ["click", "@e1"],
  ["screenshot", "result.png"]
]' | DISPLAY=:99 agent-browser batch --json
```

Используй `batch` когда известна последовательность и не нужно читать промежуточный вывод.

#### Essential Commands

```bash
# Навигация
agent-browser open <url>              # Перейти (aliases: goto, navigate)
agent-browser close                   # Закрыть браузер

# Snapshot
agent-browser snapshot -i             # Интерактивные элементы с refs (рекомендуется)
agent-browser snapshot -i -C          # + cursor-interactive элементы (divs с onclick, cursor:pointer)
agent-browser snapshot -s "#selector" # Ограничить CSS селектором

# Взаимодействие (используй @refs из snapshot)
agent-browser click @e1               # Клик
agent-browser click @e1 --new-tab     # Клик в новой вкладке
agent-browser fill @e2 "text"         # Очистить и ввести текст
agent-browser type @e2 "text"         # Ввести без очистки
agent-browser select @e1 "option"     # Выбрать из dropdown
agent-browser check @e1               # Отметить checkbox
agent-browser press Enter             # Нажать клавишу
agent-browser keyboard type "text"    # Ввод на текущем фокусе (без селектора)
agent-browser scroll down 500         # Прокрутить (default: down 300px)
agent-browser scroll down 500 --selector "div.content"  # Прокрутить контейнер
agent-browser upload @e1 file.pdf     # Загрузить файл

# Получение информации
agent-browser get text @e1            # Текст элемента
agent-browser get text body > page.txt  # Весь текст страницы
agent-browser get url                 # Текущий URL
agent-browser get title               # Заголовок страницы

# Ожидание
agent-browser wait @e1                # Ждать элемент
agent-browser wait --load networkidle # Ждать сетевой idle
agent-browser wait --url "**/page"    # Ждать URL паттерн
agent-browser wait --text "Welcome"   # Ждать текст
agent-browser wait --fn "!document.body.innerText.includes('Loading...')"  # Ждать исчезновение текста
agent-browser wait "#spinner" --state hidden  # Ждать исчезновение элемента
agent-browser wait 2000               # Ждать N мс

# Скачивание файлов
agent-browser download @e1 ./file.pdf          # Клик для скачивания
agent-browser wait --download ./output.zip     # Ждать завершения скачивания
agent-browser --download-path ./downloads open <url>  # Папка для скачиваний

# Захват
agent-browser screenshot              # Скриншот во временную папку
agent-browser screenshot --full       # Полная страница
agent-browser screenshot --annotate   # Скриншот с номерами элементов [N] → @eN
agent-browser pdf output.pdf          # PDF

# Clipboard
agent-browser clipboard read          # Прочитать буфер обмена
agent-browser clipboard write "text"  # Записать в буфер
agent-browser clipboard copy          # Скопировать выделение
agent-browser clipboard paste         # Вставить

# Diff (сравнение состояний)
agent-browser diff snapshot           # Сравнить с последним snapshot
agent-browser diff screenshot --baseline before.png  # Визуальное сравнение
agent-browser diff url <url1> <url2>  # Сравнить две страницы
```

#### Ref Lifecycle (КРИТИЧЕСКИ ВАЖНО)

Refs (`@e1`, `@e2`, ...) инвалидируются когда страница меняется. **ВСЕГДА** re-snapshot после:
- Клик по ссылке или кнопке с навигацией
- Отправка формы
- Загрузка динамического контента (dropdowns, modals)

При «Ref not found» — сделай re-snapshot.

#### Iframes

Iframe содержимое автоматически инлайнится в snapshot. Refs внутри iframe можно использовать напрямую без переключения фрейма:

```bash
agent-browser snapshot -i
# @e2 [Iframe] "payment-frame"
#   @e3 [input] "Card number"
agent-browser fill @e3 "4111111111111111"  # Напрямую — без frame switch
```

#### Semantic Locators (альтернатива refs)

Когда refs недоступны или ненадёжны:

```bash
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "user@test.com"
agent-browser find role button click --name "Submit"
agent-browser find placeholder "Search" type "query"
agent-browser find testid "submit-btn" click
```

#### JavaScript Evaluation

Shell quoting может сломать сложные выражения — используй `--stdin` или `-b`.

```bash
# Простые — одинарные кавычки
agent-browser eval 'document.title'

# Сложные — heredoc (РЕКОМЕНДУЕТСЯ)
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(
  Array.from(document.querySelectorAll("img"))
    .filter(i => !i.alt)
    .map(i => ({ src: i.src.split("/").pop(), width: i.width }))
)
EVALEOF

# Или base64
agent-browser eval -b "$(echo -n 'expression' | base64)"
```

#### Session Persistence

```bash
# Auto-save/restore cookies и localStorage
DISPLAY=:99 agent-browser --headed --session-name myapp open https://app.example.com/login
# ... логин ...
agent-browser close  # State auto-saved

# В следующий раз — auto-loaded
DISPLAY=:99 agent-browser --headed --session-name myapp open https://app.example.com/dashboard

# Параллельные сессии
DISPLAY=:99 agent-browser --headed --session site1 open https://site-a.com
DISPLAY=:99 agent-browser --headed --session site2 open https://site-b.com
agent-browser session list
```

#### Authentication

```bash
# Option 1: Auth vault (рекомендуется — пароль зашифрован)
echo "$PASSWORD" | agent-browser auth save myapp --url https://app.example.com/login --username user --password-stdin
agent-browser auth login myapp

# Option 2: State file
agent-browser state save auth.json
agent-browser state load auth.json

# Option 3: Persistent profile
agent-browser --profile ~/.myapp open https://app.example.com

# Option 4: Import из запущенного Chrome
agent-browser --auto-connect state save ./auth.json
```

#### Network

```bash
agent-browser network requests                 # Просмотреть запросы
agent-browser network requests --filter api    # Отфильтровать
agent-browser network route "**/api/*" --abort # Блокировать запросы
agent-browser network har start                # Начать запись HAR
agent-browser network har stop ./capture.har   # Остановить и сохранить
```

#### Settings

```bash
agent-browser set viewport 1920 1080          # Размер окна (default: 1280x720)
agent-browser set viewport 1920 1080 2        # 2x retina
agent-browser set device "iPhone 14"          # Эмуляция устройства
agent-browser set media dark                  # Тёмная тема
```

#### Debugging

```bash
agent-browser highlight @e1          # Подсветить элемент
agent-browser inspect                # Chrome DevTools
agent-browser console                # Консольные сообщения
agent-browser errors                 # Ошибки страницы
agent-browser record start demo.webm # Запись сессии
agent-browser profiler start         # Профилирование
```

#### Timeouts

Default timeout: 25 секунд. Для медленных сайтов — explicit waits:

```bash
agent-browser wait --load networkidle
agent-browser wait "#content"
agent-browser wait --fn "document.readyState === 'complete'"
```

#### Правила agent-browser

- **ВСЕГДА** `DISPLAY=:99` + `--headed` при первом `open`
- **ВСЕГДА** `DISPLAY=:99` для всех последующих команд в той же сессии
- **ВСЕГДА** re-snapshot после навигации/клика (refs сбрасываются)
- **ВСЕГДА** `close` когда закончил с сайтом
- При «Ref not found» — сделай re-snapshot
- Для медленных страниц — `wait --load networkidle` после `open`
- Для сложного JS — `eval --stdin` с heredoc
