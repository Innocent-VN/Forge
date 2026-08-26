import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ExercisePickerModal from '../../../../components/ExercisePickerModal';
import { fetchRoutineDetail, updateRoutine, deleteRoutine, RoutineExerciseItem } from '../../../../lib/routineQueries';

type PickedExercise = {
  id: string;
  name: string;
  equipment?: { name: string } | null;
};

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<RoutineExerciseItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchRoutineDetail(id).then((detail) => {
      if (detail) {
        setName(detail.name);
        setExercises(detail.exercises);
      }
      setLoading(false);
    });
  }, [id]);

  function handlePickerSelect(picked: PickedExercise[]) {
    const mapped: RoutineExerciseItem[] = picked.map((p) => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      exerciseId: p.id,
      name: p.name,
      equipmentName: p.equipment?.name ?? 'Other',
    }));
    setExercises((prev) => [...prev, ...mapped]);
    setPickerVisible(false);
  }

  function removeExercise(rowId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== rowId));
  }

  async function handleSave() {
    if (!id) return;
    if (name.trim().length === 0) {
      Alert.alert('Name required', 'Give your routine a name before saving.');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Add exercises', 'A routine needs at least one exercise.');
      return;
    }

    setSaving(true);
    const success = await updateRoutine(
      id,
      name.trim(),
      exercises.map((e) => e.exerciseId)
    );
    setSaving(false);

    if (!success) {
      Alert.alert('Error', 'Could not save changes. Please try again.');
      return;
    }

    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete Routine', `Are you sure you want to delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const success = await deleteRoutine(id);
          if (success) {
            router.back();
          } else {
            Alert.alert('Error', 'Could not delete routine. Please try again.');
          }
        },
      },
    ]);
  }

  function handleStartWorkout() {
    if (!id) return;
    router.push({ pathname: '/(tabs)/home', params: { routineId: id } });
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5A3C" />
      </View>
    );
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<RoutineExerciseItem>) {
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
          <Text style={styles.cancelLink}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Routine</Text>
        <Pressable onPress={handleSave} disabled={saving}>
          <Text style={styles.saveLink}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.nameInput}
        placeholder="Routine name"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />

      <Pressable style={styles.startWorkoutButton} onPress={handleStartWorkout}>
        <Ionicons name="barbell" size={18} color="#0D0D0D" style={{ marginRight: 6 }} />
        <Text style={styles.startWorkoutText}>Start Workout From This Routine</Text>
      </Pressable>

      <DraggableFlatList
        data={exercises}
        onDragEnd={({ data }) => setExercises(data)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, paddingTop: 10 }}
        ListEmptyComponent={<Text style={styles.hint}>No exercises in this routine yet.</Text>}
        ListFooterComponent={
          <>
            <Pressable style={styles.addExerciseButton} onPress={() => setPickerVisible(true)}>
              <Ionicons name="add-circle" size={20} color="#0D0D0D" />
              <Text style={styles.addExerciseText}>Add Exercises</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete Routine</Text>
            </Pressable>
          </>
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
  loadingContainer: { flex: 1, backgroundColor: '#0D0D0D', justifyContent: 'center', alignItems: 'center' },
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
    marginBottom: 12,
  },
  startWorkoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FF5A3C',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWorkoutText: { color: '#0D0D0D', fontWeight: '700', fontSize: 14 },
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
  deleteButton: {
    marginTop: 20,
    padding: 14,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#FF4444', fontWeight: '600', fontSize: 15 },
});