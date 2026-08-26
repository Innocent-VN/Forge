import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ExercisePickerModal from '../../../components/ExercisePickerModal';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/AuthContext';
import { pickRandomQuote } from '../../../lib/quotes';

type SetEntry = {
  id: string;
  reps: string;
  weight: string;
  rpe: string;
};

type PreviousSet = {
  weight: string;
  reps: string;
};

type WorkoutExercise = {
  id: string;
  exerciseId: string;
  name: string;
  equipmentName: string;
  sets: SetEntry[];
  previous: PreviousSet[];
};

type PickedExercise = {
  id: string;
  name: string;
  equipment?: { name: string } | null;
};

type RecentWorkoutSummary = {
  id: string;
  label: string;
  dateLabel: string;
  finishedAtRaw: string;
  durationMinutes: number;
  exerciseCount: number;
};

function makeDefaultSet(): SetEntry {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2), reps: '', weight: '', rpe: '' };
}

async function fetchPreviousSets(exerciseId: string, userId: string): Promise<PreviousSet[]> {
  const { data, error } = await supabase
    .from('sets')
    .select('reps, weight, created_at, workout_id, workouts!inner(user_id, finished_at)')
    .eq('exercise_id', exerciseId)
    .eq('workouts.user_id', userId)
    .not('workouts.finished_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) return [];

  const mostRecentWorkoutId = (data[0] as any).workout_id;
  const sameWorkoutSets = (data as any[])
    .filter((s) => s.workout_id === mostRecentWorkoutId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return sameWorkoutSets.map((s) => ({
    weight: s.weight !== null && s.weight !== undefined ? String(s.weight) : '-',
    reps: s.reps !== null && s.reps !== undefined ? String(s.reps) : '-',
  }));
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

async function fetchRecentWorkout(userId: string): Promise<RecentWorkoutSummary | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, started_at, finished_at')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const workout = data[0] as any;

  const { data: setRows } = await supabase
    .from('sets')
    .select('exercise_id')
    .eq('workout_id', workout.id);

  const exerciseCount = new Set((setRows ?? []).map((s: any) => s.exercise_id)).size;
  const startMs = new Date(workout.started_at).getTime();
  const finishMs = new Date(workout.finished_at).getTime();
  const durationMinutes = Math.max(1, Math.round((finishMs - startMs) / 60000));

  return {
    id: workout.id,
    label: 'Workout',
    dateLabel: formatRelativeDate(workout.finished_at),
    finishedAtRaw: workout.finished_at,
    durationMinutes,
    exerciseCount,
  };
}

export default function HomeScreen() {
  const session = useAuth().session as { user?: { id?: string } } | null | undefined;
  const userId = session?.user?.id;

  const [stage, setStage] = useState<'idle' | 'building' | 'active'>('idle');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [quote] = useState(() => pickRandomQuote());
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [trainedToday, setTrainedToday] = useState(false);
  const [recentWorkout, setRecentWorkout] = useState<RecentWorkoutSummary | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    if (!userId || stage !== 'idle') return;
    setLoadingRecent(true);
    fetchRecentWorkout(userId).then((summary) => {
      setRecentWorkout(summary);
      setTrainedToday(summary ? isToday(summary.finishedAtRaw) : false);
      setLoadingRecent(false);
    });
  }, [userId, stage]);

  async function buildWorkoutExercise(exercise: PickedExercise): Promise<WorkoutExercise> {
    const previous = userId ? await fetchPreviousSets(exercise.id, userId) : [];
    return {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      exerciseId: exercise.id,
      name: exercise.name,
      equipmentName: exercise.equipment?.name ?? 'Other',
      sets: [makeDefaultSet()],
      previous,
    };
  }

  function beginBuilding() {
    setStage('building');
    setExercises([]);
  }

  function openPickerForAdd() {
    setReplacingExerciseId(null);
    setPickerVisible(true);
  }

  function openPickerForReplace(exerciseId: string) {
    setReplacingExerciseId(exerciseId);
    setPickerVisible(true);
  }

  async function handlePickerSelect(picked: PickedExercise[]) {
    if (replacingExerciseId !== null) {
      const replacement = picked[0];
      if (replacement) {
        const newExercise = await buildWorkoutExercise(replacement);
        setExercises((prev) =>
          prev.map((e) => (e.id === replacingExerciseId ? newExercise : e))
        );
      }
    } else {
      const newExercises = await Promise.all(picked.map(buildWorkoutExercise));
      setExercises((prev) => [...prev, ...newExercises]);
    }
    setPickerVisible(false);
    setReplacingExerciseId(null);
  }

  function removeExercise(exerciseId: string) {
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  }

  function addSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, sets: [...e.sets, makeDefaultSet()] } : e))
    );
  }

  function updateSet(exerciseId: string, setId: string, field: keyof SetEntry, value: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id !== exerciseId
          ? e
          : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)) }
      )
    );
  }

  function removeSet(exerciseId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id !== exerciseId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) }
      )
    );
  }

  function startWorkout() {
    setStartedAt(Date.now());
    setStage('active');
  }

  function cancelAll() {
    setStage('idle');
    setExercises([]);
    setStartedAt(null);
  }

  if (stage === 'idle') {
    return (
      <View style={styles.homeContainer}>
        <Text style={styles.appTitle}>Forge</Text>
        <Text style={styles.quote}>{quote}</Text>

        <Text style={styles.statusTitle}>
          {trainedToday ? 'Workout Complete' : 'Ready to Forge?'}
        </Text>

        <Pressable style={styles.startButton} onPress={() => setStartModalVisible(true)}>
          <Ionicons name="barbell" size={22} color="#0D0D0D" style={{ marginRight: 8 }} />
          <Text style={styles.startButtonText}>Start Workout</Text>
        </Pressable>

        <View style={styles.recentSection}>
          <Text style={styles.recentHeader}>Recent Activity</Text>
          {loadingRecent ? (
            <Text style={styles.recentEmpty}>Loading...</Text>
          ) : recentWorkout ? (
            <View style={styles.recentCard}>
              <Text style={styles.recentLabel}>{recentWorkout.label}</Text>
              <Text style={styles.recentDate}>{recentWorkout.dateLabel}</Text>
              <Text style={styles.recentMeta}>
                {recentWorkout.durationMinutes} min · {recentWorkout.exerciseCount} exercises
              </Text>
            </View>
          ) : (
            <Text style={styles.recentEmpty}>No workouts logged yet.</Text>
          )}
        </View>

        <Modal
          visible={startModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setStartModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setStartModalVisible(false)}>
            <View style={styles.modalSheet}>
              <Pressable
                style={styles.modalOption}
                onPress={() => {
                  setStartModalVisible(false);
                  beginBuilding();
                }}
              >
                <Ionicons name="add-circle" size={20} color="#FF5A3C" />
                <Text style={styles.modalOptionText}>Start Empty Workout</Text>
              </Pressable>
              <Pressable
                style={styles.modalOption}
                onPress={() => {
                  setStartModalVisible(false);
                  router.push('/(tabs)/routines');
                }}
              >
                <Ionicons name="list" size={20} color="#FF5A3C" />
                <Text style={styles.modalOptionText}>Start From Routine</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  function renderExerciseItem({ item, drag, isActive }: RenderItemParams<WorkoutExercise>) {
    return (
      <ScaleDecorator>
        <View style={[styles.exerciseCard, isActive && { opacity: 0.85 }]}>
          <View style={styles.exerciseCardHeader}>
            <Pressable onLongPress={drag} style={styles.dragHandle}>
              <Ionicons name="reorder-three" size={22} color="#666" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{item.name}</Text>
              <Text style={styles.exerciseMeta}>{item.equipmentName}</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Pressable style={styles.iconButton} onPress={() => openPickerForReplace(item.id)}>
                <Ionicons name="swap-horizontal" size={20} color="#888" />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => removeExercise(item.id)}>
                <Ionicons name="trash" size={20} color="#888" />
              </Pressable>
            </View>
          </View>

          {item.sets.length > 0 && (
            <View style={styles.setHeaderRow}>
              <Text style={[styles.setHeaderText, { flex: 0.5 }]}>Set</Text>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>Prev</Text>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>Weight</Text>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>Reps</Text>
              <Text style={[styles.setHeaderText, { flex: 1 }]}>RPE</Text>
              <View style={{ width: 28 }} />
            </View>
          )}

          {item.sets.map((set, setIndex) => {
            const prev = item.previous[setIndex];
            const prevLabel = prev ? `${prev.weight}X${prev.reps}` : '-';
            return (
              <View key={set.id} style={styles.setRow}>
                <Text style={[styles.setNumber, { flex: 0.5 }]}>{setIndex + 1}</Text>
                <Text style={[styles.prevText, { flex: 1 }]}>{prevLabel}</Text>
                <TextInput
                  style={[styles.setInput, { flex: 1 }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#555"
                  value={set.weight}
                  onChangeText={(v) => updateSet(item.id, set.id, 'weight', v)}
                />
                <TextInput
                  style={[styles.setInput, { flex: 1 }]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#555"
                  value={set.reps}
                  onChangeText={(v) => updateSet(item.id, set.id, 'reps', v)}
                />
                <TextInput
                  style={[styles.setInput, { flex: 1 }]}
                  keyboardType="numeric"
                  placeholder="-"
                  placeholderTextColor="#555"
                  value={set.rpe}
                  onChangeText={(v) => updateSet(item.id, set.id, 'rpe', v)}
                />
                <Pressable style={{ width: 28, alignItems: 'center' }} onPress={() => removeSet(item.id, set.id)}>
                  <Ionicons name="close-circle" size={20} color="#555" />
                </Pressable>
              </View>
            );
          })}

          <Pressable style={styles.addSetButton} onPress={() => addSet(item.id)}>
            <Ionicons name="add" size={18} color="#FF5A3C" />
            <Text style={styles.addSetText}>Add Set</Text>
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{stage === 'building' ? 'Build Workout' : 'Current Workout'}</Text>
        <Pressable onPress={cancelAll}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </Pressable>
      </View>

      <DraggableFlatList
        data={exercises}
        onDragEnd={({ data }) => setExercises(data)}
        keyExtractor={(item) => item.id}
        renderItem={renderExerciseItem}
        contentContainerStyle={{ paddingBottom: 200, paddingHorizontal: 16 }}
        ListEmptyComponent={<Text style={styles.hint}>Add your first exercise to get started.</Text>}
        ListFooterComponent={
          <Pressable style={styles.addExerciseButton} onPress={openPickerForAdd}>
            <Ionicons name="add-circle" size={20} color="#0D0D0D" />
            <Text style={styles.addExerciseText}>Add Exercise{stage === 'active' ? '' : 's'}</Text>
          </Pressable>
        }
      />

      {stage === 'building' && exercises.length > 0 && (
        <Pressable style={styles.finishButton} onPress={startWorkout}>
          <Text style={styles.finishButtonText}>Start Workout</Text>
        </Pressable>
      )}

      {stage === 'active' && (
        <Pressable style={styles.finishButton} onPress={() => { /* Step: save to Supabase */ }}>
          <Text style={styles.finishButtonText}>Finish Workout</Text>
        </Pressable>
      )}

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => { setPickerVisible(false); setReplacingExerciseId(null); }}
        onSelect={handlePickerSelect}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  homeContainer: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 70, paddingHorizontal: 24 },
  appTitle: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  quote: { fontSize: 14, color: '#888', marginTop: 10, marginBottom: 28, fontStyle: 'italic' },
  statusTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#FF5A3C',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: { fontSize: 17, fontWeight: '700', color: '#0D0D0D' },
  recentSection: { marginTop: 40 },
  recentHeader: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', marginBottom: 10 },
  recentCard: { backgroundColor: '#161616', borderRadius: 16, padding: 16 },
  recentLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  recentDate: { fontSize: 13, color: '#999', marginTop: 2 },
  recentMeta: { fontSize: 13, color: '#888', marginTop: 6 },
  recentEmpty: { color: '#555', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  modalOptionText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  cancelLink: { fontSize: 15, color: '#888' },
  hint: { color: '#666', textAlign: 'center', marginTop: 40 },
  exerciseCard: {
    backgroundColor: '#161616',
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
  },
  exerciseCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dragHandle: { paddingRight: 10 },
  iconButton: { paddingHorizontal: 6 },
  exerciseName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  exerciseMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  setHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  setHeaderText: { fontSize: 11, color: '#666', fontWeight: '600', textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  setNumber: { color: '#aaa', fontWeight: '600' },
  prevText: { color: '#666', fontSize: 13, textAlign: 'center' },
  setInput: {
    backgroundColor: '#222',
    borderRadius: 8,
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 8,
    marginRight: 6,
  },
  addSetButton: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addSetText: { color: '#FF5A3C', fontWeight: '600', marginLeft: 4 },
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
  finishButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#FF5A3C',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  finishButtonText: { color: '#0D0D0D', fontWeight: '800', fontSize: 16 },
});