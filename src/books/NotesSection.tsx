import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Note, ImageAsset, ReadingSession } from './types';
import type { SqliteNotesRepository } from './notesRepository';
import { NoteForm } from './NoteForm';
import { getNoteRecordedOn } from './annualRecapRepository';

function readingLabel(note: Note, sessions: ReadingSession[]): string {
  const ordinal = sessions.find(session => session.id === note.readingSessionId)?.ordinal;
  return ordinal ? `第 ${ordinal} 次阅读后` : '未关联到具体阅读次数';
}

export function NotesSection({ bookId, repository, highlights, sessions = [], onChanged, onSelect, focusNoteId, onFocusResult }: { bookId: string; repository: SqliteNotesRepository; highlights: ImageAsset[]; sessions?: ReadingSession[]; onChanged?: () => void; onSelect?: (images: ImageAsset[]) => void; focusNoteId?: string; onFocusResult?: (found: boolean, contentY?: number) => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Note | null | undefined>(undefined);
  const [loadedBookId, setLoadedBookId] = useState<string | null>(null);
  async function refresh() { setNotes(await repository.listNotes(bookId)); }
  useEffect(() => {
    let active = true;
    void repository.listNotes(bookId).then(next => { if (active) { setNotes(next); setLoadedBookId(bookId); } });
    return () => { active = false; };
  }, [bookId, repository]);
  useEffect(() => {
    if (!focusNoteId || loadedBookId !== bookId) return;
    const target = notes.find(note => note.id === focusNoteId);
    if (!target) onFocusResult?.(false);
    else onFocusResult?.(true);
  }, [bookId, focusNoteId, loadedBookId, notes, onFocusResult]);
  if (editing !== undefined) return <NoteForm bookId={bookId} note={editing ?? undefined} highlights={highlights} repository={repository} onSaved={() => { setEditing(undefined); void refresh(); onChanged?.(); }} onCancel={() => setEditing(undefined)} />;
  async function remove(note: Note) {
    Alert.alert('删除摘记？', '删除后文字摘记将无法恢复，图片仍会保留在精彩片段或其他摘记中。', [
      { text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: async () => { await repository.deleteNote(bookId, note.id); await refresh(); onChanged?.(); } },
    ]);
  }
  return <View style={styles.container}><View style={styles.heading}><Text style={styles.label}>摘记</Text><Pressable onPress={() => setEditing(null)}><Text style={styles.add}>新增摘记</Text></Pressable></View>
    {notes.length ? notes.map(note => <View key={note.id} testID={`note-${note.id}`} onLayout={event => { if (note.id === focusNoteId) onFocusResult?.(true, event.nativeEvent.layout.y); }} style={[styles.note, note.id === focusNoteId && styles.focusedNote]}><Text style={styles.meta}>{getNoteRecordedOn(note) ?? '日期未记录'} · {readingLabel(note, sessions)}</Text><Text style={styles.body}>{note.body}</Text><View style={styles.grid}>{note.images.map(image => <Pressable key={image.id} accessibilityRole="button" accessibilityLabel="打开摘记图片" onPress={() => onSelect?.([image])}><Image source={{ uri: image.localPath }} style={styles.image} /></Pressable>)}</View><View style={styles.actions}><Pressable onPress={() => setEditing(note)}><Text style={styles.link}>编辑</Text></Pressable><Pressable onPress={() => void remove(note)}><Text style={styles.delete}>删除</Text></Pressable></View></View>) : <Text style={styles.empty}>还没有摘记</Text>}
  </View>;
}

const styles = StyleSheet.create({ container: { backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 12 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, label: { fontSize: 16, fontWeight: '700', color: '#302a25' }, add: { color: '#593f72', fontWeight: '700' }, note: { borderTopWidth: 1, borderTopColor: '#eee7df', paddingTop: 12, gap: 8 }, focusedNote: { borderColor: '#593f72', borderWidth: 1, borderRadius: 10, padding: 10 }, meta: { color: '#766f68', fontSize: 13 }, body: { color: '#302a25', fontSize: 16, lineHeight: 24 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, image: { width: 76, height: 76, borderRadius: 8 }, actions: { flexDirection: 'row', gap: 18 }, link: { color: '#593f72', fontWeight: '600' }, delete: { color: '#b52626', fontWeight: '600' }, empty: { color: '#766f68' }, });
