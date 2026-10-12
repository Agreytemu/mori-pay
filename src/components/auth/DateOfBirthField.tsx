import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { useAppTheme } from '@/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FIRST_YEAR = 1900;

type PickerView = 'calendar' | 'months' | 'years';

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function clampDay(year: number, month: number, day: number): Date {
  return new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12);
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
    : '';
}

export function DateOfBirthField({
  value,
  onChangeText,
  error,
}: {
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
}) {
  const { colors, radius, space } = useAppTheme();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  }, []);
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<PickerView>('calendar');
  const [cursor, setCursor] = useState(() => parseDate(value) ?? today);
  const [draft, setDraft] = useState<Date | null>(() => parseDate(value));
  const [yearRangeStart, setYearRangeStart] = useState(
    () => Math.floor((parseDate(value)?.getFullYear() ?? today.getFullYear()) / 10) * 10,
  );

  const openPicker = () => {
    const initialDate = parseDate(value) ?? today;
    setCursor(initialDate);
    setDraft(parseDate(value));
    setYearRangeStart(Math.floor(initialDate.getFullYear() / 10) * 10);
    setView('calendar');
    setVisible(true);
  };

  const changeMonth = (offset: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1, 12);
    if (
      next.getFullYear() < FIRST_YEAR
      || next.getFullYear() > today.getFullYear()
      || (next.getFullYear() === today.getFullYear() && next.getMonth() > today.getMonth())
    ) return;
    setCursor(clampDay(next.getFullYear(), next.getMonth(), cursor.getDate()));
  };

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const yearEnd = Math.min(yearRangeStart + 9, today.getFullYear());
  const years = Array.from(
    { length: yearEnd - yearRangeStart + 1 },
    (_, index) => yearRangeStart + index,
  );

  return (
    <View style={styles.field}>
      <AppText variant="bodySmallStrong">Date of birth (optional)</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `Date of birth, ${formatDate(value)}` : 'Choose date of birth'}
        accessibilityHint="Opens a calendar to choose a year, month, and day"
        onPress={openPicker}
        style={({ pressed }) => [
          styles.dateCard,
          {
            backgroundColor: pressed ? colors.surfacePressed : colors.surface,
            borderColor: error ? colors.error : colors.border,
            borderRadius: radius.md,
          },
        ]}>
        <View style={[styles.calendarIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.sm }]}>
          <AppIcon name="calendar" size={20} color={colors.primary} />
        </View>
        <View style={styles.dateCopy}>
          <AppText variant={value ? 'bodyStrong' : 'bodySmall'} color={value ? colors.text : colors.textTertiary}>
            {value ? formatDate(value) : 'Tap to choose your date of birth'}
          </AppText>
          {!value ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Choose the year, month, and day
            </AppText>
          ) : null}
        </View>
        <AppIcon name="chevronRight" size={17} color={colors.textTertiary} />
      </Pressable>
      {error ? <AppText variant="caption" color={colors.error}>{error}</AppText> : null}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close date picker"
            onPress={() => setVisible(false)}
            style={[StyleSheet.absoluteFill, styles.scrim]}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                padding: space.lg,
                paddingBottom: Math.max(insets.bottom, space.lg),
              },
            ]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeading}>
                <AppText variant="title2">Date of birth</AppText>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  Choose a year, month, and day
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close date picker"
                onPress={() => setVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.surfaceMuted, borderRadius: radius.circle }]}>
                <AppIcon name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={[styles.calendar, { borderColor: colors.border, borderRadius: radius.lg }]}
              contentContainerStyle={styles.calendarContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.calendarHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose month"
                  onPress={() => setView(view === 'months' ? 'calendar' : 'months')}
                  style={[styles.headerSelect, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
                  <AppText variant="bodySmallStrong">{MONTHS[cursor.getMonth()]}</AppText>
                  <AppIcon name="chevronDown" size={14} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose year"
                  onPress={() => {
                    setYearRangeStart(Math.floor(cursor.getFullYear() / 10) * 10);
                    setView(view === 'years' ? 'calendar' : 'years');
                  }}
                  style={[styles.headerSelect, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
                  <AppText variant="bodySmallStrong">{cursor.getFullYear()}</AppText>
                  <AppIcon name="chevronDown" size={14} color={colors.textSecondary} />
                </Pressable>
                {view === 'calendar' ? (
                  <View style={styles.monthActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Previous month"
                      disabled={cursor.getFullYear() === FIRST_YEAR && cursor.getMonth() === 0}
                      onPress={() => changeMonth(-1)}
                      style={[styles.monthButton, { backgroundColor: colors.surfaceMuted }]}>
                      <AppIcon name="chevronLeft" size={17} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Next month"
                      disabled={cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()}
                      onPress={() => changeMonth(1)}
                      style={[styles.monthButton, { backgroundColor: colors.surfaceMuted }]}>
                      <AppIcon name="chevronRight" size={17} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {view === 'calendar' ? (
                <>
                  <View style={styles.dayGrid}>
                    {WEEKDAYS.map((day) => (
                      <AppText key={day} variant="caption" color={colors.textTertiary} align="center" style={styles.dayCell}>
                        {day}
                      </AppText>
                    ))}
                    {Array.from({ length: leadingDays }, (_, index) => (
                      <View key={`empty-${index}`} style={styles.dayCell} />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, index) => {
                      const day = index + 1;
                      const date = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12);
                      const disabled = date > today;
                      const selected = draft !== null && sameDay(date, draft);
                      return (
                        <Pressable
                          key={day}
                          accessibilityRole="button"
                          accessibilityLabel={`${MONTHS[cursor.getMonth()]} ${day}, ${cursor.getFullYear()}`}
                          accessibilityState={{ selected, disabled }}
                          disabled={disabled}
                          onPress={() => setDraft(date)}
                          style={[
                            styles.dayCell,
                            styles.dayButton,
                            selected && { backgroundColor: colors.primary, borderRadius: radius.circle },
                            disabled && styles.disabledDay,
                          ]}>
                          <AppText
                            variant={selected ? 'bodySmallStrong' : 'bodySmall'}
                            color={selected ? colors.onPrimary : disabled ? colors.textTertiary : colors.text}>
                            {day}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : view === 'months' ? (
                <View style={styles.optionGrid}>
                  {MONTHS.map((month, index) => {
                    const disabled = cursor.getFullYear() === today.getFullYear() && index > today.getMonth();
                    const selected = cursor.getMonth() === index;
                    return (
                      <Pressable
                        key={month}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled}
                        onPress={() => {
                          setCursor(clampDay(cursor.getFullYear(), index, cursor.getDate()));
                          setView('calendar');
                        }}
                        style={[
                          styles.option,
                          { borderRadius: radius.md },
                          selected && { backgroundColor: colors.primary },
                          disabled && styles.disabledDay,
                        ]}>
                        <AppText variant={selected ? 'bodySmallStrong' : 'bodySmall'} color={selected ? colors.onPrimary : colors.text}>
                          {month}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.yearPicker}>
                  <View style={styles.yearRange}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Previous ten years"
                      disabled={yearRangeStart <= FIRST_YEAR}
                      onPress={() => setYearRangeStart(Math.max(FIRST_YEAR, yearRangeStart - 10))}
                      style={[styles.monthButton, { backgroundColor: colors.surfaceMuted }]}>
                      <AppIcon name="chevronLeft" size={17} color={colors.textSecondary} />
                    </Pressable>
                    <AppText variant="bodySmallStrong">{yearRangeStart} – {yearEnd}</AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Next ten years"
                      disabled={yearEnd >= today.getFullYear()}
                      onPress={() => setYearRangeStart(yearRangeStart + 10)}
                      style={[styles.monthButton, { backgroundColor: colors.surfaceMuted }]}>
                      <AppIcon name="chevronRight" size={17} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                  <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid} showsVerticalScrollIndicator={false}>
                    {years.map((year) => {
                      const selected = cursor.getFullYear() === year;
                      return (
                        <Pressable
                          key={year}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => {
                            setCursor(clampDay(year, cursor.getMonth(), cursor.getDate()));
                            setView('calendar');
                          }}
                          style={[
                            styles.yearOption,
                            { borderRadius: radius.md },
                            selected && { backgroundColor: colors.primary },
                          ]}>
                          <AppText variant={selected ? 'bodySmallStrong' : 'bodySmall'} color={selected ? colors.onPrimary : colors.text}>
                            {year}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <SecondaryButton label="Cancel" block onPress={() => setVisible(false)} />
              <PrimaryButton
                label="Use selected date"
                block
                disabled={!draft || draft > today}
                onPress={() => {
                  if (draft) onChangeText(toIsoDate(draft));
                  setVisible(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  dateCard: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calendarIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dateCopy: { flex: 1, gap: 2 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 12, maxHeight: '92%', minHeight: 0, overflow: 'hidden' },
  sheetContent: { flexShrink: 1, minHeight: 0 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetHeading: { flex: 1, gap: 3 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  calendar: { flexShrink: 1, minHeight: 0, borderWidth: StyleSheet.hairlineWidth },
  calendarContent: { padding: 12, gap: 12 },
  calendarHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSelect: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10 },
  monthActions: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  monthButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 40, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderRadius: 20 },
  disabledDay: { opacity: 0.38 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { width: '33.3333%', minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  yearPicker: { gap: 8 },
  yearRange: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearScroll: { maxHeight: 228 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  yearOption: { width: '25%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
});
