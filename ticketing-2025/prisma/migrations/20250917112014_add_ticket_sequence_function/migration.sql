-- 1) Sequence (idempotent)
create sequence if not exists public.ticket_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  maxvalue 999
  no cycle
  owned by none;

-- 2) Function (takes a prefix, default 'PM25')
create or replace function public.next_ticket_code(prefix text default 'PM25')
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('public.ticket_seq');
  if n > 999 then
    raise exception 'Ticket counter exceeded 999';
  end if;
  return prefix || '-' || lpad(n::text, 3, '0');
end
$$;
