import { sql } from "drizzle-orm";
import { db } from "./db";

let hasContactPreferencePromise: Promise<boolean> | null = null;
let hasProfilesVipPromise: Promise<boolean> | null = null;
let hasUsersEmailPromise: Promise<boolean> | null = null;
let hasProfilesAttributesPromise: Promise<boolean> | null = null;
let hasUsersEmailVerificationPromise: Promise<boolean> | null = null;
let hasProfilesBusinessPromise: Promise<boolean> | null = null;

export async function hasProfilesContactPreferenceColumn(): Promise<boolean> {
  if (hasContactPreferencePromise) return hasContactPreferencePromise;
  hasContactPreferencePromise = (async () => {
    try {
      const res = await db.execute(sql`
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'contact_preference'
        limit 1
      `);
      // drizzle returns { rows } for node-postgres
      const rows = ((res as any)?.rows ?? []) as any[];
      return rows.length > 0;
    } catch {
      return false;
    }
  })();
  return hasContactPreferencePromise;
}

export async function hasProfilesVipColumn(): Promise<boolean> {
  if (hasProfilesVipPromise) return hasProfilesVipPromise;
  hasProfilesVipPromise = (async () => {
    try {
      const res = await db.execute(sql`
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'is_vip'
        limit 1
      `);
      const rows = ((res as any)?.rows ?? []) as any[];
      return rows.length > 0;
    } catch {
      return false;
    }
  })();
  return hasProfilesVipPromise;
}

export async function hasUsersEmailColumn(): Promise<boolean> {
  if (hasUsersEmailPromise) return hasUsersEmailPromise;
  hasUsersEmailPromise = (async () => {
    try {
      const res = await db.execute(sql`
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'email'
        limit 1
      `);
      const rows = ((res as any)?.rows ?? []) as any[];
      return rows.length > 0;
    } catch {
      return false;
    }
  })();
  return hasUsersEmailPromise;
}

export async function hasProfilesAttributesColumns(): Promise<boolean> {
  if (hasProfilesAttributesPromise) return hasProfilesAttributesPromise;
  hasProfilesAttributesPromise = (async () => {
    try {
      // Checking for one column is enough to decide whether the migration ran.
      const res = await db.execute(sql`
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'corpulence'
        limit 1
      `);
      const rows = ((res as any)?.rows ?? []) as any[];
      return rows.length > 0;
    } catch {
      return false;
    }
  })();
  return hasProfilesAttributesPromise;
}

export async function hasUsersEmailVerificationColumns(): Promise<boolean> {
  if (hasUsersEmailVerificationPromise) return hasUsersEmailVerificationPromise;
  hasUsersEmailVerificationPromise = (async () => {
    try {
      const res = await db.execute(sql`
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'email_verified'
        limit 1
      `);
      const rows = ((res as any)?.rows ?? []) as any[];
      return rows.length > 0;
    } catch {
      return false;
    }
  })();
  return hasUsersEmailVerificationPromise;
}

export async function hasProfilesBusinessColumns(): Promise<boolean> {
  if (hasProfilesBusinessPromise) return hasProfilesBusinessPromise;
  hasProfilesBusinessPromise = (async () => {
    try {
      // Checking for one column is enough to decide whether the migration ran.
      const res = await db.execute(sql`
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'business_name'
        limit 1
      `);
      const rows = ((res as any)?.rows ?? []) as any[];
      return rows.length > 0;
    } catch {
      return false;
    }
  })();
  return hasProfilesBusinessPromise;
}


