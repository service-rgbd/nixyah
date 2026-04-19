import avatarUrl from "@assets/avatar.png";

export type ProfileAccountType = "profile" | "residence" | "salon" | "adult_shop" | null | undefined;

const DEFAULT_ACCOUNT_PHOTOS: Record<Exclude<ProfileAccountType, null | undefined>, string> = {
  profile: avatarUrl,
  residence: "/default-avatars/residence.png",
  salon: "/default-avatars/salon.png",
  adult_shop: "/default-avatars/adult-shop.png",
};

export function getDefaultProfilePhoto(accountType: ProfileAccountType): string {
  return DEFAULT_ACCOUNT_PHOTOS[accountType ?? "profile"] ?? avatarUrl;
}

export function getProfilePhoto(photoUrl: string | null | undefined, accountType: ProfileAccountType): string {
  return photoUrl || getDefaultProfilePhoto(accountType);
}
