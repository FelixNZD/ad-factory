import { createClient } from '@supabase/supabase-js';

// These should be replaced with your actual Supabase project credentials
// You can get these from your Supabase dashboard (Settings > API)
// For MVP, we'll try to load from env vars or use placeholders
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/**
 * SQL for Supabase Table:
 * 
 * create table generations (
 *   id uuid default uuid_generate_v4() primary key,
 *   timestamp text not null,
 *   videoUrl text not null,
 *   imageUrl text,
 *   script text,
 *   presetName text,
 *   aspectRatio text,
 *   gender text,
 *   created_by text,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- Enable RLS
 * alter table generations enable row level security;
 * 
 * -- Create policy for public access (Admin MVP)
 * create policy "Public Access" on generations for all using (true);
 */

export const getGenerations = async () => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('generations')
        .select('*')
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching generations:', error);
        return [];
    }
    return data;
};

export const saveGeneration = async (generation, userEmail) => {
    if (!supabase) return;

    const { error } = await supabase
        .from('generations')
        .insert([{ ...generation, created_by: userEmail }]);

    if (error) {
        console.error('Error saving generation:', error);
    }
};

export const deleteGeneration = async (timestamp) => {
    if (!supabase) return;

    const { error } = await supabase
        .from('generations')
        .delete()
        .eq('timestamp', timestamp);

    if (error) {
        console.error('Error deleting generation:', error);
    }
};
