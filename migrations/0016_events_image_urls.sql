alter table "events"
  add column if not exists "image_urls" text[];

update "events"
set "image_urls" = array["image_url"]
where "image_url" is not null
  and ("image_urls" is null or cardinality("image_urls") = 0);
