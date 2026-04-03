import React from "react";
import {
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Image as ExpoImage, type ImageContentFit } from "expo-image";

type CachedRemoteImageProps = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
};

type CachedRemoteBackgroundProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
  children?: React.ReactNode;
};

function normalizeUrls(urls: Array<string | null | undefined>) {
  return [...new Set(urls.filter((value): value is string => typeof value === "string" && /^https?:\/\//i.test(value)))];
}

export async function prefetchRemoteImages(urls: Array<string | null | undefined>) {
  const normalizedUrls = normalizeUrls(urls);
  if (!normalizedUrls.length) {
    return;
  }

  try {
    await ExpoImage.prefetch(normalizedUrls, "memory-disk");
  } catch (error) {
    console.warn("Failed to prefetch remote images", error);
  }
}

export function CachedRemoteImage({
  uri,
  style,
  contentFit = "cover",
  transition = 120,
}: CachedRemoteImageProps) {
  return (
    <ExpoImage
      source={uri}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
    />
  );
}

export function CachedRemoteBackground({
  uri,
  style,
  imageStyle,
  contentFit = "cover",
  transition = 120,
  children,
}: CachedRemoteBackgroundProps) {
  return (
    <View style={style}>
      <ExpoImage
        source={uri}
        style={[StyleSheet.absoluteFillObject, imageStyle]}
        contentFit={contentFit}
        transition={transition}
        cachePolicy="memory-disk"
      />
      {children}
    </View>
  );
}