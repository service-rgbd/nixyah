import { sql } from "drizzle-orm";
import { db } from "./db";

let hasContactPreferencePromise: Promise<boolean> | null = null;
let hasProfilesVipPromise: Promise<boolean> | null = null;
let hasUsersEmailPromise: Promise<boolean> | null = null;
let hasProfilesAttributesPromise: Promise<boolean> | null = null;
let hasUsersEmailVerificationPromise: Promise<boolean> | null = null;
let hasProfilesBusinessPromise: Promise<boolean> | null = null;
let hasProfilesAccountTypePromise: Promise<boolean> | null = null;
let hasProfilesProFieldsPromise: Promise<boolean> | null = null;
let hasProfilesVisibilityPromise: Promise<boolean> | null = null;
let hasProfilesContactFieldsPromise: Promise<boolean> | null = null;
let hasProfilesGeoFieldsPromise: Promise<boolean> | null = null;
let hasProfilesShowLocationPromise: Promise<boolean> | null = null;
let hasSalonsTablePromise: Promise<boolean> | null = null;
let hasProfileMediaTablePromise: Promise<boolean> | null = null;
let hasAnnoncesTablePromise: Promise<boolean> | null = null;
let hasAnnoncesPromotionPromise: Promise<boolean> | null = null;
let hasStoriesTablePromise: Promise<boolean> | null = null;
let hasEventsVideoUrlPromise: Promise<boolean> | null = null;
let hasUsersLoginLinkPromise: Promise<boolean> | null = null;
let hasUsersDeletionSchedulePromise: Promise<boolean> | null = null;
let hasUsersTermsAcceptancePromise: Promise<boolean> | null = null;

