import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { color as palette, fontFamily, radius, space, type as typeScale } from '@/theme/tokens';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

type FieldState = 'default' | 'focused' | 'error' | 'disabled';

function boxStyle(state: FieldState) {
  switch (state) {
    case 'focused':
      return styles.boxFocused;
    case 'error':
      return styles.boxError;
    case 'disabled':
      return styles.boxDisabled;
    default:
      return null;
  }
}

/** Label (Figma Label style) shared by fields and grouped controls. */
export function FieldLabel({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <AppText variant="label" color={muted ? palette.text.secondary : palette.text.primary}>
      {children}
    </AppText>
  );
}

/** A labelled group (segmented control, chips, pills) with the field's 8 px label gap. */
export function FieldGroup({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field} accessibilityLabel={label}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      <Helper helper={helper} error={error} />
    </View>
  );
}

function Helper({ helper, error }: { helper?: string; error?: string }) {
  if (!error && !helper) return null;
  return (
    <AppText
      variant="caption"
      color={error ? palette.text.danger : palette.text.secondary}
      accessibilityLiveRegion={error ? 'polite' : 'none'}
    >
      {error ?? helper}
    </AppText>
  );
}

type FieldProps = {
  label: string;
  value?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  /** Makes the field a picker (select, date, time): it opens something instead of typing. */
  onPress?: () => void;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  /** Text before the value, e.g. "+63". */
  prefix?: string;
  /** Unit after the value, e.g. "kg" or "tablets". */
  suffix?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  /** Password field with a show/hide control. */
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Figma "Field": label, 52 px surface box, optional icons/prefix/suffix, helper or error.
 * States: Empty, Filled, Focused (white + focus border), Error (danger tint), Disabled.
 */
export function Field({
  label,
  value = '',
  placeholder,
  onChangeText,
  onPress,
  leadingIcon,
  trailingIcon,
  prefix,
  suffix,
  helper,
  error,
  disabled = false,
  secure = false,
  keyboardType,
  autoCapitalize,
  autoComplete,
  maxLength,
  style,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const state: FieldState = disabled
    ? 'disabled'
    : error
      ? 'error'
      : focused
        ? 'focused'
        : 'default';
  const valueColor = disabled ? palette.text.secondary : palette.text.primary;
  const trailing: IconName | undefined = error ? 'alert-triangle' : trailingIcon;

  const leading = (
    <>
      {leadingIcon ? <Icon name={leadingIcon} size={20} color={palette.text.secondary} /> : null}
      {prefix ? (
        <AppText variant="bodyL" color={palette.text.secondary}>
          {prefix}
        </AppText>
      ) : null}
    </>
  );
  const after = (
    <>
      {suffix ? (
        <AppText variant="bodyL" color={palette.text.secondary}>
          {suffix}
        </AppText>
      ) : null}
      {secure ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          onPress={() => setRevealed((r) => !r)}
          hitSlop={10}
        >
          <Icon name="eye" size={20} color={palette.text.secondary} />
        </Pressable>
      ) : null}
      {trailing ? (
        <Icon
          name={trailing}
          size={20}
          color={
            trailing === 'alert-triangle'
              ? palette.danger.default
              : trailing === 'chevron-down'
                ? palette.text.primary
                : palette.text.secondary
          }
        />
      ) : null}
    </>
  );

  return (
    <View style={[styles.field, style]}>
      <FieldLabel muted={disabled}>{label}</FieldLabel>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${value || placeholder || 'not set'}`}
          accessibilityHint={error}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          style={[styles.box, boxStyle(state)]}
        >
          {leading}
          <AppText
            variant="bodyL"
            color={value ? valueColor : palette.text.secondary}
            numberOfLines={1}
            style={styles.grow}
          >
            {value || placeholder}
          </AppText>
          {after}
        </Pressable>
      ) : (
        <View style={[styles.box, boxStyle(state)]}>
          {leading}
          <TextInput
            accessibilityLabel={label}
            accessibilityHint={error}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={palette.text.secondary}
            editable={!disabled}
            secureTextEntry={secure && !revealed}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            maxLength={maxLength}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, { color: valueColor }]}
          />
          {after}
        </View>
      )}
      <Helper helper={helper} error={error} />
    </View>
  );
}

type TextareaProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength: number;
  error?: string;
  helper?: string;
  disabled?: boolean;
};

/** Figma "Textarea": notes, dose instructions, void and cancel reasons, with a counter. */
export function Textarea({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  error,
  helper,
  disabled = false,
}: TextareaProps) {
  const [focused, setFocused] = useState(false);
  const state: FieldState = disabled
    ? 'disabled'
    : error
      ? 'error'
      : focused
        ? 'focused'
        : 'default';
  return (
    <View style={styles.field}>
      <FieldLabel muted={disabled}>{label}</FieldLabel>
      <View style={[styles.area, boxStyle(state)]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.text.secondary}
          editable={!disabled}
          multiline
          maxLength={maxLength}
          textAlignVertical="top"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.areaInput,
            { color: disabled ? palette.text.secondary : palette.text.primary },
          ]}
        />
        <AppText variant="caption" color={palette.text.secondary} align="right">
          {value.length} / {maxLength}
        </AppText>
      </View>
      <Helper helper={helper} error={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space[2] },
  box: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2] + 2,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    backgroundColor: palette.bg.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxFocused: { backgroundColor: palette.bg.screen, borderColor: palette.border.focus },
  boxError: { backgroundColor: palette.danger.subtle, borderColor: palette.border.danger },
  boxDisabled: { backgroundColor: palette.bg.surfaceStrong },
  grow: { flex: 1 },
  input: {
    flex: 1,
    height: '100%',
    padding: 0,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyL.fontSize,
  },
  area: {
    minHeight: 128,
    gap: space[2],
    paddingTop: space[3] + 2,
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderRadius: radius.md,
    backgroundColor: palette.bg.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  areaInput: {
    flex: 1,
    minHeight: 72,
    padding: 0,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyM.fontSize,
    lineHeight: typeScale.bodyM.lineHeight,
  },
});
