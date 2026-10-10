import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose(): void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const insets = React.useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  if (!visible) return null;
  return <Modal testID="bottom-sheet-modal" visible transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView testID="bottom-sheet-keyboard" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel={`关闭${title}面板`} style={styles.dismiss} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`关闭${title}`} onPress={onClose} hitSlop={8}>
            <Text style={[styles.close, { color: theme.primary }]}>关闭</Text>
          </Pressable>
        </View>
        <ScrollView testID="bottom-sheet-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.28)' },
  dismiss: { ...StyleSheet.absoluteFill },
  sheet: { width: '100%', maxHeight: '82%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  close: { fontSize: 15, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
});
