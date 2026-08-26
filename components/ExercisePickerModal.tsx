import { useState, useEffect } from 'react';
import { Modal, View, TextInput, FlatList, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type Equipment = {
  name: string;
} | null;

type Exercise = {
  id: string;
  name: string;
  equipment: Equipment;
};

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercises: Exercise[]) => void;
};

export default function ExercisePickerModal({ visible, onClose, onSelect }: ExercisePickerModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedExercises, setSelectedExercises] = useState<Map<string, Exercise>>(new Map());

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      search(query);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, visible]);

  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
      setSelectedExercises(new Map());
      setQuery('');
    }
  }, [visible]);

  async function search(text: string) {
    setLoading(true);
    let req = supabase
      .from('exercises')
      .select('id, name, equipment:equipment_id(name)')
      .order('name')
      .limit(30);

    if (text.trim().length > 0) {
      req = req.ilike('name', `%${text.trim()}%`);
    }

    const { data, error } = await req;
    if (error) {
      console.error('Exercise search error:', error.message);
    } else {
      setResults(data as unknown as Exercise[]);
    }
    setLoading(false);
  }

  function toggleSelect(exercise: Exercise) {
    setSelectedIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(exercise.id)) {
        updated.delete(exercise.id);
      } else {
        updated.add(exercise.id);
      }
      return updated;
    });

    setSelectedExercises((prev) => {
      const updated = new Map(prev);
      if (updated.has(exercise.id)) {
        updated.delete(exercise.id);
      } else {
        updated.set(exercise.id, exercise);
      }
      return updated;
    });
  }

  function handleConfirm() {
    onSelect(Array.from(selectedExercises.values()));
  }

  const selectedCount = selectedIds.size;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Exercises</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Search exercises..."
          placeholderTextColor="#777"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: selectedCount > 0 ? 90 : 20 }}
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <Pressable style={styles.item} onPress={() => toggleSelect(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.equipment?.name ?? 'Other'}</Text>
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isSelected ? '#FF5A3C' : '#444'}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            !loading ? <Text style={styles.empty}>No exercises found</Text> : null
          }
        />

        {selectedCount > 0 && (
          <Pressable style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>
              Add {selectedCount} {selectedCount === 1 ? 'Exercise' : 'Exercises'}
            </Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cancel: { fontSize: 16, color: '#FF5A3C' },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  itemMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
  confirmButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#FF5A3C',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#0D0D0D', fontWeight: '800', fontSize: 16 },
});