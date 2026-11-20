import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as palette, space } from '@/theme/tokens';
import { useToast } from './feedback';
import { TAB_BAR_HEIGHT, useTabBarClearance } from './tab-bar';

/** Scrolling tab screen under the floating tab bar (Figma Content: p4,20,16,20, gap 12). */
export function TabScreen({
  header,
  children,
  gap = space[3],
  paddingTop = space[1],
}: {
  header?: ReactNode;
  children: ReactNode;
  gap?: number;
  paddingTop?: number;
}) {
  const clearance = useTabBarClearance();
  const { setBottomInset } = useToast();
  useFocusEffect(
    useCallback(() => {
      setBottomInset(TAB_BAR_HEIGHT + space[2]);
      return () => setBottomInset(0);
    }, [setBottomInset]),
  );
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { gap, paddingTop, paddingBottom: clearance }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type StackScreenProps = {
  header: ReactNode;
  children: ReactNode;
  /** Sticky Figma "Bottom bar" (top border, 12/20/4/20 padding). */
  bottomBar?: ReactNode;
  /** detail = gap 14, padding 8/20/24/20; form = gap 8, padding 4/20/8/20. */
  layout?: 'detail' | 'form';
  gap?: number;
  background?: string;
  /** Centre short content vertically (success and progress states). */
  centered?: boolean;
};

/** Stack screen: header, scrolling content and an optional sticky bottom bar. */
export function StackScreen({
  header,
  children,
  bottomBar,
  layout = 'detail',
  gap,
  background = palette.bg.screen,
  centered = false,
}: StackScreenProps) {
  const insets = useSafeAreaInsets();
  const { setBottomInset } = useToast();
  const [barHeight, setBarHeight] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setBottomInset(barHeight);
      return () => setBottomInset(0);
    }, [barHeight, setBottomInset]),
  );
  const form = layout === 'form';
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: background }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {header}
        <ScrollView
          contentContainerStyle={[
            form ? styles.form : styles.detail,
            { gap: gap ?? (form ? space[2] : space[3] + 2) },
            centered && styles.centered,
            !bottomBar && {
              paddingBottom: (form ? space[2] : space[6]) + Math.max(insets.bottom, space[4]),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {bottomBar ? (
          <View
            onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
            style={[styles.bar, { paddingBottom: space[1] + Math.max(insets.bottom, space[3]) }]}
          >
            {bottomBar}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Horizontal row that bleeds to the screen edges so chips/pills scroll under the gutter. */
export function BleedRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.bleedRow}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Wrapping row of chips or tags (6 or 8 px gaps). */
export function WrapRow({ children, gap = space[2] }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.wrap, { gap }]}>{children}</View>;
}

/** Two fields side by side (12 px gap, each takes half). */
export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

export const half = { flex: 1 } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg.screen },
  fill: { flex: 1 },
  content: { paddingHorizontal: space[5] },
  detail: { paddingTop: space[2], paddingHorizontal: space[5], paddingBottom: space[6] },
  form: { paddingTop: space[1], paddingHorizontal: space[5], paddingBottom: space[6] },
  centered: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  bar: {
    gap: space[2],
    paddingTop: space[3],
    paddingHorizontal: space[5],
    backgroundColor: palette.bg.screen,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
  },
  bleed: { marginHorizontal: -space[5], flexGrow: 0 },
  bleedRow: { gap: space[2], paddingHorizontal: space[5], alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  fieldRow: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
});
