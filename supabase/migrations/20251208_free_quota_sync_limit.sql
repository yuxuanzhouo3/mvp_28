-- Sync free quota limit with runtime setting
-- Optionally set before running:
--   SET app.free_daily_limit = <NEW_LIMIT>;

do $$
declare
  new_limit int;
begin
  -- Pull from custom GUC if provided, else fallback to 10
  new_limit := coalesce(
    nullif(current_setting('app.free_daily_limit', true), '')::int,
    10
  );

  -- Raise default only (never lower)
  update free_quotas
     set limit_per_day = greatest(limit_per_day, new_limit),
         updated_at    = now()
   where limit_per_day < new_limit;

  execute format('alter table free_quotas alter column limit_per_day set default %s', new_limit);
end $$;
