import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  AcademicCalendarConfig,
  AppDataStore,
  BellSlot,
  CourseName,
  DayOfWeek,
  ScheduleEntry,
} from '../types/curriculum';
import {
  DAYS_OF_WEEK,
  formatMinutesToHHMM,
  parseTimeToMinutes,
} from '../utils/timeEngine';

interface SettingsAndDataViewProps {
  dataStore: AppDataStore;
  onUpdateAcademicConfig: (cfg: AcademicCalendarConfig) => void;
  onUpdateBellSchedule: (bells: BellSlot[]) => void;
  onUpdateSchedule: (schedule: ScheduleEntry[]) => void;
  onResetToDefaults: () => void;
}

const COURSES: CourseName[] = [
  'Sosyal Bilgiler',
  'T.C. İnkılap Tarihi ve Atatürkçülük',
  'Ahlak ve Vatandaşlık Eğitimi',
  'Seçmeli Görgü Kuralları ve Nezaket',
];

export const SettingsAndDataView: React.FC<SettingsAndDataViewProps> = ({
  dataStore,
  onUpdateAcademicConfig,
  onUpdateBellSchedule,
  onUpdateSchedule,
  onResetToDefaults,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'schedule' | 'bells' | 'calendar'
  >('schedule');

  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);

  // Available classes automatically listed from existing classes in system
  const availableClasses = dataStore.classes.map((c) => ({
    classRoom: c.classRoom,
    grade: c.grade,
    defaultCourse: c.courseName,
  }));

  // New Schedule Entry Form (Sınıf Düzeyi sekmesi kaldırıldı; seçilen şubeden otomatik alınır)
  const [newDay, setNewDay] = useState<DayOfWeek>('Pazartesi');
  const [newPeriod, setNewPeriod] = useState<number>(1);
  const [newClassRoom, setNewClassRoom] = useState<string>(
    availableClasses[0]?.classRoom || '5/A'
  );
  const [newCourse, setNewCourse] = useState<CourseName>('Sosyal Bilgiler');

  // Academic Config Form
  const [schoolName, setSchoolName] = useState(
    dataStore.academicConfig.schoolName
  );
  const [startDate, setStartDate] = useState(
    dataStore.academicConfig.startDate
  );
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleClassSelectionChange = (selectedRoom: string) => {
    setNewClassRoom(selectedRoom);
    const matched = availableClasses.find((c) => c.classRoom === selectedRoom);
    if (matched && matched.grade === 8) {
      setNewCourse('T.C. İnkılap Tarihi ve Atatürkçülük');
    } else if (
      matched &&
      newCourse === 'T.C. İnkılap Tarihi ve Atatürkçülük'
    ) {
      setNewCourse('Sosyal Bilgiler');
    }
  };

  const handleAddOrReplaceScheduleSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const bell =
      dataStore.bellSchedule.find((b) => b.period === newPeriod) ||
      dataStore.bellSchedule[0];

    const matchedClass = availableClasses.find(
      (c) => c.classRoom === newClassRoom
    );
    const derivedGrade =
      matchedClass?.grade || parseInt(newClassRoom, 10) || 6;

    const filtered = dataStore.schedule.filter(
      (s) => !(s.day === newDay && s.period === newPeriod)
    );

    const newItem: ScheduleEntry = {
      id: `custom-${Date.now()}`,
      day: newDay,
      period: newPeriod,
      start: bell.start,
      end: bell.end,
      classRoom: newClassRoom,
      grade: derivedGrade,
      courseName: newCourse,
    };

    onUpdateSchedule([...filtered, newItem]);
    setSavedNotice(
      `${newDay} ${newPeriod}. Ders (${newClassRoom} - ${newCourse}) kaydedildi.`
    );
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleDeleteScheduleSlot = (id: string) => {
    onUpdateSchedule(dataStore.schedule.filter((s) => s.id !== id));
  };

  // Sync schedule start/end times whenever bellSchedule changes
  const syncScheduleWithBells = (updatedBells: BellSlot[]) => {
    onUpdateBellSchedule(updatedBells);
    const updatedSchedule = dataStore.schedule.map((s) => {
      const matchingBell = updatedBells.find((b) => b.period === s.period);
      if (matchingBell) {
        return { ...s, start: matchingBell.start, end: matchingBell.end };
      }
      return s;
    });
    onUpdateSchedule(updatedSchedule);
  };

  const handleBellTimeChange = (
    period: number,
    field: 'start' | 'end',
    val: string
  ) => {
    const sorted = [...dataStore.bellSchedule].sort(
      (a, b) => a.period - b.period
    );
    const targetIdx = sorted.findIndex((b) => b.period === period);
    if (targetIdx === -1) return;

    const lessonDuration = Math.max(
      10,
      parseTimeToMinutes(sorted[targetIdx].end) -
        parseTimeToMinutes(sorted[targetIdx].start) || 40
    );

    if (field === 'start') {
      sorted[targetIdx] = {
        ...sorted[targetIdx],
        start: val,
        end: formatMinutesToHHMM(parseTimeToMinutes(val) + lessonDuration),
      };
    } else {
      sorted[targetIdx] = {
        ...sorted[targetIdx],
        end: val,
      };
    }

    // Cascade subsequent periods using each period's breakAfterMinutes
    for (let i = targetIdx; i < sorted.length - 1; i++) {
      const prevEnd = parseTimeToMinutes(sorted[i].end);
      const breakMins = Math.max(0, sorted[i].breakAfterMinutes);
      const nextDuration = Math.max(
        10,
        parseTimeToMinutes(sorted[i + 1].end) -
          parseTimeToMinutes(sorted[i + 1].start) || 40
      );
      const nextStartMins = prevEnd + breakMins;
      const nextEndMins = nextStartMins + nextDuration;
      sorted[i + 1] = {
        ...sorted[i + 1],
        start: formatMinutesToHHMM(nextStartMins),
        end: formatMinutesToHHMM(nextEndMins),
      };
    }

    syncScheduleWithBells(sorted);
  };

  const handleBreakDurationChange = (period: number, newBreakMinutes: number) => {
    const clampedBreak = Math.max(0, Math.min(180, newBreakMinutes || 0));
    const sorted = [...dataStore.bellSchedule].sort(
      (a, b) => a.period - b.period
    );
    const targetIdx = sorted.findIndex((b) => b.period === period);
    if (targetIdx === -1) return;

    sorted[targetIdx] = {
      ...sorted[targetIdx],
      breakAfterMinutes: clampedBreak,
      breakLabel: clampedBreak >= 30 ? 'Öğle Arası' : 'Teneffüs',
    };

    // Recalculate subsequent periods automatically when break duration changes
    for (let i = targetIdx; i < sorted.length - 1; i++) {
      const prevEnd = parseTimeToMinutes(sorted[i].end);
      const breakMins = Math.max(0, sorted[i].breakAfterMinutes);
      const nextDuration = Math.max(
        10,
        parseTimeToMinutes(sorted[i + 1].end) -
          parseTimeToMinutes(sorted[i + 1].start) || 40
      );
      const nextStartMins = prevEnd + breakMins;
      const nextEndMins = nextStartMins + nextDuration;
      sorted[i + 1] = {
        ...sorted[i + 1],
        start: formatMinutesToHHMM(nextStartMins),
        end: formatMinutesToHHMM(nextEndMins),
      };
    }

    syncScheduleWithBells(sorted);
  };

  const handleSaveCalendarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAcademicConfig({
      ...dataStore.academicConfig,
      schoolName: schoolName.trim() || 'Edirne Merkez İstiklal Ortaokulu',
      startDate,
    });
    setSavedNotice('Okul ve eğitim yılı başlangıç tarihi kaydedildi.');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Top Sub-Navigation (3 Sekme: Ders Programı, Zil ve Ara Süreleri, Eğitim Takvimi) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Program ve Zil Ayarları
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Haftalık ders programı, günlük zil/teneffüs süreleri ve eğitim takvimi ayarları
          </p>
        </div>

        {savedNotice && (
          <div className="p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            {savedNotice}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {[
            { id: 'schedule', label: 'Ders Programı', icon: Calendar },
            { id: 'bells', label: 'Zil ve Ara Süreleri', icon: Clock },
            { id: 'calendar', label: 'Eğitim Takvimi', icon: Save },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveSubTab(
                    tab.id as 'schedule' | 'bells' | 'calendar'
                  )
                }
                className={`min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
                  active
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: WEEKLY SCHEDULE EDITOR (Mevcut Sınıflardan Otomatik Liste, Sınıf Düzeyi Sekmesi Kaldırıldı) */}
      {activeSubTab === 'schedule' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Haftalık Ders Programı Düzenleyici
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sınıf şubesi mevcut e-Okul şubelerinden otomatik listelenir
            </p>
          </div>

          <form
            onSubmit={handleAddOrReplaceScheduleSlot}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800"
          >
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Gün
              </label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(e.target.value as DayOfWeek)}
                className="w-full min-h-[42px] px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Kaçıncı Ders
              </label>
              <select
                value={newPeriod}
                onChange={(e) => setNewPeriod(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 tabular-nums"
              >
                {dataStore.bellSchedule.map((b) => (
                  <option key={b.period} value={b.period}>
                    {b.period}. Ders ({b.start}-{b.end})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Sınıf Şubesi (Mevcut Sınıflar)
              </label>
              <select
                value={newClassRoom}
                onChange={(e) => handleClassSelectionChange(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {availableClasses.map((cls) => (
                  <option key={cls.classRoom} value={cls.classRoom}>
                    {cls.classRoom} Şubesi
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Ders Adı
              </label>
              <select
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value as CourseName)}
                className="w-full min-h-[42px] px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
              >
                {COURSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full min-h-[42px] px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Ekle / Güncelle
              </button>
            </div>
          </form>

          {/* Existing Schedule List */}
          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day) => {
              const items = dataStore.schedule
                .filter((s) => s.day === day)
                .sort((a, b) => a.period - b.period);
              return (
                <div
                  key={day}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {day}
                    </h3>
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      {items.length} Ders
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {item.period}. Ders · {item.start} - {item.end}
                          </div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {item.classRoom} · {item.courseName}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduleSlot(item.id)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Dersi Kaldır"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 2: BELL SCHEDULE & BREAK DURATION EDITOR */}
      {activeSubTab === 'bells' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Günlük Ders Giriş-Çıkış Saatleri ve Ara Süreleri
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ders saatlerini veya teneffüs/öğle arası dakikalarını değiştirdiğinizde sonraki dersler otomatik güncellenir
            </p>
          </div>

          <div className="space-y-3">
            {dataStore.bellSchedule.map((bell, idx) => {
              const isLast = idx === dataStore.bellSchedule.length - 1;
              return (
                <div
                  key={bell.period}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {bell.period}. Ders ({bell.start} - {bell.end})
                    </span>
                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold tabular-nums">
                      {isLast
                        ? '15:30 Dersler Biter'
                        : bell.breakAfterMinutes >= 30
                        ? `${bell.breakAfterMinutes} dk Öğle Arası`
                        : `${bell.breakAfterMinutes} dk Teneffüs`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Başlangıç
                      </label>
                      <input
                        type="time"
                        value={bell.start}
                        onChange={(e) =>
                          handleBellTimeChange(
                            bell.period,
                            'start',
                            e.target.value
                          )
                        }
                        className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Bitiş
                      </label>
                      <input
                        type="time"
                        value={bell.end}
                        onChange={(e) =>
                          handleBellTimeChange(
                            bell.period,
                            'end',
                            e.target.value
                          )
                        }
                        className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Ara Süresi (Dk)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        disabled={isLast}
                        value={isLast ? 0 : bell.breakAfterMinutes}
                        onChange={(e) =>
                          handleBreakDurationChange(
                            bell.period,
                            parseInt(e.target.value, 10)
                          )
                        }
                        className="w-full min-h-[40px] px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 disabled:opacity-40 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: ACADEMIC CALENDAR & HOLIDAYS */}
      {activeSubTab === 'calendar' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-5">
          <form onSubmit={handleSaveCalendarConfig} className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Eğitim-Öğretim Yılı Başlangıç Tarihi ve Tatil Takvimi
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Okul Adı
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  1. Hafta Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full min-h-[42px] px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"
                >
                  Ayarları Kaydet
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Resmî Tatil ve Ara Tatil Takvimi
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {dataStore.academicConfig.holidays.map((h) => (
                <div
                  key={h.id}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {h.name}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {h.startDate} — {h.endDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* EN ALTTA: VARSAYILAN AYARLARA SIFIRLA BÖLÜMÜ */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Varsayılan Program ve Zil Ayarlarına Dön
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Zil saatlerini (08:40-15:30), yıllık planları ve sınıf listelerini şu anki varsayılan ayarlara döndürür; ders programındaki ekli dersleri temizler
          </p>
        </div>

        {!confirmingReset ? (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="min-h-[42px] px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Varsayılanlara Sıfırla</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                onResetToDefaults();
                setSchoolName('Edirne Merkez İstiklal Ortaokulu');
                setStartDate('2026-09-14');
                setConfirmingReset(false);
                setSavedNotice('Varsayılan zil ve plan ayarlarına dönüldü; ders programı temizlendi.');
                setTimeout(() => setSavedNotice(null), 3000);
              }}
              className="min-h-[40px] px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-xl"
            >
              Evet, Sıfırla
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

