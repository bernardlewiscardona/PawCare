import { localDate } from '@pawcare/core';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { useDataState } from '@/data';
import { color as palette, radius, space } from '@/theme/tokens';

/** Development-only readout of the phone database. Status is stated in text. */
export function DevDataStatus() {
  const data = useDataState();
  const zoneSource = typeof Intl.supportedValuesOf === 'function' ? 'native' : 'fallback';
  const rows: [string, string][] = [['State', data.state]];
  if (data.state === 'ready') {
    rows.push(['Encrypted', String(data.encrypted)], ['User version', String(data.userVersion)]);
  }
  rows.push(['Zone source', zoneSource], ['Today in Manila', localDate('Asia/Manila')]);

  return (
    <View style={styles.panel} accessibilityRole="summary">
      <AppText variant="titleS">Development data</AppText>
      {rows.map(([label, value]) => (
        <AppText key={label} variant="bodyM" selectable>
          {label}: {value}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space[1],
    padding: space[4],
    borderRadius: radius.md,
    backgroundColor: palette.bg.surface,
  },
});
