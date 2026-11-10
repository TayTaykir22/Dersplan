import React, { useState } from 'react';
import {
  CheckCircle2,
  FileText,
  MessageSquarePlus,
  Save,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ClassNoteItem,
  ClassRoomGroup,
  StudentRecord,
} from '../types/curriculum';

interface ClassesAndNotesViewProps {
  classes: ClassRoomGroup[];
  activeWeek: number;
  selectedClassRoom: string;
  onSelectClassRoom: (classRoom: string) => void;
  onUpdateClassGroup: (updated: ClassRoomGroup) => void;
}

const QUICK_STUDENT_NOTES = [
  'Derse katılımı çok iyi',
  'Ödevini tam yaptı',
  'Ödev eksik',
  'Kitap / defter eksik',
  'Sözlü performansı yüksek',
  'Veli bilgilendirilecek',
];

export const ClassesAndNotesView: React.FC<ClassesAndNotesViewProps> = ({
  classes,
  activeWeek,
  selectedClassRoom,
  onSelectClassRoom,
  onUpdateClassGroup,
}) => {
  const currentGroup =
    classes.find((c) => c.classRoom === selectedClassRoom) || classes[0];

  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteWeek, setNewNoteWeek] = useState<number>(activeWeek);

  const [newStudentNo, setNewStudentNo] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'Kız' | 'Erkek'>('Kız');
  const [newStudentNote, setNewStudentNote] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Her öğrenci için bireysel not alma / düzenleme durumu
  const [editingNoteStudentNo, setEditingNoteStudentNo] = useState<number | null>(
    null
  );
  const [draftStudentNote, setDraftStudentNote] = useState<string>('');

  if (!currentGroup) {
    return null;
  }

  const totalStudentsAllClasses = classes.reduce(
    (sum, c) => sum + c.students.length,
    0
  );
  const femaleCount = currentGroup.students.filter(
    (s) => s.gender === 'Kız'
  ).length;
  const maleCount = currentGroup.students.filter(
    (s) => s.gender === 'Erkek'
  ).length;

  const filteredStudents = currentGroup.students.filter((st) => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      st.fullName.toLowerCase().includes(q) ||
      String(st.studentNo).includes(q) ||
      (st.performanceNote && st.performanceNote.toLowerCase().includes(q))
    );
  });

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const note: ClassNoteItem = {
      id: `note-${Date.now()}`,
      week: newNoteWeek,
      createdAt: new Date().toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      text: newNoteText.trim(),
      isImportant: true,
      completed: false,
    };

    onUpdateClassGroup({
      ...currentGroup,
      notes: [note, ...currentGroup.notes],
    });
    setNewNoteText('');
  };

  const handleToggleNote = (noteId: string) => {
    onUpdateClassGroup({
      ...currentGroup,
      notes: currentGroup.notes.map((n) =>
        n.id === noteId ? { ...n, completed: !n.completed } : n
      ),
    });
  };

  const handleDeleteNote = (noteId: string) => {
    onUpdateClassGroup({
      ...currentGroup,
      notes: currentGroup.notes.filter((n) => n.id !== noteId),
    });
  };

  const handleOpenStudentNoteEditor = (st: StudentRecord) => {
    if (editingNoteStudentNo === st.studentNo) {
      setEditingNoteStudentNo(null);
      setDraftStudentNote('');
      return;
    }
    setEditingNoteStudentNo(st.studentNo);
    setDraftStudentNote(st.performanceNote || '');
  };

  const handleSaveStudentNote = (studentNo: number, noteText: string) => {
    const cleaned = noteText.trim();
    onUpdateClassGroup({
      ...currentGroup,
      students: currentGroup.students.map((st) =>
        st.studentNo === studentNo
          ? {
              ...st,
              performanceNote: cleaned ? cleaned : undefined,
            }
          : st
      ),
    });
    setEditingNoteStudentNo(null);
    setDraftStudentNote('');
  };

  const handleAppendQuickTagToDraft = (tag: string) => {
    setDraftStudentNote((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return trimmed;
      return `${trimmed} · ${tag}`;
    });
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(newStudentNo, 10);
    if (Number.isNaN(num) || !newStudentName.trim()) return;

    const newRecord: StudentRecord = {
      siraNo: currentGroup.students.length + 1,
      studentNo: num,
      fullName: newStudentName.trim().toLocaleUpperCase('tr-TR'),
      gender: newStudentGender,
      performanceNote: newStudentNote.trim() || undefined,
      plusCount: 0,
      minusCount: 0,
    };

    const sorted = [...currentGroup.students, newRecord]
      .sort((a, b) => a.studentNo - b.studentNo)
      .map((s, idx) => ({ ...s, siraNo: idx + 1 }));

    onUpdateClassGroup({
      ...currentGroup,
      students: sorted,
    });
    setNewStudentNo('');
    setNewStudentName('');
    setNewStudentNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Class Selector Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>T.C. Edirne Valiliği · Merkez / İstiklal Ortaokulu Müdürlüğü</span>
              <span aria-hidden="true">·</span>
              <span>e-Okul Sınıf Listeleri ({classes.length} Şube · {totalStudentsAllClasses} Öğrenci)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {currentGroup.grade}. Sınıf / {currentGroup.classRoom.split('/')[1] || currentGroup.classRoom} Şubesi Sınıf Listesi
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 pt-0.5">
              {currentGroup.classTeacher && (
                <>
                  <span>Sınıf Öğretmeni: <strong>{currentGroup.classTeacher}</strong></span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {currentGroup.assistantPrincipal && (
                <>
                  <span>Sınıf Müdür Yrd: <strong>{currentGroup.assistantPrincipal}</strong></span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>Ders: <strong>{currentGroup.courseName}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
            <span>Kız: <strong>{femaleCount}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Erkek: <strong>{maleCount}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Toplam: <strong>{currentGroup.students.length}</strong></span>
          </div>
        </div>

        {/* Class Switcher Buttons across all 11 classes (5/A-C, 6/A-C, 7/A-B, 8/A-C) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {classes.map((cls) => {
            const active = cls.classRoom === currentGroup.classRoom;
            return (
              <button
                key={cls.classRoom}
                type="button"
                onClick={() => {
                  onSelectClassRoom(cls.classRoom);
                  setEditingNoteStudentNo(null);
                }}
                className={`min-h-[42px] px-3.5 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 tabular-nums ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cls.classRoom}</span>
                <span className="opacity-75 font-mono font-normal">
                  ({cls.students.length})
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 cols: Class Notes & Reminders */}
        <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              {currentGroup.classRoom} Şube Genel Notları
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Şube genel ödev kontrolü, sınav hatırlatmaları ve eksik konular
            </p>
          </div>

          <form onSubmit={handleAddNote} className="space-y-3">
            <textarea
              rows={2}
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder={`${currentGroup.classRoom} şubesi için genel ders notu yazın...`}
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span>Hafta:</span>
                <select
                  value={newNoteWeek}
                  onChange={(e) => setNewNoteWeek(Number(e.target.value))}
                  className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                >
                  {Array.from({ length: 37 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      {w}. Hafta
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 text-xs font-bold bg-slate-900 dark:bg-indigo-600 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0"
              >
                Notu Kaydet
              </button>
            </div>
          </form>

          {currentGroup.notes.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
              {currentGroup.notes.map((note) => (
                <div
                  key={note.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleNote(note.id)}
                    className="flex items-start gap-2.5 text-left group"
                  >
                    <CheckCircle2
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        note.completed
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-300 dark:text-slate-600 group-hover:text-indigo-500'
                      }`}
                    />
                    <div className="space-y-1">
                      <p
                        className={`text-sm leading-relaxed ${
                          note.completed
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200 font-medium'
                        }`}
                      >
                        {note.text}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                        <span>{note.week}. Hafta</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{note.createdAt}</span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                    title="Şube Notunu Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Bu şube için henüz genel ders notu eklenmemiş.
            </div>
          )}
        </section>

        {/* Right 8 cols: Student Roster, Participation (+ / -) & Per-Student Note Editor */}
        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                {currentGroup.classRoom} Şubesi Öğrenci Listesi ve Bireysel Notlar ({currentGroup.students.length} Öğrenci)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Her öğrencinin karşısındaki <strong>Not Al / Notu Düzenle</strong> butonundan öğrenciye özel not ekleyebilirsiniz
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Öğrenci no, ad veya not ara..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Add Student Form */}
          <form
            onSubmit={handleAddStudent}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800"
          >
            <input
              type="number"
              value={newStudentNo}
              onChange={(e) => setNewStudentNo(e.target.value)}
              placeholder="Öğr. No"
              className="sm:col-span-2 min-h-[40px] px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
              required
            />
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Yeni Öğrenci Adı Soyadı"
              className="sm:col-span-4 min-h-[40px] px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              required
            />
            <select
              value={newStudentGender}
              onChange={(e) => setNewStudentGender(e.target.value as 'Kız' | 'Erkek')}
              className="sm:col-span-2 min-h-[40px] px-2.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="Kız">Kız</option>
              <option value="Erkek">Erkek</option>
            </select>
            <input
              type="text"
              value={newStudentNote}
              onChange={(e) => setNewStudentNote(e.target.value)}
              placeholder="Öğrenci notu (isteğe bağlı)"
              className="sm:col-span-2 min-h-[40px] px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="sm:col-span-2 min-h-[40px] px-3 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Öğrenci Ekle
            </button>
          </form>

          {/* Student List: Numara, İsim Soyisim, Cinsiyet ve Not Al */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-b border-slate-200 dark:border-slate-800">
            {filteredStudents.map((st) => {
              const isEditingThisStudent =
                editingNoteStudentNo === st.studentNo;
              const hasSavedNote = Boolean(
                st.performanceNote && st.performanceNote.trim()
              );

              return (
                <div
                  key={st.studentNo}
                  className="py-3.5 px-1 sm:px-2 space-y-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Sol Taraf: Numara, İsim Soyisim ve Cinsiyet */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="min-w-[48px] text-center px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                        {st.studentNo}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {st.fullName}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {st.gender || '—'}
                        </div>
                      </div>
                    </div>

                    {/* Sağ Taraf: Sadece Not Al Butonu */}
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenStudentNoteEditor(st)}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 ${
                          isEditingThisStudent
                            ? 'bg-indigo-600 text-white'
                            : hasSavedNote
                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {hasSavedNote ? 'Notu Düzenle' : 'Not Al'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Öğrencinin Kayıtlı Notu Varsa Göster */}
                  {hasSavedNote && !isEditingThisStudent && (
                    <div
                      onClick={() => handleOpenStudentNoteEditor(st)}
                      className="ml-7 sm:ml-9 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <span className="font-extrabold text-amber-800 dark:text-amber-300 mr-1.5">
                          Öğrenci Notu:
                        </span>
                        {st.performanceNote}
                      </div>
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 underline shrink-0">
                        Düzenle
                      </span>
                    </div>
                  )}

                  {/* Açılır Bireysel Öğrenci Not Alma Kutusu */}
                  {isEditingThisStudent && (
                    <div className="ml-2 sm:ml-9 p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300">
                          {st.studentNo} - {st.fullName} İçin Öğrenci Notu
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingNoteStudentNo(null)}
                          className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          title="Kapat"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Tek Dokunuşla Hızlı Not Etiketleri */}
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_STUDENT_NOTES.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAppendQuickTagToDraft(tag)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-500"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        value={draftStudentNote}
                        onChange={(e) => setDraftStudentNote(e.target.value)}
                        placeholder={`${st.fullName} hakkında ders içi gözlem, ödev, davranış veya performans notu yazın...`}
                        className="w-full p-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                      />

                      <div className="flex items-center justify-end gap-2">
                        {hasSavedNote && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSaveStudentNote(st.studentNo, '')
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40"
                          >
                            Notu Temizle
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveStudentNote(
                              st.studentNo,
                              draftStudentNote
                            )
                          }
                          className="min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Öğrenci Notunu Kaydet
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary Footer matching e-Okul Bottom Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Kız Öğrenci Sayısı : {femaleCount}</span>
            <span>Erkek Öğrenci Sayısı : {maleCount}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              Toplam Öğrenci Sayısı : {currentGroup.students.length}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
};

