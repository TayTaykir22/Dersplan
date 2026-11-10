import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  FileText,
  Info,
  Layers,
   RotateCcw,
  Sliders,
  Target,
  Trash2,
  Type,
  Users,
} from 'lucide-react';
import {
  AcademicCalendarConfig,
  BellSlot,
  ClassNoteItem,
  ClassRoomGroup,
  CurriculumEntry,
  DayOfWeek,
  LessonCompletionRecord,
  ScheduleEntry,
} from '../types/curriculum';
import {
  AcademicWeekCalculation,
  DAYS_OF_WEEK,
  findCurriculumForLesson,
  formatMinutesToHHMM,
  LiveLessonMatch,
  parseTimeToMinutes,
} from '../utils/timeEngine';

interface DashboardViewProps {
  weekCalc: AcademicWeekCalculation;
  liveMatch: LiveLessonMatch;
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  selectedWeekOverride: number | null;
  onChangeWeekOverride: (week: number | null) => void;
  selectedLessonId: string | null;
  onSelectLessonId: (id: string | null) => void;
  schedule: ScheduleEntry[];
  bellSchedule: BellSlot[];
  curriculum: CurriculumEntry[];
  classes: ClassRoomGroup[];
  academicConfig: AcademicCalendarConfig;
  completedLessons: Record<string, LessonCompletionRecord>;
  onToggleCompleteLesson: (lesson: ScheduleEntry, week: number, reflection?: string) => void;
  onOpenClassDetail: (classRoom: string) => void;
  onUpdateClassGroup: (updated: ClassRoomGroup) => void;
  onOpenSettings?: () => void;
  isSimulatingTime: boolean;
  simulatedMinutes: number;
  onToggleSimulatingTime: (enabled: boolean, targetMinutes?: number) => void;
  realClockText: string;
}

type ReadabilityScale = 'normal' | 'large' | 'xlarge';
const READABILITY_STORAGE_KEY = 'dersplan_readability_scale_v1';

