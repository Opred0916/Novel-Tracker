import React, { useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { BOOK_STATUS_LABELS } from '../books/status';
import { BOOK_STATUSES, BOOK_TYPES } from '../books/types';
import { BOOK_TYPE_LABELS } from '../books/TypePicker';
import { summarizeImport, type DuplicateHint, type ImportReview, type ImportReviewItem } from './importReview';
import { applyImportReviewAction } from './importReviewActions';
import type { ImportSourceRef } from './importTypes';
import { useTheme } from '../theme/ThemeProvider';
import { UI_LAYOUT } from '../ui/layout';

type SourcePage = { id: string; uri: string };

export function ImportReviewList({ review, hints, busy, error, sourcePages = [], onChange, onConfirm, onCancel }: {
  review: ImportReview; hints: DuplicateHint[]; busy: boolean; error?: string; sourcePages?: SourcePage[]; onChange: (next: ImportReview) => void; onConfirm: () => void; onCancel: () => void;
}) {
  const { theme } = useTheme();
  const [actionError, setActionError] = useState('');
  const [previewPage, setPreviewPage] = useState<SourcePage | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const { width, height } = useWindowDimensions();
  function updateItem(index: number, update: Partial<ImportReviewItem>) {
    const items = [...review.items];
    const previous = items[index];
    const edited = Object.keys(previous.candidate.fieldReview ?? {}).filter(field => update.candidate &&
      update.candidate[field as keyof ImportReviewItem['candidate']] !== previous.candidate[field as keyof ImportReviewItem['candidate']]);
    items[index] = { ...previous, ...update, confirmedFields: [...new Set([...(previous.confirmedFields ?? []), ...edited])] };
    onChange({ ...review, items });
  }
  function apply(action: Parameters<typeof applyImportReviewAction>[1]) {
    try { onChange(applyImportReviewAction(review, action)); setActionError(''); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : '无法修改候选，请核对后重试'); }
  }
  function sourceLabel(ref: ImportSourceRef | undefined, fallbackLine: number): string {
    if (!ref) return `第 ${fallbackLine} 行`;
    const pageNumber = sourcePages.findIndex(page => page.id === ref.pageId) + 1;
    return pageNumber ? `第 ${pageNumber} 张截图 · 第 ${ref.line} 行` : `截图 · 第 ${ref.line} 行`;
  }
  function sourceImage(ref: ImportSourceRef | undefined) {
    if (!ref) return null;
    const pageIndex = sourcePages.findIndex(page => page.id === ref.pageId);
    if (pageIndex < 0) return null;
    const page = sourcePages[pageIndex];
    return <Pressable accessibilityRole="button" accessibilityLabel={`查看第${pageIndex + 1}张截图原图`} onPress={() => setPreviewPage(page)}>
      <Image accessibilityLabel={`第${pageIndex + 1}张截图`} source={{ uri: page.uri }} style={styles.sourceImage} resizeMode="contain" />
    </Pressable>;
  }
  function splitNote(candidateId: string, noteId: string) {
    let nextId = `split-${noteId}`;
    let suffix = 2;
    while (review.items.some(item => item.candidate.id === nextId)) nextId = `split-${noteId}-${suffix++}`;
    apply({ type: 'split_candidate', sourceCandidateId: candidateId, newCandidateId: nextId, noteIds: [noteId] });
  }
  const summary = summarizeImport(review);
  const pendingHint = (item: ImportReviewItem, hint: DuplicateHint) => hint.kind === 'book'
    ? Boolean((hint.existingBookId && !item.acknowledgedDuplicateBookIds.includes(hint.existingBookId))
      || (hint.otherCandidateId && !(item.acknowledgedDuplicateCandidateIds ?? []).includes(hint.otherCandidateId)))
    : Boolean(hint.existingNoteId && !item.acknowledgedDuplicateNoteIds.includes(hint.existingNoteId));
  const unresolved = (item: ImportReviewItem) => item.action !== 'skip' && (Object.entries(item.candidate.fieldReview ?? {}).some(([field, reason]) =>
    Boolean(reason) && !(item.confirmedFields ?? []).includes(field)) || hints.some(hint => hint.candidateId === item.candidate.id && pendingHint(item, hint)));
  const unresolvedCount = review.items.filter(unresolved).length + review.fragments.filter(fragment => !review.fragmentDecisions[fragment.id]).length;
  const visibleItems = review.items.map((item, index) => ({ item, index })).filter(({ item }) => !onlyUnresolved || unresolved(item));
  return <View style={styles.container}>
    <Text style={[styles.heading, { color: theme.text }]}>导入预览</Text>
    <Text style={[styles.help, { color: theme.mutedText }]}>重复书目不会自动合并；请逐项选择新增、跳过或追加摘记。未处理原文会阻止确认。</Text>
    <View style={styles.row}><Text style={[styles.summary, { color: theme.text }]}>{review.items.length} 本候选 · {unresolvedCount} 项待确认</Text><Pressable accessibilityRole="button" accessibilityLabel="只看待确认" onPress={() => setOnlyUnresolved(value => !value)}><Text style={[styles.linkText, { color: theme.primary }]}>{onlyUnresolved ? '查看全部' : '只看待确认'}</Text></Pressable></View>
    {error ? <Text style={[styles.warning, { color: theme.danger }]}>{error}</Text> : null}
    {actionError ? <Text style={[styles.warning, { color: theme.danger }]}>{actionError}</Text> : null}
    {review.warnings?.map((warning, index) => <Text key={`warning-${index}`} style={styles.warning}>提示：{warning}</Text>)}
    <FlatList testID="import-review-list" data={visibleItems} keyExtractor={row => row.item.candidate.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets renderItem={({ item: row }) => {
      const { item, index } = row;
      const expanded = expandedIds.includes(item.candidate.id);
      const itemHints = hints.filter(hint => hint.candidateId === item.candidate.id);
      return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.source, { color: theme.mutedText }]}>{sourceLabel(item.candidate.sourceRef, item.candidate.sourceLine)}</Text>
        {item.candidate.sourceText.trim() ? <Text style={[styles.originalText, { color: theme.mutedText, backgroundColor: theme.primarySoft }]}>原文：{item.candidate.sourceText.trim()}</Text> : null}
        {sourceImage(item.candidate.sourceRef)}
        <TextInput accessibilityLabel={`第${index + 1}条书名`} value={item.candidate.title} onChangeText={title => updateItem(index, { candidate: { ...item.candidate, title }, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateCandidateIds: [] })} placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
        <TextInput accessibilityLabel={`第${index + 1}条作者`} value={item.candidate.author ?? ''} onChangeText={author => updateItem(index, { candidate: { ...item.candidate, author: author || null } })} placeholder="作者（选填）" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
        <TextInput accessibilityLabel={`第${index + 1}条评分`} keyboardType="decimal-pad" value={item.candidate.ratingHalfStars === null ? '' : String(item.candidate.ratingHalfStars / 2)} onChangeText={value => updateItem(index, { candidate: { ...item.candidate, ratingHalfStars: value.trim() ? Math.round(Number(value) * 2) : null } })} placeholder="评分（已读可填 0.5～5）" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
        {Object.entries(item.candidate.fieldReview ?? {}).filter(([field, reason]) => reason && !(item.confirmedFields ?? []).includes(field)).map(([field, reason]) => <View key={field} style={styles.row}><Text style={styles.warning}>{reason}</Text><Pressable accessibilityRole="button" accessibilityLabel={`确认第${index + 1}条${field === 'author' ? '作者' : field === 'title' ? '书名' : field === 'ratingHalfStars' ? '评分' : '信息'}`} onPress={() => apply({ type: 'confirm_field', candidateId: item.candidate.id, field: field as keyof NonNullable<typeof item.candidate.fieldReview> })}><Text style={[styles.linkText, { color: theme.primary }]}>确认无误</Text></Pressable></View>)}
        <Pressable accessibilityRole="button" accessibilityLabel={`第${index + 1}条更多资料`} onPress={() => setExpandedIds(ids => expanded ? ids.filter(id => id !== item.candidate.id) : [...ids, item.candidate.id])}><Text style={[styles.linkText, { color: theme.primary }]}>{expanded ? '收起资料' : '更多资料'}</Text></Pressable>
        {expanded ? <View style={styles.details}>
        <TextInput accessibilityLabel={`第${index + 1}条主角`} value={item.candidate.protagonists.join('、')} onChangeText={value => updateItem(index, { candidate: { ...item.candidate, protagonists: value.split(/[、,，]+/).map(name => name.trim()).filter(Boolean) } })} placeholder="主角（选填，多个用顿号分隔）" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
        <TextInput accessibilityLabel={`第${index + 1}条标签`} value={item.candidate.tagIds.join('、')} onChangeText={value => updateItem(index, { candidate: { ...item.candidate, tagIds: value.split(/[、,，]+/).map(tag => tag.trim()).filter(Boolean) } })} placeholder="标签（选填）" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
        <View style={styles.row}>{BOOK_TYPES.map(type => { const selected = item.candidate.bookType === type; return <Pressable key={type} onPress={() => updateItem(index, { candidate: { ...item.candidate, bookType: type } })} style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{BOOK_TYPE_LABELS[type]}</Text></Pressable>; })}</View>
        <View style={styles.row}>{BOOK_STATUSES.map(status => { const selected = item.candidate.status === status; return <Pressable key={status} onPress={() => updateItem(index, { candidate: { ...item.candidate, status } })} style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{BOOK_STATUS_LABELS[status]}</Text></Pressable>; })}</View>
        {item.candidate.sessions.map((session, sessionIndex) => <View key={`${item.candidate.id}-session-${session.ordinal}`} style={[styles.session, { backgroundColor: theme.primarySoft }]}><Text style={[styles.source, { color: theme.mutedText }]}>第 {session.ordinal} 次阅读日期（可留空）</Text><TextInput accessibilityLabel={`第${index + 1}条第${session.ordinal}次开始日期`} value={session.startedOn ?? ''} onChangeText={value => updateItem(index, { candidate: { ...item.candidate, sessions: item.candidate.sessions.map((entry, position) => position === sessionIndex ? { ...entry, startedOn: value || null } : entry) } })} placeholder="开始日期 YYYY-MM-DD" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} /><TextInput accessibilityLabel={`第${index + 1}条第${session.ordinal}次结束日期`} value={session.endedOn ?? ''} onChangeText={value => updateItem(index, { candidate: { ...item.candidate, sessions: item.candidate.sessions.map((entry, position) => position === sessionIndex ? { ...entry, endedOn: value || null } : entry) } })} placeholder="结束日期 YYYY-MM-DD" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} /></View>)}
        {item.candidate.notes.map((note, noteIndex) => <View key={note.id} style={styles.noteGroup}>
          {note.sourceRef ? <Text style={[styles.source, { color: theme.mutedText }]}>来源：{sourceLabel(note.sourceRef, item.candidate.sourceLine)}</Text> : null}
          {note.sourceRef?.pageId !== item.candidate.sourceRef?.pageId ? sourceImage(note.sourceRef) : null}
          <TextInput accessibilityLabel={`第${index + 1}条摘记${noteIndex + 1}`} value={note.body} onChangeText={body => updateItem(index, { candidate: { ...item.candidate, notes: item.candidate.notes.map((entry, position) => position === noteIndex ? { ...entry, body } : entry) } })} placeholderTextColor={theme.mutedText} style={[styles.note, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} multiline />
          <TextInput accessibilityLabel={`第${index + 1}条摘记${noteIndex + 1}原记录日期`} value={note.originalRecordedOn ?? ''} onChangeText={date => updateItem(index, { candidate: { ...item.candidate, notes: item.candidate.notes.map((entry, position) => position === noteIndex ? { ...entry, originalRecordedOn: date || null } : entry) } })} placeholder={note.recordedAtHint ? `原文时间：${note.recordedAtHint}，请输入四位日期` : '原记录日期 YYYY-MM-DD（可留空）'} placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
          <TextInput accessibilityLabel={`第${index + 1}条摘记${noteIndex + 1}原记录时间`} value={note.originalRecordedTime ?? ''} onChangeText={time => updateItem(index, { candidate: { ...item.candidate, notes: item.candidate.notes.map((entry, position) => position === noteIndex ? { ...entry, originalRecordedTime: time || null } : entry) } })} placeholder="原记录时间 HH:MM（可留空）" placeholderTextColor={theme.mutedText} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]} />
          <View style={styles.row}>{review.items.filter(target => target.candidate.id !== item.candidate.id && target.action !== 'skip').map(target => <Pressable key={target.candidate.id} onPress={() => apply({ type: 'move_note', noteId: note.id, targetCandidateId: target.candidate.id })} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text }}>移动到《{target.candidate.title || '未命名'}》</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel={`拆出第${noteIndex + 1}条摘记为新书`} onPress={() => splitNote(item.candidate.id, note.id)} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text }}>拆出为新书</Text></Pressable><Pressable onPress={() => apply({ type: 'delete_note', noteId: note.id })} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.danger }}>删除摘记</Text></Pressable></View>
        </View>)}
        <View style={styles.row}>{review.items.filter(target => target.candidate.id !== item.candidate.id && target.action !== 'skip').map(target => <Pressable key={target.candidate.id} accessibilityRole="button" accessibilityLabel={`将第${index + 1}条候选合并到《${target.candidate.title || '未命名'}》`} onPress={() => apply({ type: 'merge_candidates', sourceCandidateId: item.candidate.id, targetCandidateId: target.candidate.id })} style={styles.action}><Text>合并到《{target.candidate.title || '未命名'}》</Text></Pressable>)}</View>
        </View> : null}
        {itemHints.map((hint, hintIndex) => <View key={`${hint.candidateId}-${hintIndex}`}><Text style={styles.warning}>{hint.message}</Text>{hint.kind === 'book' && hint.existingBookId && !item.acknowledgedDuplicateBookIds.includes(hint.existingBookId) ? <Pressable onPress={() => updateItem(index, { acknowledgedDuplicateBookIds: [...item.acknowledgedDuplicateBookIds, hint.existingBookId!] })}><Text style={styles.link}>确认仍新增</Text></Pressable> : null}{hint.kind === 'book' && hint.otherCandidateId && !(item.acknowledgedDuplicateCandidateIds ?? []).includes(hint.otherCandidateId) ? <Pressable accessibilityRole="button" accessibilityLabel="确认仍新增本批同名书" onPress={() => updateItem(index, { acknowledgedDuplicateCandidateIds: [...(item.acknowledgedDuplicateCandidateIds ?? []), hint.otherCandidateId!] })}><Text style={styles.link}>确认仍新增本批同名书</Text></Pressable> : null}{hint.kind === 'note' && hint.existingNoteId && !item.acknowledgedDuplicateNoteIds.includes(hint.existingNoteId) ? <Pressable onPress={() => updateItem(index, { acknowledgedDuplicateNoteIds: [...item.acknowledgedDuplicateNoteIds, hint.existingNoteId!] })}><Text style={styles.link}>确认仍追加</Text></Pressable> : null}</View>)}
        <View style={styles.row}>{(['create', 'append_notes', 'skip'] as const).map(action => { const selected = item.action === action; const label = action === 'create' ? '新增' : action === 'append_notes' ? '追加摘记' : '跳过'; return <Pressable key={action} onPress={() => updateItem(index, { action, ...(action === 'create' ? { targetBookId: null } : action === 'append_notes' ? { targetBookId: hintTarget(itemHints) } : {}) })} style={[styles.action, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}><Text style={{ color: selected ? theme.card : theme.text, fontWeight: selected ? '700' : '500' }}>{label}</Text></Pressable>; })}</View>
      </View>;
    }} ListFooterComponent={<View style={styles.footer}>
      {review.fragments.map(fragment => {
        const decision = review.fragmentDecisions[fragment.id];
        if (decision) return <View key={fragment.id} style={[styles.fragment, { backgroundColor: theme.primarySoft }]}><Text style={[styles.warning, { color: theme.mutedText }]}>原文片段：{fragment.text}</Text><Text style={styles.done}>已处理：{decision.kind === 'ignore' ? '明确忽略' : decision.kind === 'book' ? '设为候选书目' : '已成为摘记'}</Text></View>;
        return <View key={fragment.id} style={[styles.fragment, { backgroundColor: theme.primarySoft }]}><Text style={[styles.warning, { color: theme.mutedText }]}>原文未归属（{fragment.sourceRef ? sourceLabel(fragment.sourceRef, fragment.sourceLine) : `第 ${fragment.sourceLine} 行`}）：{fragment.text}</Text>{sourceImage(fragment.sourceRef)}<View style={styles.row}>{review.items.filter(item => item.action !== 'skip').map(item => <Pressable key={item.candidate.id} onPress={() => apply({ type: 'fragment_to_note', fragmentId: fragment.id, candidateId: item.candidate.id, noteId: `fragment-note-${fragment.id}`, body: fragment.text })} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text }}>作为想法附到《{item.candidate.title || '未命名'}》</Text></Pressable>)}<Pressable onPress={() => apply({ type: 'fragment_to_book', fragmentId: fragment.id, candidateId: `fragment-book-${fragment.id}`, title: fragment.text })} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text }}>设为新书</Text></Pressable><Pressable onPress={() => apply({ type: 'ignore_fragment', fragmentId: fragment.id })} style={[styles.action, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.danger }}>明确忽略</Text></Pressable></View></View>;
      })}
      <Text style={[styles.summary, { color: theme.text }]}>新增书 {summary.createdBooks} 本 · 追加想法 {summary.appendedNotes} 条 · 跳过项 {summary.skippedItems} 条 · 忽略片段 {Object.values(review.fragmentDecisions).filter(decision => decision.kind === 'ignore').length} 条 · 未处理片段 {review.fragments.filter(fragment => !review.fragmentDecisions[fragment.id]).length} 条</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[styles.primary, { backgroundColor: theme.primary }, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? '正在导入…' : '确认导入'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.link}><Text style={[styles.linkText, { color: theme.primary }]}>返回修改文字</Text></Pressable>
    </View>} />
    <Modal visible={Boolean(previewPage)} transparent animationType="fade" onRequestClose={() => setPreviewPage(null)}>
      <View style={styles.previewBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭截图原图" onPress={() => setPreviewPage(null)} style={styles.previewClose}><Text style={styles.previewCloseText}>关闭原图</Text></Pressable>
        {previewPage ? <Image accessibilityLabel="放大截图" source={{ uri: previewPage.uri }} style={{ width: width - 24, height: height * 0.78 }} resizeMode="contain" /> : null}
      </View>
    </Modal>
  </View>;
}

