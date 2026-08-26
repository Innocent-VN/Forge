import { supabase } from './supabase';

export type RoutineListItem = {
  id: string;
  name: string;
  exerciseCount: number;
  lastUsedLabel: string;
};

export type RoutineExerciseItem = {
  id: string;
  exerciseId: string;
  name: string;
  equipmentName: string;
};

export type RoutineDetail = {
  id: string;
  name: string;
  exercises: RoutineExerciseItem[];
};

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export async function fetchRoutinesList(userId: string): Promise<RoutineListItem[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('id, name, created_at, routine_exercises(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Error fetching routines:', error?.message);
    return [];
  }

  const routines = data as any[];

  const withLastUsed = await Promise.all(
    routines.map(async (r) => {
      const { data: lastWorkout } = await supabase
        .from('workouts')
        .select('finished_at')
        .eq('routine_id', r.id)
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(1);

      const lastUsedLabel =
        lastWorkout && lastWorkout.length > 0
          ? `Last used ${formatRelativeDate((lastWorkout[0] as any).finished_at)}`
          : 'Not used yet';

      return {
        id: r.id,
        name: r.name,
        exerciseCount: r.routine_exercises?.[0]?.count ?? 0,
        lastUsedLabel,
      };
    })
  );

  return withLastUsed;
}

export async function fetchRoutineDetail(routineId: string): Promise<RoutineDetail | null> {
  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .select('id, name')
    .eq('id', routineId)
    .single();

  if (routineError || !routine) {
    console.error('Error fetching routine:', routineError?.message);
    return null;
  }

  const { data: exerciseRows, error: exError } = await supabase
    .from('routine_exercises')
    .select('id, position, exercise_id, exercises(name, equipment:equipment_id(name))')
    .eq('routine_id', routineId)
    .order('position');

  if (exError) {
    console.error('Error fetching routine exercises:', exError.message);
    return { id: routine.id, name: routine.name, exercises: [] };
  }

  const exercises: RoutineExerciseItem[] = (exerciseRows as any[]).map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    name: row.exercises?.name ?? 'Unknown Exercise',
    equipmentName: row.exercises?.equipment?.name ?? 'Other',
  }));

  return { id: routine.id, name: routine.name, exercises };
}

export async function createRoutine(
  userId: string,
  name: string,
  exerciseIds: string[]
): Promise<string | null> {
  const { data: routine, error } = await supabase
    .from('routines')
    .insert({ user_id: userId, name })
    .select('id')
    .single();

  if (error || !routine) {
    console.error('Error creating routine:', error?.message);
    return null;
  }

  if (exerciseIds.length > 0) {
    const rows = exerciseIds.map((exerciseId, index) => ({
      routine_id: routine.id,
      exercise_id: exerciseId,
      position: index,
    }));

    const { error: insertError } = await supabase.from('routine_exercises').insert(rows);
    if (insertError) {
      console.error('Error adding routine exercises:', insertError.message);
    }
  }

  return routine.id;
}

export async function updateRoutine(
  routineId: string,
  name: string,
  exerciseIds: string[]
): Promise<boolean> {
  const { error: nameError } = await supabase
    .from('routines')
    .update({ name })
    .eq('id', routineId);

  if (nameError) {
    console.error('Error updating routine name:', nameError.message);
    return false;
  }

  const { error: deleteError } = await supabase
    .from('routine_exercises')
    .delete()
    .eq('routine_id', routineId);

  if (deleteError) {
    console.error('Error clearing routine exercises:', deleteError.message);
    return false;
  }

  if (exerciseIds.length > 0) {
    const rows = exerciseIds.map((exerciseId, index) => ({
      routine_id: routineId,
      exercise_id: exerciseId,
      position: index,
    }));

    const { error: insertError } = await supabase.from('routine_exercises').insert(rows);
    if (insertError) {
      console.error('Error re-adding routine exercises:', insertError.message);
      return false;
    }
  }

  return true;
}

export async function deleteRoutine(routineId: string): Promise<boolean> {
  const { error } = await supabase.from('routines').delete().eq('id', routineId);
  if (error) {
    console.error('Error deleting routine:', error.message);
    return false;
  }
  return true;
}