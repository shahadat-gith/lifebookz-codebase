import {
  StyleSheet,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useMemo } from "react";
import { MotiView } from "moti";

import { Radius, Spacing, useTheme } from "../theme";

/**
 * Pulsing placeholder block. The base primitive every skeleton is composed
 * from — theme-aware, driven by a native animated loop.
 */
export function Skeleton({
  width,
  height,
  radius = Radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useColorScheme();
  const theme = useTheme(scheme === "dark");

  return (
    <MotiView
      from={{ opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={{
        type: "timing",
        duration: 650,
        loop: true,
        repeatReverse: true,
      }}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.surfaceMuted,
        },
        style,
      ]}
    />
  );
}

/** One story card's skeleton — cover art, title lines, meta row. */
export function StoryCardSkeleton() {
  return (
    <View style={[styles.card, styles.cardPad]}>
      <Skeleton width="100%" height={130} radius={Radius.md} />
      <View style={{ marginTop: Spacing.lg, gap: Spacing.sm }}>
        <Skeleton width="88%" height={16} />
        <Skeleton width="55%" height={16} />
        <View style={[styles.row, styles.center, { marginTop: Spacing.md }]}>
          <Skeleton width={22} height={22} radius={11} />
          <Skeleton width={110} height={11} style={{ marginLeft: Spacing.sm }} />
          <View style={{ flex: 1 }} />
          <Skeleton width={60} height={11} />
        </View>
      </View>
    </View>
  );
}

/** A vertical stack of story card skeletons. */
export function StoryCardListSkeleton({ count = 3 }: { count?: number }) {
  return useMemo(
    () => (
      <View style={{ gap: Spacing.lg }}>
        {Array.from({ length: count }, (_, i) => (
          <StoryCardSkeleton key={i} />
        ))}
      </View>
    ),
    [count],
  );
}

/** Horizontal rail skeleton for the home screen. */
export function StoryRailSkeleton() {
  return (
    <View style={{ flexDirection: "row", gap: Spacing.md }}>
      {[0, 1].map((i) => (
        <View key={i} style={[styles.card, { width: 200 }]}>
          <Skeleton width="100%" height={100} radius={Radius.md} />
          <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
            <Skeleton width="90%" height={13} />
            <Skeleton width="50%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Home hero skeleton. */
export function HeroSkeleton() {
  return (
    <View style={[styles.card, { overflow: "hidden" }]}>
      <Skeleton width="100%" height={220} radius={0} />
    </View>
  );
}

/** Story detail skeleton — title block, byline, chapter entry blocks. */
export function StoryDetailSkeleton() {
  return (
    <View style={[styles.card, styles.cardPad, styles.detailWidth]}>
      <Skeleton width="85%" height={24} />
      <Skeleton width="40%" height={24} style={{ marginTop: Spacing.sm }} />
      <Skeleton width={56} height={4} radius={2} style={{ marginTop: Spacing.md }} />
      <View style={[styles.row, styles.center, { marginTop: Spacing.lg }]}>
        <Skeleton width={32} height={32} radius={16} />
        <Skeleton width={140} height={12} style={{ marginLeft: Spacing.md }} />
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={[styles.entry, { marginTop: Spacing.xl }]}>
          <Skeleton width="70%" height={15} />
          <Skeleton width="100%" height={12} style={{ marginTop: Spacing.md }} />
          <Skeleton width="100%" height={12} style={{ marginTop: Spacing.sm }} />
          <Skeleton width="65%" height={12} style={{ marginTop: Spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

/** Author header skeleton. */
export function AuthorSkeleton() {
  return (
    <View style={[styles.card, styles.cardPad]}>
      <View style={[styles.row, styles.center]}>
        <Skeleton width={72} height={72} radius={36} />
        <View style={{ flex: 1, marginLeft: Spacing.lg, gap: Spacing.sm }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={12} />
          <Skeleton width={90} height={20} radius={Radius.pill} />
        </View>
      </View>
      <Skeleton width="100%" height={12} style={{ marginTop: Spacing.lg }} />
      <Skeleton width="70%" height={12} style={{ marginTop: Spacing.sm }} />
    </View>
  );
}

/** Booking card skeleton. */
export function BookingCardSkeleton() {
  return (
    <View style={[styles.card, styles.cardPad]}>
      <View style={[styles.row, styles.between, styles.center]}>
        <Skeleton width={90} height={20} radius={Radius.pill} />
        <Skeleton width={70} height={11} />
      </View>
      <Skeleton width="45%" height={16} style={{ marginTop: Spacing.lg }} />
      <Skeleton width="30%" height={12} style={{ marginTop: Spacing.sm }} />
      <Skeleton width="100%" height={12} style={{ marginTop: Spacing.md }} />
      <View style={[styles.row, { marginTop: Spacing.lg }]}>
        <Skeleton width={110} height={36} radius={Radius.md} />
      </View>
    </View>
  );
}

export function BookingListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: Spacing.md }}>
      {Array.from({ length: count }, (_, i) => (
        <BookingCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Expert match card skeleton (consult results). */
export function ExpertCardSkeleton() {
  return (
    <View style={[styles.card, styles.cardPad]}>
      <View style={[styles.row, styles.center]}>
        <Skeleton width={48} height={48} radius={24} />
        <View style={{ flex: 1, marginLeft: Spacing.md, gap: Spacing.sm }}>
          <Skeleton width="55%" height={15} />
          <Skeleton width="35%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={12} style={{ marginTop: Spacing.lg }} />
      <Skeleton width="80%" height={12} style={{ marginTop: Spacing.sm }} />
      <Skeleton width={140} height={36} radius={Radius.md} style={{ marginTop: Spacing.lg }} />
    </View>
  );
}

/**
 * Full-page skeleton shown while the app restores its session on launch —
 * mirrors the home layout (brand row, hero, quick actions, promo, rail, cards)
 * so the screen doesn't jump when real content swaps in.
 */
export function HomeSkeleton() {
  return (
    <View style={{ gap: Spacing.xl }}>
      {/* Brand row */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
        <Skeleton width={40} height={40} radius={Radius.md} />
        <View style={{ gap: Spacing.xs }}>
          <Skeleton width={110} height={16} />
          <Skeleton width={150} height={10} />
        </View>
      </View>
      {/* Hero */}
      <HeroSkeleton />
      {/* Quick actions */}
      <View style={{ flexDirection: "row", gap: Spacing.md }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.card, { flex: 1, alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.lg }]}
          >
            <Skeleton width={40} height={40} radius={Radius.md} />
            <Skeleton width={48} height={10} />
          </View>
        ))}
      </View>
      {/* Consult promo */}
      <View style={[styles.card, { padding: Spacing.lg, flexDirection: "row", alignItems: "center", gap: Spacing.lg }]}>
        <Skeleton width={76} height={76} radius={Radius.lg} />
        <View style={{ flex: 1, gap: Spacing.sm }}>
          <Skeleton width="55%" height={15} />
          <Skeleton width="90%" height={11} />
          <Skeleton width="70%" height={11} />
        </View>
      </View>
      {/* Rail */}
      <View style={{ gap: Spacing.lg }}>
        <Skeleton width={130} height={18} />
        <StoryRailSkeleton />
      </View>
      {/* Feed cards */}
      <StoryCardListSkeleton count={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
    borderRadius: Radius.lg,
  },
  cardPad: { padding: Spacing.lg },
  row: { flexDirection: "row" },
  center: { alignItems: "center" },
  between: { justifyContent: "space-between" },
  entry: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: 0,
  },
  detailWidth: { width: "100%" },
});
