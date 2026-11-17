-- Online orders paid by KHQR (PayWay) used to be written to the POS as "ABA".
-- New syncs now use the till's own names (cash / ABA / Bakong/KHQR); this
-- corrects the sales and cash-book rows that were already recorded.
-- Safe to run more than once.
begin;

update public.sales s
   set payment_method = 'Bakong/KHQR', updated_at = now()
  from public.orders o
 where s.order_id = o.id
   and o.payment_method = 'khqr'
   and s.payment_method = 'ABA';

update public.finance_entries f
   set method = 'Bakong/KHQR'
  from public.sales s
  join public.orders o on o.id = s.order_id
 where f.sale_id = s.id
   and o.payment_method = 'khqr'
   and f.method = 'ABA';

commit;