export const DashboardView: React.FC<DashboardViewProps> = ({
  weekCalc,
  liveMatch,
  selectedDay,
  onSelectDay,
  selectedWeekOverride,
  onChangeWeekOverride,
  selectedLessonId,
  onSelectLessonId,
  schedule,
  bellSchedule,
  curriculum,
  classes,
  academicConfig,
  completedLessons,
  onToggleCompleteLesson,
  onOpenClassDetail,
  onUpdateClassGroup,
  onOpenSettings,
  isSimulatingTime,
  simulatedMinutes,
  onToggleSimulatingTime,
  realClockText,
}) => {
  const [showTimeTestDrawer, setShowTimeTestDrawer] = useState<boolean>(false);
  const [newClassNoteText, setNewClassNoteText] = useState<string>('');
  const [fallbackClassRoom, setFallbackClassRoom] = useState<string>('7/A');

  // Yakını göremeyen öğretmenler için varsayılan olarak BÜYÜK ('large') punto seçili gelir
  const [textScale, setTextScale] = useState<ReadabilityScale>(() => {
    try {
      const saved = localStorage.getItem(READABILITY_STORAGE_KEY);
      if (saved === 'normal' || saved === 'large' || saved === 'xlarge') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'large';
  });

  const handleSelectTextScale = (scale: ReadabilityScale) => {
    setTextScale(scale);
    try {
      localStorage.setItem(READABILITY_STORAGE_KEY, scale);
    } catch {
      // ignore
    }
  };

  const effectiveWeek = selectedWeekOverride ?? weekCalc.weekNumber;

  const dayLessons = schedule
    .filter((s) => s.day === selectedDay)
    .sort((a, b) => a.period - b.period);

  const manuallySelectedLesson = selectedLessonId
    ? schedule.find((s) => s.id === selectedLessonId) || null
    : null;

  const displayedLesson: ScheduleEntry | null =
    manuallySelectedLesson ||
    (selectedDay === weekCalc.dayOfWeek
      ? liveMatch.activeOrNextLesson
      : dayLessons[0] || null) ||
    dayLessons[0] ||
    schedule[0] ||
    null;

  const isViewingManualLesson =
    Boolean(manuallySelectedLesson) &&
    manuallySelectedLesson?.id !== liveMatch.activeOrNextLesson?.id;

  const activeClassGroup = displayedLesson
    ? classes.find((c) => c.classRoom === displayedLesson.classRoom) || null
    : classes.find((c) => c.classRoom === fallbackClassRoom) || classes[0] || null;

  const activeCurriculum = displayedLesson
    ? findCurriculumForLesson(
        curriculum,
        displayedLesson.courseName,
        displayedLesson.grade,
        effectiveWeek
      )
    : activeClassGroup
    ? findCurriculumForLesson(
        curriculum,
        activeClassGroup.courseName,
        activeClassGroup.grade,
        effectiveWeek
      )
    : null;

  const lessonCompletionKey = displayedLesson
    ? `${effectiveWeek}_${displayedLesson.day}_${displayedLesson.period}_${displayedLesson.classRoom}`
    : '';
  const isDisplayedLessonCompleted = Boolean(
    lessonCompletionKey && completedLessons[lessonCompletionKey]
  );

  const displayedTimeClock = isSimulatingTime
    ? formatMinutesToHHMM(simulatedMinutes)
    : realClockText;

  const isBreakActive =
    !isViewingManualLesson && liveMatch.state === 'IN_BREAK';
  const isLunchActive =
    isBreakActive && Boolean(liveMatch.isLunchBreak);

  const handleAddClassNote = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassNoteText.trim();
    if (!trimmed || !activeClassGroup) return;

    const newNote: ClassNoteItem = {
      id: `note-${Date.now()}`,
      week: effectiveWeek,
      createdAt: new Date().toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      text: trimmed,
      isImportant: false,
      completed: false,
    };

    onUpdateClassGroup({
      ...activeClassGroup,
      notes: [newNote, ...activeClassGroup.notes],
    });
    setNewClassNoteText('');
  };

  const handleToggleClassNote = (noteId: string) => {
    if (!activeClassGroup) return;
    onUpdateClassGroup({
      ...activeClassGroup,
      notes: activeClassGroup.notes.map((n) =>
        n.id === noteId ? { ...n, completed: !n.completed } : n
      ),
    });
  };

  const handleDeleteClassNote = (noteId: string) => {
    if (!activeClassGroup) return;
    onUpdateClassGroup({
      ...activeClassGroup,
      notes: activeClassGroup.notes.filter((n) => n.id !== noteId),
    });
  };

  // Okunabilirlik (Yakını Göremeyenler İçin) Dinamik Sınıflar
  const outcomeFontClass =
    textScale === 'xlarge'
      ? 'text-2xl sm:text-3xl font-extrabold leading-relaxed tracking-normal'
      : textScale === 'large'
      ? 'text-xl sm:text-2xl font-bold leading-relaxed tracking-normal'
      : 'text-lg sm:text-xl font-semibold leading-relaxed';

  const topicFontClass =
    textScale === 'xlarge'
      ? 'text-xl sm:text-2xl font-bold leading-snug'
      : textScale === 'large'
      ? 'text-lg sm:text-xl font-bold leading-snug'
      : 'text-base sm:text-lg font-bold leading-snug';

  const explanationFontClass =
    textScale === 'xlarge'
      ? 'text-lg sm:text-xl font-medium leading-relaxed'
      : textScale === 'large'
      ? 'text-base sm:text-lg font-medium leading-relaxed'
      : 'text-sm sm:text-base font-medium leading-relaxed';

  return (
    <div className="space-y-4">
      {/* EN ÜSTTEKİ ANA BÖLÜM: 1) ÖĞRENME ÇIKTISI / KAZANIM -> 2) GÜNÜN İLK DERSİ BEKLENİYOR / CANLI DERS -> 3) ŞUBE GENEL NOTLARI */}
      <section className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
        {/* Üst Bilgi Satırı: Hafta Seçici, Saat ve Okuma Punto Ayarı */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onChangeWeekOverride(Math.max(1, effectiveWeek - 1))
              }
              disabled={effectiveWeek <= 1}
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:opacity-40"
              title="Önceki Hafta"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-1.5">
              <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">
                {effectiveWeek}. Hafta · {activeCurriculum?.date_range || weekCalc.dateRangeText}
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>{weekCalc.formattedFullDate}</span>
                {selectedWeekOverride !== null &&
                  selectedWeekOverride !== weekCalc.weekNumber && (
                    <button
                      type="button"
                      onClick={() => onChangeWeekOverride(null)}
                      className="text-indigo-600 dark:text-indigo-400 font-bold underline"
                    >
                      Bu Haftaya Dön ({weekCalc.weekNumber}. Hft)
                    </button>
                  )}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onChangeWeekOverride(
                  Math.min(academicConfig.totalWeeks, effectiveWeek + 1)
                )
              }
              disabled={effectiveWeek >= academicConfig.totalWeeks}
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:opacity-40"
              title="Sonraki Hafta"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Yakını Göremeyenler İçin Hızlı Yazı Boyutu (Punto) Seçici */}
            <div
              className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl"
              role="group"
              aria-label="Yazı Boyutu"
            >
              <Type className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1 hidden sm:inline" />
              {(
                [
                  { id: 'normal', label: 'A' },
                  { id: 'large', label: 'A+' },
                  { id: 'xlarge', label: 'A++' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectTextScale(opt.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors ${
                    textScale === opt.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                  title="Okuma Yazı Boyutu"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowTimeTestDrawer(!showTimeTestDrawer)}
              className="min-h-[42px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-mono font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 tabular-nums shrink-0"
              title="Saati ve Zil Testini Aç"
            >
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{displayedTimeClock}</span>
              <Sliders className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>
          </div>
        </div>

        {/* İsteğe Bağlı Açılır Saat Test Çubuğu */}
        {showTimeTestDrawer && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Zil ve Teneffüs Test Modu
              </span>
              <button
                type="button"
                onClick={() => onToggleSimulatingTime(!isSimulatingTime)}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 underline"
              >
                {isSimulatingTime ? 'Gerçek Cihaz Saatine Dön' : 'Test Saatini Aç'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[
                { label: 'Ders Öncesi (08:25)', min: 8 * 60 + 25 },
                { label: '1. Ders (08:50)', min: 8 * 60 + 50 },
                { label: 'Teneffüs (09:25)', min: 9 * 60 + 25 },
                { label: '3. Ders (10:45)', min: 10 * 60 + 45 },
                { label: 'Öğle Arası (12:20)', min: 12 * 60 + 20 },
                { label: '5. Ders (13:15)', min: 13 * 60 + 15 },
              ].map((preset) => {
                const active =
                  isSimulatingTime && Math.abs(simulatedMinutes - preset.min) <= 3;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      onSelectLessonId(null);
                      onToggleSimulatingTime(true, preset.min);
                    }}
                    className={`min-h-[40px] px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors tabular-nums ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 1. KUTU (EN ÜSTTE): ÖĞRENME ÇIKTISI / KAZANIM KUTUSU */}
        {activeCurriculum && (
          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800/90 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-extrabold text-indigo-800 dark:text-indigo-300">
              <span className="flex items-center gap-2">
                <Target className="w-5 h-5 shrink-0" />
                ÖĞRENME ÇIKTISI / KAZANIM
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/70 font-mono tabular-nums">
                {activeCurriculum.outcome_code}
              </span>
            </div>

            {!displayedLesson && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {classes.map((cls) => {
                  const isCurrent = activeClassGroup?.classRoom === cls.classRoom;
                  return (
                    <button
                      key={cls.classRoom}
                      type="button"
                      onClick={() => setFallbackClassRoom(cls.classRoom)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-colors ${
                        isCurrent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-indigo-200 dark:border-indigo-800'
                      }`}
                    >
                      {cls.classRoom}
                    </button>
                  );
                })}
              </div>
            )}

            <p className={`${outcomeFontClass} text-slate-950 dark:text-white`}>
              {activeCurriculum.learning_outcome}
            </p>

            {/* Konu, Ünite ve Yıllık Plan Açıklaması aynı kutu içinde düzenli alt bilgi olarak yer alır */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-indigo-200/80 dark:border-indigo-800/70">
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/60 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>KONU / İÇERİK ÇERÇEVESİ</span>
                </div>
                <p className={`${topicFontClass} text-slate-950 dark:text-white`}>
                  {activeCurriculum.content_framework}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/60 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>ÜNİTE / ÖĞRENME ALANI</span>
                </div>
                <p className={`${topicFontClass} text-slate-900 dark:text-slate-100`}>
                  {activeCurriculum.unit}
                </p>
              </div>
            </div>

            {(activeCurriculum.explanation || activeCurriculum.special_days) && (
              <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-indigo-100 dark:border-indigo-900/50 space-y-1.5">
                {activeCurriculum.explanation && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-300">
                      <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>YILLIK PLAN AÇIKLAMASI / SÜREÇ BİLEŞENLERİ</span>
                    </div>
                    <p
                      className={`${explanationFontClass} text-slate-900 dark:text-slate-100`}
                    >
                      {activeCurriculum.explanation}
                    </p>
                  </div>
                )}

                {activeCurriculum.special_days && (
                  <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2 text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300">
                    <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Belirli Gün ve Haftalar: {activeCurriculum.special_days}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. KUTU (ÖĞRENME ÇIKTISI / KAZANIM KUTUSUNUN HEMEN ALTINDA): GÜNÜN İLK DERSİ BEKLENİYOR / ŞU ANKİ AKTİF DERS (CANLI) KUTUSU */}
        {isBreakActive ? (
          <div
            className={`p-4 sm:p-5 rounded-2xl border-2 space-y-4 ${
              isLunchActive
                ? 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-300 dark:border-amber-700'
                : 'bg-indigo-50/80 dark:bg-indigo-950/35 border-indigo-300 dark:border-indigo-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm sm:text-base font-extrabold flex items-center gap-2 ${
                  isLunchActive
                    ? 'text-amber-900 dark:text-amber-300'
                    : 'text-indigo-900 dark:text-indigo-300'
                }`}
              >
                <Coffee className="w-5 h-5 shrink-0" />
                {isLunchActive
                  ? 'ÖĞLE ARASI VAKTİ (55 Dakika)'
                  : 'TENEFFÜS VAKTİ (15 Dakika)'}
              </span>
              <span className="text-sm sm:text-base font-mono font-extrabold tabular-nums text-slate-800 dark:text-slate-200">
                {liveMatch.breakStart} - {liveMatch.breakEnd}
              </span>
            </div>

            {/* 4 Ana Bilgi Bloğu: Benzer Büyüklükte ve Çok Belirgin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {isLunchActive
                    ? 'ÖĞLEDEN SONRA DERSE KALAN SÜRE'
                    : 'DERSİN BAŞLAMASINA KALAN SÜRE'}
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                  {liveMatch.remainingMinutes} Dakika Kaldı
                </div>
              </div>

              {displayedLesson && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    SIRADAKİ DERS VE SINIF
                  </div>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                    {displayedLesson.period}. Ders · {displayedLesson.classRoom}
                  </div>
                </div>
              )}

              {displayedLesson && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    SIRADAKİ DERSİN ADI
                  </div>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                    {displayedLesson.courseName}
                  </div>
                </div>
              )}

              {displayedLesson && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    SIRADAKİ DERS SAATİ
                  </div>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {displayedLesson.start} - {displayedLesson.end}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full h-3.5 bg-white dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
              <div
                className={`h-full rounded-full transition-transform duration-200 origin-left ${
                  isLunchActive ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.max(8, liveMatch.progressPercent)}%` }}
              />
            </div>
          </div>
        ) : displayedLesson ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-indigo-500/80 dark:border-indigo-500/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold tracking-wide text-indigo-700 dark:text-indigo-300">
                {isViewingManualLesson
                  ? 'GÜNÜN İLK DERSİ BEKLENİYOR · SEÇİLİ DERS ÖNİZLEMESİ'
                  : liveMatch.state === 'BEFORE_SCHOOL'
                  ? 'GÜNÜN İLK DERSİ BEKLENİYOR'
                  : liveMatch.state === 'IN_LESSON'
                  ? 'ŞU ANKİ AKTİF DERS (CANLI) · GÜNÜN DERS DURUMU'
                  : liveMatch.statusHeadline.toLocaleUpperCase('tr-TR')}
              </span>

              {isViewingManualLesson && (
                <button
                  type="button"
                  onClick={() => onSelectLessonId(null)}
                  className="min-h-[36px] px-3 py-1 rounded-lg bg-indigo-600 text-white inline-flex items-center gap-1.5 text-xs font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Şu Anki Canlı Derse Dön
                </button>
              )}
            </div>

            {/* 4 EŞİT BÜYÜKLÜKTE VE YÜKSEK KONTRASTLI DERS BİLGİ KUTUSU */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {/* 1. Sınıfı ve Kaçıncı Ders */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  SINIF VE DERS SAATİ
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white tabular-nums">
                  {displayedLesson.classRoom} · {displayedLesson.period}. Ders
                </div>
              </div>

              {/* 2. Başlangıç ve Bitiş Saati */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  BAŞLANGIÇ - BİTİŞ
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold font-mono text-slate-950 dark:text-white tabular-nums">
                  {displayedLesson.start} - {displayedLesson.end}
                </div>
              </div>

              {/* 3. İçinde Bulunduğumuz Dersin Adı */}
              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  DERSİN ADI
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white leading-snug">
                  {displayedLesson.courseName}
                </div>
              </div>

              {/* 4. Dersin Bitimine / Başlamasına Kalan Süre */}
              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-indigo-600 text-white">
                <div className="text-xs font-bold text-indigo-100">
                  {liveMatch.state === 'IN_LESSON' && !isViewingManualLesson
                    ? 'DERSİN BİTİMİNE KALAN SÜRE'
                    : liveMatch.state === 'BEFORE_SCHOOL' && !isViewingManualLesson
                    ? 'İLK DERSİN BAŞLAMASINA KALAN SÜRE'
                    : 'DERS SÜRESİ BİLGİSİ'}
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold font-mono tabular-nums">
                  {liveMatch.state === 'IN_LESSON' && !isViewingManualLesson
                    ? `Bitimine ${liveMatch.remainingMinutes} dk kaldı`
                    : liveMatch.state === 'BEFORE_SCHOOL' && !isViewingManualLesson
                    ? `Başlamasına ${liveMatch.remainingMinutes} dk kaldı`
                    : `40 Dakika (${displayedLesson.start}-${displayedLesson.end})`}
                </div>
              </div>
            </div>

            {/* Kalın ve Belirgin İlerleme Çubuğu + İşlendi Butonu */}
            <div className="space-y-2.5 pt-0.5">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                <span className="text-slate-700 dark:text-slate-300 tabular-nums">
                  {liveMatch.state === 'IN_LESSON' && !isViewingManualLesson
                    ? `Geçen Süre: ${liveMatch.elapsedMinutes} dk`
                    : `Başlangıç: ${displayedLesson.start}`}
                </span>
                <span className="font-mono text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {liveMatch.state === 'IN_LESSON' && !isViewingManualLesson
                    ? `Kalan: ${liveMatch.remainingMinutes} dk / 40 dk`
                    : `Bitiş: ${displayedLesson.end}`}
                </span>
              </div>
              <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-transform duration-200 origin-left"
                  style={{
                    width: `${
                      isViewingManualLesson
                        ? 100
                        : Math.max(8, liveMatch.progressPercent)
                    }%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onToggleCompleteLesson(displayedLesson, effectiveWeek)
                  }
                  className={`min-h-[46px] px-3 py-2 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    isDisplayedLessonCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 dark:bg-indigo-600 text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {isDisplayedLessonCompleted
                      ? 'İşlendi (Geri Al)'
                      : 'İşlendi İşaretle'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenClassDetail(displayedLesson.classRoom)}
                  className="min-h-[46px] px-3 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {displayedLesson.classRoom} Sınıfı ({activeClassGroup?.students.length || 0})
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-indigo-500/80 dark:border-indigo-500/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold tracking-wide text-indigo-700 dark:text-indigo-300">
                GÜNÜN İLK DERSİ BEKLENİYOR
              </span>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                {bellSchedule[0]?.start || '08:40'} - {bellSchedule[bellSchedule.length - 1]?.end || '15:30'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  SEÇİLİ ŞUBE ÖNİZLEMESİ
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white tabular-nums">
                  {activeClassGroup?.classRoom || '7/A'} Şubesi
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  GÜNLÜK ZİL SAATLERİ
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold font-mono text-slate-950 dark:text-white tabular-nums">
                  {bellSchedule[0]?.start || '08:40'} - {bellSchedule[bellSchedule.length - 1]?.end || '15:30'}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  DERSİN ADI
                </div>
                <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white leading-snug">
                  {activeClassGroup?.courseName || 'Sosyal Bilgiler'}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-indigo-600 text-white">
                <div className="text-xs font-bold text-indigo-100">
                  HAFTALIK DERS PROGRAMI DURUMU
                </div>
                <div className="mt-1 text-base sm:text-lg font-extrabold leading-snug">
                  Ders programında henüz ekli ders yok
                </div>
              </div>
            </div>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-full min-h-[46px] px-4 py-2.5 text-xs sm:text-sm font-extrabold bg-slate-900 dark:bg-indigo-600 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors"
              >
                Program ve Zil Bölümünden Haftalık Ders Ekle →
              </button>
            )}
          </div>
        )}

        {/* 3. KUTU (GÜNÜN İLK DERSİ BEKLENİYOR / CANLI DERS KUTUSUNUN HEMEN ALTINDA): ŞUBE GENEL ÖDEV KONTROLÜ, SINAV HATIRLATMALARI VE EKSİK KONULAR */}
        {activeClassGroup && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border-2 border-amber-200 dark:border-amber-800/80 space-y-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>{activeClassGroup.classRoom} Şube Genel Notları</span>
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-amber-900/90 dark:text-amber-300">
                  Şube genel ödev kontrolü, sınav hatırlatmaları ve eksik konular
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenClassDetail(activeClassGroup.classRoom)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-950 dark:text-amber-200 text-xs font-extrabold whitespace-nowrap shrink-0"
              >
                Sınıf Listesi ve Notlar →
              </button>
            </div>

            {/* Hızlı Şube Notu Ekleme Formu */}
            <form onSubmit={handleAddClassNote} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newClassNoteText}
                onChange={(e) => setNewClassNoteText(e.target.value)}
                placeholder={`${activeClassGroup.classRoom} için ödev kontrolü, sınav hatırlatması veya eksik konu yazın...`}
                className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/80 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-extrabold bg-slate-900 dark:bg-indigo-600 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0"
              >
                Notu Kaydet
              </button>
            </form>

            {/* Kayıtlı Şube Notları Listesi */}
            {activeClassGroup.notes.length > 0 ? (
              <div className="divide-y divide-amber-200/70 dark:divide-amber-800/50 bg-white/90 dark:bg-slate-900/80 rounded-xl border border-amber-200/80 dark:border-amber-800/60 px-3.5">
                {activeClassGroup.notes.map((note) => (
                  <div
                    key={note.id}
                    className="py-3 flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleClassNote(note.id)}
                      className="flex items-start gap-2.5 text-left group flex-1"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          note.completed
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600'
                        }`}
                      />
                      <div className="space-y-0.5">
                        <p
                          className={`text-sm sm:text-base leading-snug ${
                            note.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100 font-semibold'
                          }`}
                        >
                          {note.text}
                        </p>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {note.week}. Hafta · {note.createdAt}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClassNote(note.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
                      title="Notu Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 italic">
                Bu şube için henüz genel ödev kontrolü, sınav hatırlatması veya eksik konu notu eklenmemiş.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ALT KISIM: GÜNLÜK DERS AKIŞI (08:40 - 15:30 · 7 DERS) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Günlük Ders Akışı (08:40 - 15:30)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Herhangi bir derse dokunarak o dersin yıllık planını yukarıda inceleyin
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 tabular-nums">
            7 Ders
          </span>
        </div>

        {/* Gün Seçici Sekmeler */}
        <div className="grid grid-cols-5 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = day === selectedDay;
            const isToday = day === weekCalc.dayOfWeek;
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  onSelectDay(day);
                  onSelectLessonId(null);
                }}
                className={`min-h-[44px] px-1.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-colors truncate ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {day.slice(0, 3)}
                {isToday ? '•' : ''}
              </button>
            );
          })}
        </div>

        {/* 1. Dersten 7. Derse Kadar Sıralı Liste ve Ara Süreleri */}
        <div className="space-y-2">
          {bellSchedule.map((bell, idx) => {
            const lesson = dayLessons.find((l) => l.period === bell.period);
            const isLiveLesson =
              selectedDay === weekCalc.dayOfWeek &&
              liveMatch.state === 'IN_LESSON' &&
              liveMatch.activeOrNextLesson?.id === lesson?.id;
            const isSelectedCard =
              displayedLesson?.id === lesson?.id && Boolean(lesson);
            const completionKey = lesson
              ? `${effectiveWeek}_${lesson.day}_${lesson.period}_${lesson.classRoom}`
              : '';
            const isDone = Boolean(
              completionKey && completedLessons[completionKey]
            );
            const isLunchAfter =
              bell.breakLabel === 'Öğle Arası' || bell.breakAfterMinutes >= 30;
            const isLastBell = idx === bellSchedule.length - 1;

            return (
              <React.Fragment key={bell.period}>
                {lesson ? (
                  <button
                    type="button"
                    onClick={() => onSelectLessonId(lesson.id)}
                    className={`w-full min-h-[64px] text-left p-3.5 rounded-xl border-2 transition-colors flex items-center justify-between gap-3 ${
                      isSelectedCard
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-mono tabular-nums">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">
                          {bell.period}. Ders
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {bell.start} - {bell.end}
                        </span>
                        {isLiveLesson && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans font-extrabold text-indigo-600 dark:text-indigo-400">
                              Şu Anki Ders
                            </span>
                          </>
                        )}
                        {isDone && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans font-bold text-emerald-600 dark:text-emerald-400">
                              İşlendi
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-base sm:text-lg font-extrabold text-slate-950 dark:text-white">
                          {lesson.classRoom}
                        </span>
                        <span className="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-200 truncate">
                          {lesson.courseName}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ChevronRight
                          className={`w-5 h-5 ${
                            isSelectedCard
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-400'
                          }`}
                        />
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="px-3.5 py-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs sm:text-sm text-slate-400">
                    <span className="font-mono font-semibold tabular-nums">
                      {bell.period}. Ders · {bell.start} - {bell.end}
                    </span>
                    <span>Boş Ders</span>
                  </div>
                )}

                {/* Ders Arası / Öğle Arası / Ders Bitiş Bilgisi */}
                {bell.breakAfterMinutes > 0 && !isLastBell && (
                  <div
                    className={`px-3 py-1.5 rounded-lg flex items-center justify-between text-xs font-mono tabular-nums ${
                      isLunchAfter
                        ? 'bg-amber-50/90 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-sans">
                      {isLunchAfter ? 'Öğle Arası' : 'Teneffüs Arası'}
                    </span>
                    <span>
                      {bell.end} -{' '}
                      {formatMinutesToHHMM(
                        parseTimeToMinutes(bell.end) + bell.breakAfterMinutes
                      )}{' '}
                      ({bell.breakAfterMinutes} dakika ara)
                    </span>
                  </div>
                )}

                {isLastBell && (
                  <div className="px-3 py-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 text-center text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                    {bell.end} itibarıyla günlük dersler sona erer
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </section>
    </div>
  );
};

