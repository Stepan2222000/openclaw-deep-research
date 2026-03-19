### 1Password — центральное хранилище учётных данных

**Сейф:** `Claw` (Read & Write)
**Service Account Token:** хранить вне репозитория и передавать через переменную окружения.

Перед использованием:
```bash
export OP_SERVICE_ACCOUNT_TOKEN="<service-account-token>"
```

Если токен не настроен, сначала запроси его у пользователя или используй уже подключённый способ доступа. Не храни секреты в markdown-файлах, коде, `.env` или логах.

#### Workflow: нужен доступ к сервису

1. **Ищем запись в сейфе** по домену:
   ```bash
   op item list --vault Claw --format=json | python3 -c "
   import sys,json
   items=json.load(sys.stdin)
   for i in items:
       title=i.get('title','')
       urls=[u.get('href','') for u in i.get('urls',[])]
       if 'ДОМЕН' in title.lower() or any('ДОМЕН' in u for u in urls):
           print(i['id'], title)
   "
   ```
2. **Нашли** → читаем данные:
   ```bash
   op item get <ID> --vault Claw --format=json
   ```
3. **Не нашли** → регистрируемся с сервис-специфичными данными или данными, которые дал пользователь → сохраняем в сейф (см. ниже)

#### Создание новой записи

```bash
op item create \
  --category login \
  --vault Claw \
  --title "example.com (user@example.com)" \
  --url "https://example.com" \
  --generate-password=false \
  username=user@example.com \
  password='<password-from-user-or-generated-secret>'
```

Если есть дополнительные данные (API-ключи, токены и т.д.) — добавить в notes:
```bash
op item create \
  --category login \
  --vault Claw \
  --title "example.com (user@example.com)" \
  --url "https://example.com" \
  --generate-password=false \
  username=user@example.com \
  password='<password-from-user-or-generated-secret>' \
  notesPlain="API Key: xxx\nProject ID: yyy"
```

#### Обновление существующей записи

```bash
op item edit <ID> --vault Claw password=НовыйПароль
op item edit <ID> --vault Claw notesPlain="Обновлённые заметки"
```

#### Быстрое чтение одного поля

```bash
op read "op://Claw/Битрикс24/password"
op read "op://Claw/Битрикс24/username"
```

#### Формат названия записей

`домен (email)` — например: `github.com (user@example.com)`

#### Правила

- **Всегда** проверяй сейф Claw перед регистрацией на любом сервисе
- **Всегда** сохраняй новые учётные данные в сейф сразу после регистрации
- **Обновляй** существующую запись при смене пароля (не создавай дубли)
- **Сохраняй** API-ключи, токены, webhook-URL и прочие секреты в notes той же записи
- **Не пиши** секреты в код, markdown, `.env` файлы или логи — используй `op read` или `op run`
- Если сервис требует подтверждение email — сохрани запись, сообщи пользователю (доступ к Gmail будет подключён позже)
