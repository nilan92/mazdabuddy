-- Security fix: the two job-part RPCs performed no authorisation at all
-- Applied 2026-09-08.
--
-- Both are SECURITY DEFINER, so RLS does not apply inside them, and neither
-- checked the caller in any way. add_job_part_transaction accepted any job id
-- and any part id and moved stock; remove_job_part_transaction accepted any
-- job_part id, deleted the row and returned the stock. Both were reachable by
-- the anon role over /rest/v1/rpc/. The only thing between another workshop's
-- inventory and a stranger was the unguessability of a UUID, which is not an
-- authorisation model — and there are three tenants in this database.
--
-- The check goes inside the functions, not at the call site: they are the choke
-- point every path routes through, and a guard in the caller would leave the
-- RPC endpoint itself wide open.
--
-- Legitimate use is unaffected: both are called only from the job card, by a
-- signed-in user, on a job and a part already scoped to their tenant by RLS.
--
-- Verified after applying:
--   authenticated, own job + own part      -> {"success": true}, stock 20 -> 19
--   authenticated, unknown/foreign part    -> "Part not found"
--   authenticated, unknown/foreign job     -> "Job not found"
--   anon over REST                         -> HTTP 401, permission denied

create or replace function public.add_job_part_transaction(
  p_job_id uuid, p_part_id uuid, p_quantity integer, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
DECLARE
  v_stock int;
  v_price numeric;
  v_part_name text;
  v_cost numeric;
  v_tenant uuid;
BEGIN
  v_tenant := public.get_my_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- SECURITY DEFINER bypasses RLS, so ownership of both the job and the part
  -- has to be established explicitly.
  IF NOT EXISTS (SELECT 1 FROM public.job_cards WHERE id = p_job_id AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.parts WHERE id = p_part_id AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Part not found';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Quantity must be at least 1.');
  END IF;

  SELECT stock_quantity, price_lkr, name, cost_lkr
  INTO v_stock, v_price, v_part_name, v_cost
  FROM public.parts
  WHERE id = p_part_id
  FOR UPDATE;

  IF v_stock < p_quantity THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient stock available.');
  END IF;

  UPDATE public.parts
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_part_id;

  INSERT INTO public.job_parts (job_id, part_id, quantity, price_at_time_lkr, cost_at_time_lkr)
  VALUES (p_job_id, p_part_id, p_quantity, v_price, v_cost);

  RETURN json_build_object('success', true);
END;
$function$;

create or replace function public.remove_job_part_transaction(p_job_part_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
DECLARE
  v_part_id uuid;
  v_qty int;
  v_tenant uuid;
BEGIN
  v_tenant := public.get_my_tenant_id();
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT jp.part_id, jp.quantity
  INTO v_part_id, v_qty
  FROM public.job_parts jp
  JOIN public.job_cards j ON j.id = jp.job_id
  WHERE jp.id = p_job_part_id
    AND j.tenant_id = v_tenant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Line item not found';
  END IF;

  DELETE FROM public.job_parts WHERE id = p_job_part_id;

  IF v_part_id IS NOT NULL THEN
    UPDATE public.parts
    SET stock_quantity = stock_quantity + v_qty
    WHERE id = v_part_id;
  END IF;
END;
$function$;

-- Revoking from `anon` alone is a silent no-op: EXECUTE is held through the
-- default PUBLIC grant (`=X/postgres` in proacl), which anon inherits. The
-- PUBLIC grant has to go, then the needed roles re-granted explicitly.
revoke execute on function public.add_job_part_transaction(uuid, uuid, integer, uuid) from public;
revoke execute on function public.remove_job_part_transaction(uuid) from public;

grant execute on function public.add_job_part_transaction(uuid, uuid, integer, uuid) to authenticated, service_role;
grant execute on function public.remove_job_part_transaction(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Follow-up, same day: two more SECURITY DEFINER functions reachable by anon.
--
-- clean_rate_limits() let an unauthenticated caller clear the edge-function
-- rate-limit table, defeating the rate limiting. recalc_invoice_total(uuid) let
-- one force a recalculation against any job id — harmless in effect, since it
-- recomputes from the line items and cannot produce a wrong number, but there
-- is no reason to expose it. Neither is called from application code.
--
-- Note the trap, which bit twice in opposite directions: the job-part RPCs above
-- held EXECUTE through the default PUBLIC grant, so revoking from `anon` was a
-- silent no-op. These two carry explicit `anon=X/postgres` grants instead, so
-- revoking from PUBLIC was the no-op and anon could still call them (REST
-- returned 204). Read proacl first, then revoke from every holder.
--
-- The invoice triggers are unaffected: trg_recalc_invoice_total() and
-- trg_job_card_recalc_invoice() are SECURITY DEFINER owned by postgres, so they
-- call recalc_invoice_total() as the owner, which retains EXECUTE. Verified by
-- inserting a job_parts row directly and watching the invoice total move
-- 30,600 -> 35,600, inside a transaction that was rolled back.

revoke execute on function public.clean_rate_limits() from public, anon, authenticated;
revoke execute on function public.recalc_invoice_total(uuid) from public, anon, authenticated;

grant execute on function public.clean_rate_limits() to service_role;
grant execute on function public.recalc_invoice_total(uuid) to service_role;
