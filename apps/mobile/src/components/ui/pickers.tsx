import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { color as palette, radius, space } from '@/theme/tokens';
import { AppText } from './app-text';
import { IconButton } from './icon-button';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

type DatePickerProps = {
  /** Selected date-only value (YYYY-MM-DD), if any. */
  value?: string;
  onChange: (value: string) => void;
  /** Today in the owner's zone, ringed. */
  today: string;
  minDate?: string;
  maxDate?: string;
  /** Dates that get a dot (e.g. other planned visits). */
  marked?: string[];
};

/**
 * Figma "Date Picker": Monday-first month grid built from "Calendar Day" cells. Works on
 * calendar dates only, so no time-zone conversion can shift the chosen day.
 */
export function DatePicker({
  value,
  onChange,
  today,
  minDate,
  maxDate,
  marked = [],
}: DatePickerProps) {
  const start = value ?? today;
  const [cursor, setCursor] = useState({
    y: Number(start.slice(0, 4)),
    m: Number(start.slice(5, 7)),
  });

  const first = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m - 1, 1 - lead + i));
    return {
      date: iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === cursor.m - 1,
    };
  });

  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const n = m + delta;
      return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n };
    });

  return (
    <View style={styles.date}>
      <View style={styles.dateHeader}>
        <AppText variant="titleM" style={styles.grow} accessibilityRole="header">
          {MONTHS[cursor.m - 1]} {cursor.y}
        </AppText>
        <IconButton
          icon="chevron-left"
          variant="surface"
          size={32}
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
        />
        <IconButton
          icon="chevron-right"
          variant="surface"
          size={32}
          accessibilityLabel="Next month"
          onPress={() => shift(1)}
        />
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <AppText
            key={w}
            variant="caption"
            color={palette.text.secondary}
            align="center"
            style={styles.weekday}
          >
            {w}
          </AppText>
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <View key={row} style={styles.week}>
          {cells.slice(row * 7, row * 7 + 7).map((c) => {
            const disabled = (minDate && c.date < minDate) || (maxDate && c.date > maxDate);
            const selected = c.date === value;
            const isToday = c.date === today;
            const color = selected
              ? palette.text.inverse
              : disabled || !c.inMonth
                ? palette.text.secondary
                : palette.text.primary;
            return (
              <Pressable
                key={c.date}
                accessibilityRole="button"
                accessibilityLabel={`${c.day} ${MONTHS[Number(c.date.slice(5, 7)) - 1]}${isToday ? ', today' : ''}`}
                accessibilityState={{ selected, disabled: Boolean(disabled) }}
                disabled={Boolean(disabled)}
                onPress={() => onChange(c.date)}
                style={[
                  styles.day,
                  isToday && !selected && styles.today,
                  selected && styles.selected,
                ]}
              >
                <AppText variant="bodyM" color={color}>
                  {c.day}
                </AppText>
                {marked.includes(c.date) ? <View style={styles.mark} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const ROW = 40;

function Wheel<T extends string | number>({
  items,
  index,
  onIndex,
  format,
  label,
}: {
  items: readonly T[];
  index: number;
  onIndex: (i: number) => void;
  format: (item: T) => string;
  label: string;
}) {
  const [live, setLive] = useState(index);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(
      0,
      Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ROW)),
    );
    setLive(i);
    onIndex(i);
  };
  return (
    <View
      style={styles.column}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(items[index]) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === 'increment' ? index + 1 : index - 1;
        if (next >= 0 && next < items.length) onIndex(next);
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ROW }}
        contentContainerStyle={styles.wheelPad}
        scrollEventThrottle={32}
        onScroll={(e) => setLive(Math.round(e.nativeEvent.contentOffset.y / ROW))}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
        }}
        nestedScrollEnabled
      >
        {items.map((item, i) => {
          const distance = Math.abs(i - live);
          return (
            <View key={String(item)} style={styles.wheelRow}>
              <AppText
                variant={distance === 0 ? 'titleM' : 'bodyL'}
                color={distance === 0 ? palette.text.primary : palette.text.secondary}
                style={{ opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : 0.35 }}
              >
                {format(item)}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS = ['AM', 'PM'] as const;

/**
 * Figma "Time Picker": wheel-style hour, minute (5-minute steps) and period. Emits a local
 * wall-clock "HH:mm"; the caller pairs it with the relevant IANA zone.
 */
export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const h24 = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  const hourIndex = h24 % 12;
  const minuteIndex = Math.min(11, Math.round(minute / 5));
  const periodIndex = h24 < 12 ? 0 : 1;

  const emit = (hIdx: number, mIdx: number, pIdx: number) => {
    const hour = (hIdx % 12) + (pIdx === 1 ? 12 : 0);
    onChange(`${pad(hour)}:${pad(MINUTES[mIdx])}`);
  };

  return (
    <View style={styles.time}>
      <View style={styles.band} />
      <Wheel
        items={HOURS}
        index={hourIndex}
        onIndex={(i) => emit(i, minuteIndex, periodIndex)}
        format={(h) => String(h)}
        label="Hour"
      />
      <Wheel
        items={MINUTES}
        index={minuteIndex}
        onIndex={(i) => emit(hourIndex, i, periodIndex)}
        format={(m) => pad(m)}
        label="Minute"
      />
      <Wheel
        items={PERIODS}
        index={periodIndex}
        onIndex={(i) => emit(hourIndex, minuteIndex, i)}
        format={(p) => p}
        label="AM or PM"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  date: { gap: space[2] + 2 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { width: 44 },
  day: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 1.5, borderColor: palette.border.focus },
  selected: { backgroundColor: palette.bg.inverse },
  mark: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.accent.pink,
  },
  time: {
    height: 216,
    flexDirection: 'row',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[6],
  },
  band: {
    position: 'absolute',
    left: space[6],
    right: space[6],
    top: 86,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.bg.surface,
  },
  column: { flex: 1, height: 200 },
  wheelPad: { paddingVertical: ROW * 2 },
  wheelRow: { height: ROW, alignItems: 'center', justifyContent: 'center' },
});
