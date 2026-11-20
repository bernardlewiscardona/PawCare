import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color as palette, radius, shadow, space } from '@/theme/tokens';
import { AppText } from './app-text';
import { IconTile } from './badges';
import { Button } from './button';
import { Icon, type IconName } from './icon';
import type { IllustrationName } from './illustration';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';

const BANNER: Record<BannerTone, { bg: string; icon: IconName }> = {
  info: { bg: palette.info.subtle, icon: 'info' },
  warning: { bg: palette.warning.subtle, icon: 'alert-triangle' },
  danger: { bg: palette.danger.subtle, icon: 'alert-triangle' },
  success: { bg: palette.success.subtle, icon: 'circle-check' },
  neutral: { bg: palette.bg.surface, icon: 'info' },
};

type BannerProps = {
  tone: BannerTone;
  title?: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Figma "Banner": inline alert (push off, low stock, archived pet, blocked actions). */
export function Banner({ tone, title, body, actionLabel, onAction }: BannerProps) {
  const meta = BANNER[tone];
  const urgent = tone === 'danger' || tone === 'warning';
  return (
    <View
      style={[styles.banner, { backgroundColor: meta.bg }]}
      accessibilityRole={urgent ? 'alert' : undefined}
    >
      <Icon name={meta.icon} size={20} />
      <View style={styles.bannerText}>
        {title ? <AppText variant="titleS">{title}</AppText> : null}
        <AppText variant="bodyM" color={title ? palette.text.secondary : palette.text.primary}>
          {body}
        </AppText>
        {actionLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            hitSlop={10}
            style={styles.bannerAction}
          >
            <AppText variant="label">{actionLabel}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type EmptyStateProps = {
  illustration: IllustrationName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Leading icon on the action; Add actions use plus. */
  actionIcon?: IconName | null;
};

/** Figma "Empty State": no-data state with illustration, copy and an optional action. */
export function EmptyState({
  illustration,
  title,
  body,
  actionLabel,
  onAction,
  actionIcon = 'plus',
}: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <IconTile illustration={illustration} size="large" tone="surface" />
      <AppText variant="titleM" align="center">
        {title}
      </AppText>
      <AppText variant="bodyM" color={palette.text.secondary} align="center">
        {body}
      </AppText>
      {actionLabel ? (
        <Button
          label={actionLabel}
          size="small"
          icon={actionIcon ?? undefined}
          onPress={onAction}
        />
      ) : null}
    </View>
  );
}

/** Figma "Skeleton": loading placeholder. Announced once by the screen, not per block. */
export function Skeleton({
  shape = 'block',
  width = '100%',
  height,
}: {
  shape?: 'line' | 'block' | 'circle';
  width?: DimensionValue;
  height?: number;
}) {
  const h = height ?? (shape === 'line' ? 12 : shape === 'circle' ? 44 : 88);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: shape === 'circle' ? h : width,
        height: h,
        borderRadius: shape === 'line' ? radius.xs : shape === 'circle' ? radius.full : radius.lg,
        backgroundColor: palette.bg.surfaceStrong,
      }}
    />
  );
}

/** Figma "Progress Bar": upload progress. */
export function ProgressBar({
  value,
  tone = 'dark',
}: {
  value: number;
  tone?: 'dark' | 'success' | 'danger';
}) {
  const fill =
    tone === 'success'
      ? palette.success.default
      : tone === 'danger'
        ? palette.danger.default
        : palette.text.primary;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <View
        style={[styles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: fill }]}
      />
    </View>
  );
}

type ToastTone = 'success' | 'error' | 'info';
type ToastState = { id: number; message: string; tone: ToastTone } | null;

const ToastContext = createContext<{
  show: (message: string, tone?: ToastTone) => void;
  setBottomInset: (px: number) => void;
} | null>(null);

/**
 * Figma "Toast": save confirmation or failure, floating above the tab or bottom bar. Shown only
 * after the change is applied, and announced to screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);
  const [bottomInset, setBottomInset] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(() => ({ show, setBottomInset }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.toastWrap,
            { bottom: Math.max(insets.bottom, space[3]) + space[2] + bottomInset },
          ]}
        >
          <Pressable
            onPress={() => setToast(null)}
            style={styles.toast}
            accessibilityLiveRegion="polite"
          >
            <View
              style={[
                styles.toastIcon,
                {
                  backgroundColor:
                    toast.tone === 'error'
                      ? palette.danger.default
                      : toast.tone === 'info'
                        ? palette.info.default
                        : palette.success.default,
                },
              ]}
            >
              <Icon
                name={toast.tone === 'error' ? 'x' : toast.tone === 'info' ? 'info' : 'check'}
                size={14}
              />
            </View>
            <AppText variant="bodyM" color={palette.text.inverse} style={styles.toastText}>
              {toast.message}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingVertical: space[3] + 2,
    paddingLeft: space[3] + 2,
    paddingRight: space[4],
    borderRadius: radius.lg,
  },
  bannerText: { flex: 1, gap: space[1] },
  bannerAction: { alignSelf: 'flex-start', paddingTop: space[1] },
  empty: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
    paddingHorizontal: space[6],
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: palette.bg.surfaceStrong,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius.full },
  toastWrap: { position: 'absolute', left: space[5], right: space[5] },
  toast: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2] + 2,
    paddingVertical: space[3],
    paddingLeft: space[3],
    paddingRight: space[4] + 2,
    borderRadius: radius.full,
    backgroundColor: palette.bg.inverse,
    ...shadow.float,
  },
  toastIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { flex: 1 },
});
