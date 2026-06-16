# Enguard на телефоне и в облаке

## Вариант A — прямо сейчас, по домашнему Wi‑Fi (без деплоя)

Самый быстрый способ открыть Enguard на телефоне:

1. На компьютере запусти сервер:
   ```bash
   npm run dev
   ```
   В выводе будет строка **Network: http://192.168.x.x:3000** — это адрес твоего ПК в сети.
2. Убедись, что телефон и компьютер в **одной Wi‑Fi сети**.
3. Открой этот адрес в **Chrome на телефоне**.
4. Меню Chrome → **«Добавить на главный экран»** — приложение установится как иконка (PWA), будет открываться на весь экран.

Если не открывается — разреши Node.js в брандмауэре Windows (Параметры → Сеть → Брандмауэр → разрешить приложение), либо запусти:
```bash
npm run dev -- -H 0.0.0.0
```

> Минус: работает, только пока включён компьютер с сервером. Для «всегда онлайн» — вариант B.

## Вариант C — свой сервер (Ubuntu / EC2) + домен enguard.study  ⭐ рекомендую

У тебя уже есть сервер `51.21.128.186` и домен `enguard.study` (A-записи `@` и `www` уже указывают на сервер — отлично). На своём сервере **SQLite работает как есть** (Turso не нужен), а HTTPS на домене включает пуши.

Все команды — на сервере по SSH (`ssh ubuntu@51.21.128.186`). Замени `<...>` своими значениями.

### 1. Базовое ПО (один раз)
```bash
sudo apt update
sudo apt install -y git nginx python3 make g++   # build-tools нужны для better-sqlite3
# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Код
```bash
cd ~
git clone https://github.com/justyelli/enguard.git
cd enguard
npm ci
```

### 3. Переменные окружения `.env` (не в git!)
```bash
nano .env
```
Вставь (значения VAPID/секрет возьми из локального `.env` на компьютере или сгенерируй заново):
```
DATABASE_URL="file:./prod.db"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="<публичный VAPID>"
VAPID_PRIVATE_KEY="<приватный VAPID>"
VAPID_SUBJECT="mailto:ramazan.zhairem@gmail.com"
CRON_SECRET="<длинная случайная строка>"
APP_TZ_OFFSET="5"
```
(Сгенерировать VAPID при необходимости: `npx web-push generate-vapid-keys --json`.)

### 4. База и сборка
```bash
npx prisma generate         # сгенерировать клиент Prisma (он не в git)
npx prisma migrate deploy   # создаёт prod.db и применяет миграции
npm run build
```

### 5. Запуск как сервис (systemd)
```bash
sudo cp deploy/enguard.service /etc/systemd/system/enguard.service
which node    # если путь не /usr/bin/node — поправь ExecStart в файле сервиса
sudo systemctl daemon-reload
sudo systemctl enable --now enguard
sudo systemctl status enguard   # должно быть active (running)
```

### 6. Nginx + HTTPS
```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/enguard
sudo ln -sf /etc/nginx/sites-available/enguard /etc/nginx/sites-enabled/enguard
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
# бесплатный сертификат Let's Encrypt:
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d enguard.study -d www.enguard.study --redirect -m ramazan.zhairem@gmail.com --agree-tos -n
```
Открой **https://enguard.study** — приложение работает.

> На Namecheap убери лишние записи: оставь только две A-записи (`@` и `www` → `51.21.128.186`). Запись `URL Redirect` на `@` и CNAME `www → parkingpage` нужно удалить, иначе они конфликтуют с A-записями.

> AWS Security Group: открой входящие порты **80** и **443** (и 22 для SSH).

### 7. Ежедневные пуш-напоминания (cron)
```bash
crontab -e
```
Добавь строку (каждые 3 часа; эндпоинт сам шлёт пуш только днём 9:00–22:00 локально и только если ты сегодня не занимался):
```
0 */3 * * * curl -s -H "Authorization: Bearer <CRON_SECRET>" https://enguard.study/api/push/cron > /dev/null 2>&1
```

Проверить, что пуш реально доходит до устройства (после того как включил тумблер 🔔):
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://enguard.study/api/push/cron?test=1"
```
Ответ `{"sent":1,...}` означает «отправлено на 1 устройство» — на телефон/ПК придёт тестовое уведомление. `{"sent":0}` — значит подписок нет (не нажал тумблер / не дал разрешение).

### Обновление после изменений в коде
```bash
cd ~/enguard && git pull && npm ci && npx prisma migrate deploy && npm run build && sudo systemctl restart enguard
```

---

## Вариант B — облако (доступ откуда угодно, 24/7)

Next.js удобно деплоить на **Vercel**, но есть нюанс: текущая база — файловый **SQLite** (`dev.db`), а на serverless‑хостинге файловая база не сохраняется. Поэтому для облака нужна сетевая БД, совместимая с SQLite — проще всего **Turso (libSQL)**.

Что потребуется (твои аккаунты):
- аккаунт **Vercel** (бесплатно), подключённый к GitHub‑репозиторию `enguard`;
- аккаунт **Turso** (бесплатный тариф) — даст `DATABASE_URL` (libsql://…) и auth‑token;
- твой **OPENAI_API_KEY**.

Шаги:
1. Создай БД в Turso, получи URL и токен.
2. **Переключить Prisma на libSQL‑адаптер** — это правка в `lib/prisma.ts` (заменить `@prisma/adapter-better-sqlite3` на `@prisma/adapter-libsql`). Скажи мне — сделаю и оставлю локальную работу через SQLite по флагу окружения.
3. Применить миграции к Turso (`prisma migrate deploy`).
4. На Vercel: импортировать репозиторий, добавить переменные окружения `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `OPENAI_API_KEY`, нажать Deploy.

После этого приложение открывается по адресу `*.vercel.app`, ставится на телефон как PWA и доступно всегда.

## Пуш-уведомления (push)

Полный пуш-стек уже в коде: service worker (`public/sw.js`), подписка на клиенте (тумблер «🔔 Пуш-напоминания» на главной), эндпоинты `/api/push/subscribe`, `/api/push/unsubscribe` и ежедневный `/api/push/cron`, плюс расписание в `vercel.json` (раз в день 17:00 UTC).

Что нужно, чтобы пуши реально приходили на телефон:
1. **HTTPS** — то есть деплой (вариант B). На `http://localhost` подписка работает только на самом компьютере; телефону нужен https-адрес.
2. **VAPID-ключи** — уже сгенерированы в `.env` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). На Vercel добавь те же переменные в Project → Settings → Environment Variables. (Хочешь — сгенерируй новые: `npx web-push generate-vapid-keys --json`.)
3. **CRON_SECRET** — **обязательно** задай эту переменную на Vercel: без неё cron-эндпоинт возвращает 500 (закрыт). Vercel Cron сам шлёт секрет в заголовке `Authorization`.
4. **APP_TZ_OFFSET** — твой часовой пояс в часах от UTC (напр. Алматы = `5`), чтобы серия/цель/напоминания считались по твоей локальной полуночи (на сервере время UTC).
5. **iPhone**: Web Push работает только если приложение **добавлено на главный экран как PWA** (iOS 16.4+). На Android Chrome — сразу после разрешения.

Проверить рассылку вручную (секрет — только в заголовке, не в URL):
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<твой-домен>/api/push/cron
```
Локально: подпишись на десктопе (тумблер), затем
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/push/cron
```