async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  try {
    const res = await db.execute(sql`
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
      limit 1
    `);
    const rows = ((res as any)?.rows ?? []) as any[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function hasTable(tableName: string): Promise<boolean> {
  try {
    const res = await db.execute(sql`
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = ${tableName}
      limit 1
    `);
    const rows = ((res as any)?.rows ?? []) as any[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function hasProfilesContactPreferenceColumn(): Promise<boolean> {
  if (hasContactPreferencePromise) return hasContactPreferencePromise;
  hasContactPreferencePromise = hasColumn("profiles", "contact_preference");
  return hasContactPreferencePromise;
}

export async function hasProfilesVipColumn(): Promise<boolean> {
  if (hasProfilesVipPromise) return hasProfilesVipPromise;
  hasProfilesVipPromise = hasColumn("profiles", "is_vip");
  return hasProfilesVipPromise;
}

export async function hasUsersEmailColumn(): Promise<boolean> {
  if (hasUsersEmailPromise) return hasUsersEmailPromise;
  hasUsersEmailPromise = hasColumn("users", "email");
  return hasUsersEmailPromise;
}

export async function hasProfilesAttributesColumns(): Promise<boolean> {
  if (hasProfilesAttributesPromise) return hasProfilesAttributesPromise;
  hasProfilesAttributesPromise = hasColumn("profiles", "corpulence");
  return hasProfilesAttributesPromise;
}

export async function hasUsersEmailVerificationColumns(): Promise<boolean> {
  if (hasUsersEmailVerificationPromise) return hasUsersEmailVerificationPromise;
  hasUsersEmailVerificationPromise = hasColumn("users", "email_verified");
  return hasUsersEmailVerificationPromise;
}

export async function hasProfilesBusinessColumns(): Promise<boolean> {
  if (hasProfilesBusinessPromise) return hasProfilesBusinessPromise;
  hasProfilesBusinessPromise = hasColumn("profiles", "business_name");
  return hasProfilesBusinessPromise;
}

export async function hasProfilesAccountTypeColumn(): Promise<boolean> {
  if (hasProfilesAccountTypePromise) return hasProfilesAccountTypePromise;
  hasProfilesAccountTypePromise = hasColumn("profiles", "account_type");
  return hasProfilesAccountTypePromise;
}

export async function hasProfilesProFields(): Promise<boolean> {
  if (hasProfilesProFieldsPromise) return hasProfilesProFieldsPromise;
  hasProfilesProFieldsPromise = hasColumn("profiles", "is_pro");
  return hasProfilesProFieldsPromise;
}

export async function hasProfilesVisibilityColumn(): Promise<boolean> {
  if (hasProfilesVisibilityPromise) return hasProfilesVisibilityPromise;
  hasProfilesVisibilityPromise = hasColumn("profiles", "visible");
  return hasProfilesVisibilityPromise;
}

export async function hasProfilesContactFields(): Promise<boolean> {
  if (hasProfilesContactFieldsPromise) return hasProfilesContactFieldsPromise;
  hasProfilesContactFieldsPromise = hasColumn("profiles", "show_phone");
  return hasProfilesContactFieldsPromise;
}

export async function hasProfilesGeoFields(): Promise<boolean> {
  if (hasProfilesGeoFieldsPromise) return hasProfilesGeoFieldsPromise;
  hasProfilesGeoFieldsPromise = hasColumn("profiles", "lat");
  return hasProfilesGeoFieldsPromise;
}

export async function hasProfilesShowLocationColumn(): Promise<boolean> {
  if (hasProfilesShowLocationPromise) return hasProfilesShowLocationPromise;
  hasProfilesShowLocationPromise = hasColumn("profiles", "show_location");
  return hasProfilesShowLocationPromise;
}

export async function hasSalonsTable(): Promise<boolean> {
  if (hasSalonsTablePromise) return hasSalonsTablePromise;
  hasSalonsTablePromise = hasTable("salons");
  return hasSalonsTablePromise;
}

export async function hasProfileMediaTable(): Promise<boolean> {
  if (hasProfileMediaTablePromise) return hasProfileMediaTablePromise;
  hasProfileMediaTablePromise = hasTable("profile_media");
  return hasProfileMediaTablePromise;
}

export async function hasAnnoncesTable(): Promise<boolean> {
  if (hasAnnoncesTablePromise) return hasAnnoncesTablePromise;
  hasAnnoncesTablePromise = hasTable("annonces");
  return hasAnnoncesTablePromise;
}

export async function hasAnnoncesPromotionColumn(): Promise<boolean> {
  if (hasAnnoncesPromotionPromise) return hasAnnoncesPromotionPromise;
  hasAnnoncesPromotionPromise = hasColumn("annonces", "promotion");
  return hasAnnoncesPromotionPromise;
}

export async function hasStoriesTable(): Promise<boolean> {
  if (hasStoriesTablePromise) return hasStoriesTablePromise;
  hasStoriesTablePromise = hasTable("stories");
  return hasStoriesTablePromise;
}

export async function hasEventsVideoUrlColumn(): Promise<boolean> {
  if (hasEventsVideoUrlPromise) return hasEventsVideoUrlPromise;
  hasEventsVideoUrlPromise = hasColumn("events", "video_url");
  return hasEventsVideoUrlPromise;
}

export async function hasUsersLoginLinkColumns(): Promise<boolean> {
  if (hasUsersLoginLinkPromise) return hasUsersLoginLinkPromise;
  hasUsersLoginLinkPromise = hasColumn("users", "login_link_token");
  return hasUsersLoginLinkPromise;
}

export async function hasUsersDeletionScheduleColumns(): Promise<boolean> {
  if (hasUsersDeletionSchedulePromise) return hasUsersDeletionSchedulePromise;
  hasUsersDeletionSchedulePromise = hasColumn("users", "delete_scheduled_at");
  return hasUsersDeletionSchedulePromise;
}

export async function hasUsersTermsAcceptanceColumns(): Promise<boolean> {
  if (hasUsersTermsAcceptancePromise) return hasUsersTermsAcceptancePromise;
  hasUsersTermsAcceptancePromise = hasColumn("users", "terms_accepted_at");
  return hasUsersTermsAcceptancePromise;
}


