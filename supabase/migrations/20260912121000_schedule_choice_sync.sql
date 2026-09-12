create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'matoka-choice-hourly-sync') then
    perform cron.unschedule('matoka-choice-hourly-sync');
  end if;
end $$;

select cron.schedule(
  'matoka-choice-hourly-sync',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'matoka_project_url' limit 1) || '/functions/v1/sync-choice',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'matoka_anon_key' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cron$
);

comment on extension pg_cron is 'Hourly MATOKA ChoiceQR synchronization. Requires Vault secrets matoka_project_url and matoka_anon_key.';
