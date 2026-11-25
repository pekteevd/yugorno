ЮГОРНО — MINI APP + TELEGRAM BOT
================================

Единая сборка на основе существующего бота @YugornoTravelBot и утверждённого
визуального прототипа. Production-бот не пересоздаётся и автоматически не
развёртывается.

СОСТАВ
------
- Исходный адаптивный интерфейс с семью разделами.
- Исходные фото-адреса и отдельный каталог public/assets/images.json.
- Telegram Mini App SDK и серверная проверка initData.
- API публикаций путешествий и сообществ.
- Серверное сохранение профиля, привязанного к Telegram user ID.
- JSON-хранилище в папке data/ (создаётся автоматически, не раздаётся как static).

ФОТОГРАФИИ
-----------
Сохранены прежние изображения из утверждённого HTML-прототипа. Ключи и пути
находятся в public/assets/images.json. Начальные CSS-значения также содержат
эти же фото-адреса, поэтому оформление не исчезает, если каталог временно
недоступен. Для перехода на выбранные пользователем фотографии достаточно
положить файлы в public/assets/images/ и заменить соответствующие значения
в images.json. HTML/CSS при этом менять не потребуется.

ЛОКАЛЬНЫЙ ЗАПУСК
----------------
Требуется Node.js 20 или новее.
1. Скопировать .env.example в .env.
2. Установить зависимости: npm install
3. Запустить: npm start
4. Проверить: http://localhost:3000/health

Без BOT_TOKEN сайт и health-check запускаются, но Telegram auth и публикация
данных отключены. Это позволяет безопасно проверить интерфейс локально.
Если для локального теста нужен настоящий BOT_TOKEN, а действующий бот уже
работает на Deployka, установите DISABLE_BOT_POLLING=true. Тогда локальный сервер
сможет проверять Telegram initData и отправлять Bot API-уведомления, но не будет
запускать getUpdates и конфликтовать с Deployka.

ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ
--------------------
BOT_TOKEN                       Токен существующего бота, только в ENV.
BOT_USERNAME                    Username бота без @.
DISABLE_BOT_POLLING              true отключает Long Polling только в локальной копии.
PORT                            Порт HTTP-сервера (по умолчанию 3000).
WEBAPP_URL                      Публичный HTTPS URL Mini App.
TELEGRAM_AUTH_MAX_AGE_SECONDS    Возраст initData, по умолчанию 86400.
YUGORNO_DATA_DIR                 Путь к постоянному хранилищу (по умолчанию ./data).

API
---
GET  /api/trips          Публичные опубликованные путешествия.
POST /api/trips          Создать путешествие (нужна проверенная Telegram-сессия).
GET  /api/communities    Публичные опубликованные сообщества.
POST /api/communities    Создать сообщество (нужна проверенная Telegram-сессия).
POST /api/trips/:id/interest      Отклик на опубликованное путешествие.
POST /api/communities/:id/join    Вступить в опубликованное сообщество.

При новом отклике/вступлении сервер пытается уведомить владельца публикации
через Telegram-бота. Если владелец не запускал бота, уведомление может не дойти;
сама запись участия при этом остаётся сохранённой.
GET  /api/my/trips                       Мои опубликованные путешествия и число откликов.
GET  /api/my/trips/:id/interests         Отклики на свою поездку (только автору).
GET  /api/my/communities                 Мои опубликованные сообщества.
GET    /api/my/communities/:id/members              Участники своего сообщества (только владельцу).
DELETE /api/my/communities/:id/members/:memberId    Убрать участника (только владельцу; используется ID членства).
GET  /api/profile                Получить свой профиль (нужна Telegram-сессия).
PUT  /api/profile                Сохранить свой профиль (нужна Telegram-сессия).
POST /api/auth/telegram  Проверить initData Telegram.

Для защищённых запросов клиент передаёт оригинальную строку initData в заголовке
X-Telegram-Init-Data. Сервер самостоятельно проверяет HMAC и auth_date.

ВАЖНО ПРО БОТА
--------------
Бот использует Long Polling. Не запускайте вторую копию сервера с тем же токеном,
пока действующая копия работает на Deployka: это вызовет конфликт getUpdates.
Токен не включён в ZIP. Не добавляйте .env в GitHub.

ОГРАНИЧЕНИЯ ЭТОЙ СБОРКИ
-----------------------
- Хранилище JSON рассчитано на ранний этап и один активный серверный процесс.
  Для нескольких инстансов и высокой нагрузки потребуется PostgreSQL/другая БД.
- Публикации доступны после открытия Mini App в Telegram с валидной initData.
- Отклики и вступление в сообщества сохраняются. Telegram-уведомления отправляются
  при доступности чата владельца. Владельцу доступны просмотр откликов/участников,
  редактирование и снятие собственных публикаций.
- Бронирования, личные сообщения и реальная географическая карта ещё не реализованы. Демонстрационные карточки не являются реальными турами.
- Синхронизация JSON-хранилища с внешним постоянным томом зависит от настроек
  хостинга. Перед production нужно проверить сохранность ./data на Deployka.

ПРОВЕРКИ
--------
npm test
node --check server.js
node --check data-store.js
node --check telegram-auth.js

Не публикуйте BOT_TOKEN и файл .env. Если токен раскрыт, перевыпустите его
через BotFather.


Version 0.5.1 additions
- Open published trip details.
- Owners can edit or unpublish their trips. Unpublishing preserves records and responses.
- Owners can manage their communities, view member counts and inspect member profiles voluntarily shared in Yugorno.
- Only owners can edit/unpublish records or view their trip interests/community members.
- Community owners can remove members. Existing memberships are migrated to opaque IDs on first owner list view.
- Local testing can disable Telegram Long Polling while keeping Mini App authentication active.


Локальная проверка без Telegram
-------------------------------
Если BOT_TOKEN не настроен и NODE_ENV не равен production, сервер автоматически
включает локальный тестовый режим и слушает только 127.0.0.1. В этом режиме
можно создавать, редактировать и снимать публикации, проверять отклики,
сообщества и профиль из обычного браузера. Локальный тестовый пользователь
не принимается с внешних адресов. Перед production обязательно установить
NODE_ENV=production и настроить BOT_TOKEN. Не включайте LOCAL_DEMO_MODE на
публичном сервере.
