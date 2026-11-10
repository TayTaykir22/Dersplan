export type DayOfWeek = 'Pazartesi' | 'Salı' | 'Çarşamba' | 'Perşembe' | 'Cuma';

export type CourseName =
  | 'Sosyal Bilgiler'
  | 'T.C. İnkılap Tarihi ve Atatürkçülük'
  | 'Ahlak ve Vatandaşlık Eğitimi'
  | 'Seçmeli Görgü Kuralları ve Nezaket';

export interface BellSlot {
  period: number;
  start: string; // "08:50"
  end: string;   // "09:30"
  label: string; // "1. Ders"
  breakAfterMinutes: number;
  breakLabel?: string; // "Öğle Arası"
}

export interface ScheduleEntry {
  id: string;
  day: DayOfWeek;
  period: number;
  start: string;
  end: string;
  classRoom: string; // Örn: "7/A", "8/B", "6/A"
  grade: number;     // 5, 6, 7, 8
  courseName: CourseName;
  roomNumber?: string; // Örn: "Derslik 204"
}

export interface CurriculumEntry {
  id: string;
  course_name: CourseName;
  grade: number;
  week: number;
  date_range: string;        // Örn: "03-09 Kasım"
  unit: string;              // Ünite / Öğrenme Alanı
  content_framework: string; // Konu / İçerik Çerçevesi
  learning_outcome: string;  // Öğrenme Çıktısı / Kazanım
  outcome_code: string;      // Örn: "SB.7.2.3" veya "İTA.8.2.5"
  explanation?: string;      // Açıklama / Süreç Bileşenleri (PDF'deki AÇIKLAMA sütunu)
  methods_and_techniques: string;
  values_and_skills: string;
  special_days?: string;     // Belirli Gün ve Haftalar / Ölçme ve Değerlendirme
}

export interface HolidayPeriod {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  type: 'ara_tatil' | 'yariyil' | 'resmi_tatil';
  affectsWeekCount: boolean; // true for full-week breaks (Ara Tatil, Yarıyıl)
}

export interface AcademicCalendarConfig {
  schoolName: string;
  teacherName: string;
  branchName: string;
  academicYearLabel: string; // "2026 - 2027"
  startDate: string;         // "2026-09-07" (Pazartesi)
  endDate: string;           // "2027-06-18"
  totalWeeks: number;        // 36
  holidays: HolidayPeriod[];
}

export interface StudentRecord {
  siraNo?: number;
  studentNo: number;
  fullName: string;
  gender?: 'Kız' | 'Erkek';
  performanceNote?: string;
  plusCount: number;
  minusCount: number;
}

export interface ClassNoteItem {
  id: string;
  week: number;
  createdAt: string;
  text: string;
  isImportant: boolean;
  completed: boolean;
}

export interface ClassRoomGroup {
  classRoom: string; // "5/A", "6/A", "7/A", "8/A" vb.
  grade: number;
  courseName: CourseName;
  classTeacher?: string;
  assistantPrincipal?: string;
  students: StudentRecord[];
  notes: ClassNoteItem[];
}

export interface LessonCompletionRecord {
  key: string; // `${week}_${day}_${period}_${classRoom}`
  completedAt: string;
  teacherReflection?: string;
}

export interface AppDataStore {
  academicConfig: AcademicCalendarConfig;
  bellSchedule: BellSlot[];
  schedule: ScheduleEntry[];
  curriculum: CurriculumEntry[];
  classes: ClassRoomGroup[];
  completedLessons: Record<string, LessonCompletionRecord>;
}
