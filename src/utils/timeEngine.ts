import {
  AcademicCalendarConfig,
  BellSlot,
  CourseName,
  CurriculumEntry,
  DayOfWeek,
  HolidayPeriod,
  ScheduleEntry,
} from '../types/curriculum';
import { WEEK_DATE_RANGES } from '../data/defaultData';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
];

const TURKISH_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toMidnightDate(dateStrOrObj: string | Date): Date {
  if (typeof dateStrOrObj === 'string') {
    const [y, m, d] = dateStrOrObj.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(
    dateStrOrObj.getFullYear(),
    dateStrOrObj.getMonth(),
    dateStrOrObj.getDate(),
    0,
    0,
    0,
    0
  );
}

export interface AcademicWeekCalculation {
  weekNumber: number;
  dateRangeText: string;
  semesterLabel: '1. Dönem' | '2. Dönem';
  activeHoliday: HolidayPeriod | null;
  dayOfWeek: DayOfWeek;
  isWeekend: boolean;
  formattedFullDate: string;
}

export function calculateAcademicWeek(
  currentDate: Date,
  config: AcademicCalendarConfig
): AcademicWeekCalculation {
  const target = toMidnightDate(currentDate);
  const start = toMidnightDate(config.startDate);

  const jsDay = currentDate.getDay(); // 0=Pazar, 1=Pzt ... 6=Cmt
  const isWeekend = jsDay === 0 || jsDay === 6;
  const dayOfWeek: DayOfWeek =
    jsDay >= 1 && jsDay <= 5 ? DAYS_OF_WEEK[jsDay - 1] : 'Cuma';

  const dayNamesFull = [
    'Pazar',
    'Pazartesi',
    'Salı',
    'Çarşamba',
    'Perşembe',
    'Cuma',
    'Cumartesi',
  ];
  const formattedFullDate = `${currentDate.getDate()} ${
    TURKISH_MONTHS[currentDate.getMonth()]
  } ${currentDate.getFullYear()} ${dayNamesFull[jsDay]}`;

  // Check if today falls inside any holiday period
  let activeHoliday: HolidayPeriod | null = null;
  for (const h of config.holidays) {
    const hStart = toMidnightDate(h.startDate);
    const hEnd = toMidnightDate(h.endDate);
    if (target >= hStart && target <= hEnd) {
      activeHoliday = h;
      break;
    }
  }

  if (target < start) {
    return {
      weekNumber: 1,
      dateRangeText: WEEK_DATE_RANGES[1]?.range || '7 - 11 Eylül',
      semesterLabel: '1. Dönem',
      activeHoliday,
      dayOfWeek,
      isWeekend,
      formattedFullDate,
    };
  }

  // Iterate week by week (Monday to Sunday) from startDate, skipping full-week breaks
  let cursor = new Date(start);
  let eduWeek = 1;
  let matchedWeek = 1;
  let matchedMonday = new Date(start);

  while (eduWeek <= config.totalWeeks && cursor <= target) {
    const weekStart = new Date(cursor);
    const weekFriday = new Date(cursor);
    weekFriday.setDate(weekFriday.getDate() + 4);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const isFullBreakWeek = config.holidays.some((h) => {
      if (!h.affectsWeekCount) return false;
      const hStart = toMidnightDate(h.startDate);
      const hEnd = toMidnightDate(h.endDate);
      return weekStart <= hEnd && weekFriday >= hStart;
    });

    if (!isFullBreakWeek) {
      matchedWeek = eduWeek;
      matchedMonday = new Date(weekStart);
      if (target >= weekStart && target <= weekEnd) {
        break;
      }
      eduWeek++;
    }

    cursor.setDate(cursor.getDate() + 7);
  }

  const finalWeek = Math.max(1, Math.min(config.totalWeeks, matchedWeek));
  const matchedFriday = new Date(matchedMonday);
  matchedFriday.setDate(matchedFriday.getDate() + 4);

  const dynamicRange =
    matchedMonday.getMonth() === matchedFriday.getMonth()
      ? `${matchedMonday.getDate()} - ${matchedFriday.getDate()} ${
          TURKISH_MONTHS[matchedFriday.getMonth()]
        }`
      : `${matchedMonday.getDate()} ${
          TURKISH_MONTHS[matchedMonday.getMonth()]
        } - ${matchedFriday.getDate()} ${
          TURKISH_MONTHS[matchedFriday.getMonth()]
        }`;

  const dateRangeText = WEEK_DATE_RANGES[finalWeek]?.range || dynamicRange;
  const semesterLabel = finalWeek <= 18 ? '1. Dönem' : '2. Dönem';

  return {
    weekNumber: finalWeek,
    dateRangeText,
    semesterLabel,
    activeHoliday,
    dayOfWeek,
    isWeekend,
    formattedFullDate,
  };
}

export type LiveMatchState =
  | 'IN_LESSON'
  | 'IN_BREAK'
  | 'IN_FREE_PERIOD'
  | 'BEFORE_SCHOOL'
  | 'AFTER_SCHOOL'
  | 'WEEKEND';

export interface LiveLessonMatch {
  state: LiveMatchState;
  isLunchBreak?: boolean;
  breakStart?: string;
  breakEnd?: string;
  activeOrNextLesson: ScheduleEntry | null;
  currentBellSlot: BellSlot | null;
  remainingMinutes: number;
  remainingSeconds: number;
  elapsedMinutes: number;
  totalMinutes: number;
  progressPercent: number;
  statusHeadline: string;
  statusSubline: string;
}

export function matchCurrentOrNextLesson(
  currentDate: Date,
  activeDay: DayOfWeek,
  isWeekend: boolean,
  schedule: ScheduleEntry[],
  bellSchedule: BellSlot[]
): LiveLessonMatch {
  const sortedBells = [...bellSchedule].sort((a, b) => a.period - b.period);
  const dayLessons = schedule
    .filter((s) => s.day === activeDay)
    .sort((a, b) => a.period - b.period);

  const nowMinutesFloat =
    currentDate.getHours() * 60 +
    currentDate.getMinutes() +
    currentDate.getSeconds() / 60;

  if (sortedBells.length === 0 || dayLessons.length === 0) {
    return {
      state: 'AFTER_SCHOOL',
      activeOrNextLesson: null,
      currentBellSlot: null,
      remainingMinutes: 0,
      remainingSeconds: 0,
      elapsedMinutes: 0,
      totalMinutes: 40,
      progressPercent: 0,
      statusHeadline: 'Bugün İçin Ders Kaydı Yok',
      statusSubline: 'Haftalık programdan ders ekleyebilirsiniz',
    };
  }

  if (isWeekend) {
    const mondayLessons = schedule
      .filter((s) => s.day === 'Pazartesi')
      .sort((a, b) => a.period - b.period);
    const nextLesson = mondayLessons[0] || dayLessons[0];
    return {
      state: 'WEEKEND',
      activeOrNextLesson: nextLesson,
      currentBellSlot:
        sortedBells.find((b) => b.period === nextLesson.period) || sortedBells[0],
      remainingMinutes: 40,
      remainingSeconds: 0,
      elapsedMinutes: 0,
      totalMinutes: 40,
      progressPercent: 0,
      statusHeadline: 'Hafta Sonu · Sıradaki İlk Ders',
      statusSubline: `Pazartesi ${nextLesson.start} itibarıyla başlayacak ders`,
    };
  }

  const firstLesson = dayLessons[0];
  const lastLesson = dayLessons[dayLessons.length - 1];
  const firstStart = parseTimeToMinutes(firstLesson.start);
  const lastEnd = parseTimeToMinutes(lastLesson.end);

  // 1. Before first lesson of the day
  if (nowMinutesFloat < firstStart) {
    const diffTotalSec = Math.max(0, Math.round((firstStart - nowMinutesFloat) * 60));
    const remMin = Math.ceil(diffTotalSec / 60);
    const remSec = diffTotalSec % 60;
    const preWindow = 60;
    const progress = Math.max(
      5,
      Math.min(100, Math.round(((preWindow - remMin) / preWindow) * 100))
    );

    return {
      state: 'BEFORE_SCHOOL',
      activeOrNextLesson: firstLesson,
      currentBellSlot:
        sortedBells.find((b) => b.period === firstLesson.period) || sortedBells[0],
      remainingMinutes: remMin,
      remainingSeconds: remSec,
      elapsedMinutes: 0,
      totalMinutes: parseTimeToMinutes(firstLesson.end) - firstStart,
      progressPercent: progress,
      statusHeadline: 'Günün İlk Dersi Bekleniyor',
      statusSubline: `Dersin başlamasına ${remMin} dakika kaldı`,
    };
  }

  // 2. After last lesson of the day
  if (nowMinutesFloat >= lastEnd) {
    return {
      state: 'AFTER_SCHOOL',
      activeOrNextLesson: firstLesson,
      currentBellSlot:
        sortedBells.find((b) => b.period === firstLesson.period) || sortedBells[0],
      remainingMinutes: 0,
      remainingSeconds: 0,
      elapsedMinutes: 40,
      totalMinutes: 40,
      progressPercent: 100,
      statusHeadline: 'Günlük Dersler Sona Erdi (15:30)',
      statusSubline: `${activeDay} günü tüm dersler tamamlandı`,
    };
  }

  // 3. Inside school hours: check if inside an active lesson slot
  for (let i = 0; i < sortedBells.length; i++) {
    const bell = sortedBells[i];
    const bStart = parseTimeToMinutes(bell.start);
    const bEnd = parseTimeToMinutes(bell.end);

    if (nowMinutesFloat >= bStart && nowMinutesFloat < bEnd) {
      const totalMin = Math.max(1, bEnd - bStart);
      const elapsedFloat = nowMinutesFloat - bStart;
      const remFloat = bEnd - nowMinutesFloat;
      const remTotalSec = Math.max(0, Math.round(remFloat * 60));
      const remMin = Math.ceil(remTotalSec / 60);
      const remSec = remTotalSec % 60;
      const elapsedMin = Math.floor(elapsedFloat);
      const pct = Math.max(
        2,
        Math.min(100, Math.round((elapsedFloat / totalMin) * 100))
      );

      const lessonInPeriod = dayLessons.find((l) => l.period === bell.period);
      if (lessonInPeriod) {
        return {
          state: 'IN_LESSON',
          isLunchBreak: false,
          activeOrNextLesson: lessonInPeriod,
          currentBellSlot: bell,
          remainingMinutes: remMin,
          remainingSeconds: remSec,
          elapsedMinutes: elapsedMin,
          totalMinutes: totalMin,
          progressPercent: pct,
          statusHeadline: 'Şu Anki Ders',
          statusSubline: `Dersin bitmesine ${remMin} dakika kaldı`,
        };
      } else {
        const upcoming =
          dayLessons.find((l) => parseTimeToMinutes(l.start) > nowMinutesFloat) ||
          lastLesson;
        const upStart = parseTimeToMinutes(upcoming.start);
        const waitMin = Math.max(1, Math.ceil(upStart - nowMinutesFloat));

        return {
          state: 'IN_FREE_PERIOD',
          isLunchBreak: false,
          activeOrNextLesson: upcoming,
          currentBellSlot: bell,
          remainingMinutes: waitMin,
          remainingSeconds: remSec,
          elapsedMinutes: elapsedMin,
          totalMinutes: totalMin,
          progressPercent: pct,
          statusHeadline: `${bell.label} · Boş Ders Saati`,
          statusSubline: `Sıradaki dersin (${upcoming.classRoom}) başlamasına ${waitMin} dakika kaldı`,
        };
      }
    }

    // Check if in break between bell[i] and bell[i+1]
    if (i < sortedBells.length - 1) {
      const nextBell = sortedBells[i + 1];
      const nextStart = parseTimeToMinutes(nextBell.start);
      if (nowMinutesFloat >= bEnd && nowMinutesFloat < nextStart) {
        const breakTotal = Math.max(1, nextStart - bEnd);
        const breakElapsed = nowMinutesFloat - bEnd;
        const breakRemFloat = nextStart - nowMinutesFloat;
        const remTotalSec = Math.max(0, Math.round(breakRemFloat * 60));
        const remMin = Math.ceil(remTotalSec / 60);
        const remSec = remTotalSec % 60;
        const pct = Math.max(
          2,
          Math.min(100, Math.round((breakElapsed / breakTotal) * 100))
        );

        const upcoming =
          dayLessons.find((l) => parseTimeToMinutes(l.start) >= nextStart) ||
          lastLesson;
        const isLunch =
          bell.breakLabel === 'Öğle Arası' ||
          bell.breakAfterMinutes >= 30 ||
          breakTotal >= 30;

        return {
          state: 'IN_BREAK',
          isLunchBreak: isLunch,
          breakStart: bell.end,
          breakEnd: nextBell.start,
          activeOrNextLesson: upcoming,
          currentBellSlot: nextBell,
          remainingMinutes: remMin,
          remainingSeconds: remSec,
          elapsedMinutes: Math.floor(breakElapsed),
          totalMinutes: breakTotal,
          progressPercent: pct,
          statusHeadline: isLunch ? 'Öğle Arası' : 'Teneffüs Vakti',
          statusSubline: isLunch
            ? `Öğleden sonra dersin başlamasına ${remMin} dakika kaldı`
            : `Dersin başlamasına ${remMin} dakika kaldı`,
        };
      }
    }
  }

  return {
    state: 'AFTER_SCHOOL',
    activeOrNextLesson: firstLesson,
    currentBellSlot: sortedBells[0],
    remainingMinutes: 0,
    remainingSeconds: 0,
    elapsedMinutes: 40,
    totalMinutes: 40,
    progressPercent: 100,
    statusHeadline: 'Günlük Akış',
    statusSubline: 'Ders seçerek yıllık plan detayını inceleyin',
  };
}

export function findCurriculumForLesson(
  curriculum: CurriculumEntry[],
  courseName: CourseName,
  grade: number,
  weekNumber: number
): CurriculumEntry | null {
  const exact = curriculum.find(
    (c) =>
      c.course_name === courseName &&
      c.grade === grade &&
      c.week === weekNumber
  );
  if (exact) return exact;

  // Fallback by courseName + weekNumber if custom grade
  const byCourseAndWeek = curriculum.find(
    (c) => c.course_name === courseName && c.week === weekNumber
  );
  if (byCourseAndWeek) return byCourseAndWeek;

  // Fallback closest week for course
  const courseItems = curriculum.filter((c) => c.course_name === courseName);
  if (courseItems.length > 0) {
    return courseItems[0];
  }
  return null;
}