function hintTarget(hints: DuplicateHint[]): string | null { return hints.find(hint => hint.targetBookId)?.targetBookId ?? null; }
const styles = StyleSheet.create({
  container: { flex: 1, padding: UI_LAYOUT.pageInset }, heading: { fontSize: 24, fontWeight: '700', color: '#302a25' }, help: { color: '#766f68', lineHeight: 20, marginVertical: 8 }, list: { gap: 14, paddingBottom: 80 }, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 }, details: { gap: 10 }, source: { color: '#817871', fontSize: 13 }, originalText: { fontSize: 13, lineHeight: 19, padding: 10, borderRadius: 8 }, sourceImage: { width: '100%', height: 180, backgroundColor: '#f5f1ec', borderRadius: 10 }, input: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 10, padding: 11, color: '#302a25' }, noteGroup: { gap: 8 }, note: { minHeight: 60, borderWidth: 1, borderColor: '#d6cec4', borderRadius: 10, padding: 11, color: '#302a25' }, session: { gap: 8, padding: 10, backgroundColor: '#faf7f2', borderRadius: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }, action: { borderWidth: 1, borderColor: '#d6cec4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, selected: { backgroundColor: '#28584E', borderColor: '#28584E' }, chipText: { color: '#302a25' }, selectedText: { color: '#fff', fontWeight: '700' }, warning: { color: '#9a5719', lineHeight: 20 }, done: { color: '#2f7d45' }, fragment: { backgroundColor: '#fff7e9', borderRadius: 12, padding: 12, gap: 8 }, summary: { color: '#302a25', fontWeight: '600' }, footer: { gap: 12, paddingVertical: 18 }, primary: { backgroundColor: '#28584E', padding: 16, borderRadius: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, link: { alignItems: 'center', padding: 10 }, linkText: { color: '#28584E', fontWeight: '600' }, disabled: { opacity: 0.5 }, previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }, previewClose: { position: 'absolute', top: 56, right: 20, zIndex: 1, padding: 12 }, previewCloseText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
