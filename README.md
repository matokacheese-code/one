# MATOKA Sales Dashboard

Изолированный дашборд продаж семи точек MATOKA в Праге. Данные загружаются из Choice QR за последние 30 дней и отображаются в валюте Kč, в часовой зоне Europe/Prague.

## Облачная конфигурация

- Новый Supabase-проект разворачивается только из миграций в `supabase/migrations`.
- Edge Function `sync-choice` читает Choice QR token только из секрета `CHOICE_TOKEN_MATOKA`.
- Для hourly cron в Supabase Vault должны существовать `matoka_project_url` и `matoka_anon_key`.
- Клиенту нужны публичные переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`; пример находится в `.env.example`.

Секреты, ключи и реальные токены в репозитории не хранятся.
