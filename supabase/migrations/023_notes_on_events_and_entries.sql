alter table case_events  add column if not exists note varchar(500);
alter table mpl_entries  add column if not exists note varchar(500);

comment on column case_events.note is 'Optional free-text note captured at log time. Max 500 chars.';
comment on column mpl_entries.note is 'Optional free-text note captured at log time. Max 500 chars.';
