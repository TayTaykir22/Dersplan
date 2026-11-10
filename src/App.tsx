/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import {
  AcademicCalendarConfig,
  AppDataStore,
  BellSlot,
  ClassRoomGroup,
  DayOfWeek,
  ScheduleEntry,
} from './types/curriculum';
import { DEFAULT_APP_DATA } from './data/defaultData';
import {
  calculateAcademicWeek,
  matchCurrentOrNextLesson,
  parseTimeToMinutes,
} from './utils/timeEngine';
import { DashboardView } from './components/DashboardView';
import { ClassesAndNotesView } from './components/ClassesAndNotesView';
import { SettingsAndDataView } from './components/SettingsAndDataView';

const STORAGE_KEY = 'dersplan_offline_store_v6_empty_schedule';
const LEGACY_KEYS = [
  'dersplan_offline_store_v1',
  'dersplan_offline_store_v2_istiklal',
  'dersplan_offline_store_v3_mobile',
  'dersplan_offline_store_v4_pdf_plans',
  'dersplan_offline_store_v5_5courses_37w',
];
const THEME_STORAGE_KEY = 'dersplan_theme_v1';

type ActiveTab = 'dashboard' | 'classes' | 'settings';

export default function App() {
  // 1. Dark Mode State (Synced with document.documentElement.classList)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      // ignore storage errors
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  // 2. Offline-First Local Data Store
  const [dataStore, setDataStore] = useState<AppDataStore>(() => {
    try {
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppDataStore>;
        if (
          parsed &&
          Array.isArray(parsed.schedule) &&
          Array.isArray(parsed.curriculum) &&
          Array.isArray(parsed.bellSchedule) &&
          parsed.bellSchedule.length === 7 &&
          Array.isArray(parsed.classes) &&
          parsed.classes.length === DEFAULT_APP_DATA.classes.length
        ) {
          return {
            academicConfig:
              parsed.academicConfig || DEFAULT_APP_DATA.academicConfig,
            bellSchedule: parsed.bellSchedule,
            schedule: parsed.schedule,
            curriculum: parsed.curriculum,
            classes: parsed.classes,
            completedLessons:
              parsed.completedLessons || DEFAULT_APP_DATA.completedLessons,
          };
        }
      }
    } catch {
      // fallback to default MEB & İstiklal Ortaokulu e-Okul data
    }
    return DEFAULT_APP_DATA;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataStore));
    } catch {
      // ignore storage quota errors
    }
  }, [dataStore]);

  // 3. Real-Time System Clock + Smart School-Hour Simulation Fallback
  const [now, setNow] = useState<Date>(() => new Date());

  const [isSimulatingTime, setIsSimulatingTime] = useState<boolean>(() => {
    const initial = new Date();
    const day = initial.getDay();
    const mins = initial.getHours() * 60 + initial.getMinutes();
    const firstBell = parseTimeToMinutes('08:40');
    const lastBell = parseTimeToMinutes('15:30');
    // If opened outside weekday school hours (08:40 - 15:30), start in active 3rd lesson (10:45) so the Live Lesson Card and progress bar are immediately active
    return day === 0 || day === 6 || mins < firstBell || mins >= lastBell;
  });

  const [simulatedMinutes, setSimulatedMinutes] = useState<number>(
    10 * 60 + 45 // 10:45 -> 3. Ders (10:30 - 11:10), 25 minutes remaining
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Navigation & Selection State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedWeekOverride, setSelectedWeekOverride] = useState<
    number | null
  >(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedClassRoom, setSelectedClassRoom] = useState<string>('7/A');

  // 5. Core Logic: Automatic Week Calculation from Academic Year Start Date & Holidays
  const weekCalc = useMemo(
    () => calculateAcademicWeek(now, dataStore.academicConfig),
    [now, dataStore.academicConfig]
  );

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(
    () => weekCalc.dayOfWeek
  );

  // Construct effective Date for lesson matching
  const effectiveMatchDate = useMemo(() => {
    if (!isSimulatingTime) return now;
    const d = new Date(now);
    const h = Math.floor(simulatedMinutes / 60);
    const m = simulatedMinutes % 60;
    d.setHours(h, m, now.getSeconds(), 0);
    return d;
  }, [now, isSimulatingTime, simulatedMinutes]);

  const liveMatch = useMemo(
    () =>
      matchCurrentOrNextLesson(
        effectiveMatchDate,
        selectedDay,
        isSimulatingTime ? false : weekCalc.isWeekend,
        dataStore.schedule,
        dataStore.bellSchedule
      ),
    [
      effectiveMatchDate,
      selectedDay,
      isSimulatingTime,
      weekCalc.isWeekend,
      dataStore.schedule,
      dataStore.bellSchedule,
    ]
  );

  const realClockText = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  // Handlers
  const handleToggleSimulatingTime = (
    enabled: boolean,
    targetMinutes?: number
  ) => {
    setIsSimulatingTime(enabled);
    if (typeof targetMinutes === 'number') {
      setSimulatedMinutes(targetMinutes);
    }
  };

  const handleToggleCompleteLesson = (
    lesson: ScheduleEntry,
    week: number,
    reflection?: string
  ) => {
    const key = `${week}_${lesson.day}_${lesson.period}_${lesson.classRoom}`;
    setDataStore((prev) => {
      const nextCompleted = { ...prev.completedLessons };
      if (nextCompleted[key]) {
        delete nextCompleted[key];
      } else {
        nextCompleted[key] = {
          key,
          completedAt: new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          teacherReflection: reflection,
        };
      }
      return {
        ...prev,
        completedLessons: nextCompleted,
      };
    });
  };

  const handleOpenClassDetail = (classRoom: string) => {
    setSelectedClassRoom(classRoom);
    setActiveTab('classes');
  };

  const handleUpdateClassGroup = (updated: ClassRoomGroup) => {
    setDataStore((prev) => ({
      ...prev,
      classes: prev.classes.map((c) =>
        c.classRoom === updated.classRoom ? updated : c
      ),
    }));
  };

  const handleUpdateAcademicConfig = (cfg: AcademicCalendarConfig) => {
    setDataStore((prev) => ({ ...prev, academicConfig: cfg }));
  };

  const handleUpdateBellSchedule = (bells: BellSlot[]) => {
    setDataStore((prev) => ({ ...prev, bellSchedule: bells }));
  };

  const handleUpdateSchedule = (schedule: ScheduleEntry[]) => {
    setDataStore((prev) => ({ ...prev, schedule }));
  };

  const handleResetToDefaults = () => {
    setDataStore(DEFAULT_APP_DATA);
    setSelectedWeekOverride(null);
    setSelectedLessonId(null);
  };

  const effectiveWeek = selectedWeekOverride ?? weekCalc.weekNumber;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-8 px-3.5 sm:px-6 h-14">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#ana-ekran"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            DersPlan
          </a>

          {/* Zone 2: 3 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            <a
              href="#ana-ekran"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('dashboard');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'dashboard'
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Ana Ekran
            </a>
            <a
              href="#sinif-notlar"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('classes');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'classes'
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Sınıflar ve Notlar
            </a>
            <a
              href="#program-ayarlari"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('settings');
              }}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === 'settings'
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Program ve Zil
            </a>
          </nav>

          {/* Zone 3: 1 primary action (Dark/Light Mode Toggle) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Aydınlık</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>Karanlık</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            weekCalc={weekCalc}
            liveMatch={liveMatch}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            selectedWeekOverride={selectedWeekOverride}
            onChangeWeekOverride={setSelectedWeekOverride}
            selectedLessonId={selectedLessonId}
            onSelectLessonId={setSelectedLessonId}
            schedule={dataStore.schedule}
            bellSchedule={dataStore.bellSchedule}
            curriculum={dataStore.curriculum}
            classes={dataStore.classes}
            academicConfig={dataStore.academicConfig}
            completedLessons={dataStore.completedLessons}
            onToggleCompleteLesson={handleToggleCompleteLesson}
            onOpenClassDetail={handleOpenClassDetail}
            onUpdateClassGroup={handleUpdateClassGroup}
            onOpenSettings={() => setActiveTab('settings')}
            isSimulatingTime={isSimulatingTime}
            simulatedMinutes={simulatedMinutes}
            onToggleSimulatingTime={handleToggleSimulatingTime}
            realClockText={realClockText}
          />
        )}

        {activeTab === 'classes' && (
          <ClassesAndNotesView
            classes={dataStore.classes}
            activeWeek={effectiveWeek}
            selectedClassRoom={selectedClassRoom}
            onSelectClassRoom={setSelectedClassRoom}
            onUpdateClassGroup={handleUpdateClassGroup}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsAndDataView
            dataStore={dataStore}
            onUpdateAcademicConfig={handleUpdateAcademicConfig}
            onUpdateBellSchedule={handleUpdateBellSchedule}
            onUpdateSchedule={handleUpdateSchedule}
            onResetToDefaults={handleResetToDefaults}
          />
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (3 TABS: Ana Ekran, Sınıflar, Program) */}
      <nav
        aria-label="Mobil Alt Menü"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 items-center h-16 px-2"
      >
        {[
          { id: 'dashboard', label: 'Ana Ekran', icon: LayoutDashboard },
          { id: 'classes', label: 'Sınıflar ve Notlar', icon: Users },
          { id: 'settings', label: 'Program ve Zil', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                active
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs mt-0.5 whitespace-nowrap shrink-0">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

