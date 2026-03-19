### Ref — поиск документации и чтение URL

Все инструменты вызываются через `exec` + `mcporter`.

#### ref_search_documentation — поиск по технической документации

Когда нужно найти конкретную инструкцию, API-метод, конфиг-параметр.

```bash
mcporter call 'ref.ref_search_documentation(query: "nginx proxy_pass timeout")'
```

#### ref_read_url — умное чтение URL

Извлекает ~5K релевантных токенов. Хорош для длинной документации (MDN, API reference, RFC, docs.*).

```bash
mcporter call 'ref.ref_read_url(url: "https://docs.example.com/api/long-page")'
```
