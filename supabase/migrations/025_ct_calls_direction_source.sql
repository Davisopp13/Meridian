-- Annotate ct_calls with direction (incoming/outgoing) and source widget.
-- The CT widget today doesn't distinguish direction — this is a gap in CT 1.0 semantics
-- that the MPL widget's call button exposes, so we add both columns at once and
-- backfill existing rows with 'outgoing' / 'ct_widget' as the safest default.

alter table ct_calls add column if not exists direction varchar(16);
alter table ct_calls add column if not exists source    varchar(16);

update ct_calls set direction = 'outgoing'  where direction is null;
update ct_calls set source    = 'ct_widget' where source    is null;

comment on column ct_calls.direction is 'incoming | outgoing. Captured at log time from the widget.';
comment on column ct_calls.source    is 'ct_widget | mpl_widget. Which widget logged the call.';
