import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { color as palette, radius, space } from '@/theme/tokens';
import { AppText } from './app-text';
import { Avatar, type AvatarKey } from './avatar';
import { Icon, type IconName } from './icon';

type PetPillProps = Omit<PressableProps, 'children' | 'style'> & {
  name: string;
  avatar?: AvatarKey;
  selected?: boolean;
};

/** Figma "Pet Pill": active-pet switcher. Selection is announced, not only shown in black. */
export function PetPill({ name, avatar, selected = false, disabled, ...rest }: PetPillProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.pill,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Avatar avatar={avatar} size={32} />
      <AppText variant="label" color={selected ? palette.text.inverse : palette.text.primary}>
        {name}
      </AppText>
    </Pressable>
  );
}

type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  icon?: IconName;
  /** Multi-select chips show a check when selected (Figma "Chip"). */
  multi?: boolean;
};

/** Figma "Chip": filter and enum chip. */
export function Chip({ label, selected = false, icon, multi = false, ...rest }: ChipProps) {
  const leading: IconName | undefined = selected && multi ? 'check' : icon;
  const tint = selected ? palette.text.inverse : palette.text.primary;
  return (
    <Pressable
      {...rest}
      accessibilityRole={multi ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={multi ? { checked: selected } : { selected }}
      style={({ pressed }) => [
        styles.chip,
        leading ? styles.chipWithIcon : null,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      {leading ? <Icon name={leading} size={16} color={tint} /> : null}
      <AppText variant="bodyM" color={tint} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingLeft: space[1],
    paddingRight: space[4],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  chip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 2,
    paddingLeft: space[3] + 2,
    paddingRight: space[4],
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  chipWithIcon: { paddingLeft: space[3] },
  selected: {
    backgroundColor: palette.bg.inverse,
    borderWidth: 1,
    borderColor: palette.bg.inverse,
  },
  unselected: {
    backgroundColor: palette.bg.screen,
    borderWidth: 1,
    borderColor: palette.border.default,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
