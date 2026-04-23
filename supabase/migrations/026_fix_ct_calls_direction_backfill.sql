-- Migration 025 backfilled ct_calls with direction='outgoing' for all existing rows
-- on the theory that the CT widget's default was outgoing. That was wrong —
-- CT widget calls are semantically incoming (customer/carrier reaches the agent).
-- MPL widget calls are outgoing (agent reaches out mid-process). This migration
-- corrects historical data and should be applied AFTER migration 025.
--
-- Only rows where source='ct_widget' are corrected. Rows with source='mpl_widget'
-- or NULL source are left alone — they may have been written after this fix
-- ships, or they predate source tracking entirely and we can't tell.

update ct_calls
  set direction = 'incoming'
  where source = 'ct_widget'
    and direction = 'outgoing';
