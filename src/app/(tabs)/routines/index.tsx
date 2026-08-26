import { useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../../lib/AuthContext';
import { fetchRoutinesList, RoutineListItem } from '../../../../lib/routineQueries';

export default function RoutinesListScreen() {
  const { session } = useAuth();
  const userId = (session as { user?: { id?: string } } | null | undefined)?.user?.id;

  const [routines, setRoutines] = useState<RoutineListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      setLoading(true);
      fetchRoutinesList(userId).then((list) => {
        if (active) {
          setRoutines(list);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, [userId])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Routines</Text>
        <Pressable onPress={() => router.push('/(tabs)/routines/new')}>
          <Ionicons name="add-circle" size={28} color="#FF5A3C" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF5A3C" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No routines yet</Text>
              <Text style={styles.emptySubtitle}>Create your first routine to get started.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/(tabs)/routines/[id]', params: { id: item.id } })
              }
            >
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                {item.exerciseCount} {item.exerciseCount === 1 ? 'exercise' : 'exercises'} · {item.lastUsedLabel}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
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
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  card: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 13, color: '#888', marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#888' },
});