import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ExercisePickerModal from '../../../../components/ExercisePickerModal';
import { useAuth } from '../../../../lib/AuthContext';
import { createRoutine } from '../../../../lib/routineQueries';

type DraftExercise = {
  id: string;
  exerciseId: string;
  name: string;
  equipmentName: string;
};

type PickedExercise = {
  id: string;
  name: string;
  equipment?: { name: string } | null;
};

export default function NewRoutineScreen() {
  const { session } = useAuth();
  const sessionData = session as { user?: { id?: string } } | null | undefined;
  const userId = sessionData?.user?.id;

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  function handlePickerSelect(picked: PickedExercise[]) {
    const mapped: DraftExercise[] = picked.map((p) => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      exerciseId: p.id,
      name: p.name,
      equipmentName: p.equipment?.name ?? 'Other',
    }));
    setExercises((prev) => [...prev, ...mapped]);
    setPickerVisible(false);
  }

  function removeExercise(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleSave() {
    if (!userId) return;
    if (name.trim().length === 0) {
      Alert.alert('Name required', 'Give your routine a name before saving.');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Add exercises', 'Add at least one exercise to your routine.');
      return;
    }

    setSaving(true);
    const routineId = await createRoutine(
      userId,
      name.trim(),
      exercises.map((e) => e.exerciseId)
    );
    setSaving(false);

    if (!routineId) {
      Alert.alert('Error', 'Could not save routine. Please try again.');
      return;
    }

    router.back();
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<DraftExercise>) {
    return (
      <ScaleDecorator>
        <View style={[styles.exerciseRow, isActive && { opacity: 0.85 }]}>
          <Pressable onLongPress={drag} style={styles.dragHandle}>
            <Ionicons name="reorder-three" size={22} color="#666" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName}>{item.name}</Text>
            <Text style={styles.exerciseMeta}>{item.equipmentName}</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => removeExercise(item.id)}>
            <Ionicons name="trash" size={20} color="#888" />
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Routine</Text>
        <Pressable onPress={handleSave} disabled={saving}>
          <Text style={styles.saveLink}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.nameInput}
        placeholder="Routine name (e.g. Push Day)"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />

      <DraggableFlatList
        data={exercises}
        onDragEnd={({ data }) => setExercises(data)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.hint}>No exercises added yet.</Text>}
        ListFooterComponent={
          <Pressable style={styles.addExerciseButton} onPress={() => setPickerVisible(true)}>
            <Ionicons name="add-circle" size={20} color="#0D0D0D" />
            <Text style={styles.addExerciseText}>Add Exercises</Text>
          </Pressable>
        }
      />

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handlePickerSelect}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  cancelLink: { fontSize: 15, color: '#888' },
  saveLink: { fontSize: 15, color: '#FF5A3C', fontWeight: '700' },
  nameInput: {
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  hint: { color: '#666', textAlign: 'center', marginTop: 40 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  dragHandle: { paddingRight: 10 },
  iconButton: { paddingHorizontal: 6 },
  exerciseName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  exerciseMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  addExerciseButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseText: { color: '#0D0D0D', fontWeight: '700', marginLeft: 6 },
});