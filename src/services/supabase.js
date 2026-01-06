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
 * Hardcoded Workspaces for MVP
 * In future, this would come from a workspaces table
 */
export const WORKSPACES = {
    'axe-revenue': {
        id: 'axe-revenue',
        name: 'Axe Revenue',
        members: ['jack@axerevenue.com', 'felix@axerevenue.com']
    }
};

/**
 * Get the workspace for a given user email
 */
export const getUserWorkspace = (userEmail) => {
    for (const [id, workspace] of Object.entries(WORKSPACES)) {
        if (workspace.members.includes(userEmail?.toLowerCase())) {
            return workspace;
        }
    }
    return null;
};

/**
 * SQL for Supabase Tables:
 * 
 * -- Batches table (NEW)
 * create table batches (
 *   id uuid default uuid_generate_v4() primary key,
 *   name text not null,
 *   image_url text,
 *   aspect_ratio text,
 *   gender text,
 *   workspace_id text default 'axe-revenue',
 *   created_by text not null,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * alter table batches enable row level security;
 * create policy "Public Access" on batches for all using (true);
 * 
 * -- Generations table (updated with batch_id)
 * create table generations (
 *   id uuid default uuid_generate_v4() primary key,
 *   timestamp text not null,
 *   videoUrl text not null,
 *   imageUrl text,
 *   script text,
 *   presetName text,
 *   aspectRatio text,
 *   gender text,
 *   batch_id uuid references batches(id),
 *   created_by text,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * alter table generations enable row level security;
 * create policy "Public Access" on generations for all using (true);
 */

// ============ BATCH FUNCTIONS ============

export const createBatch = async (batchData, userEmail) => {
    if (!supabase) {
        // Return a local batch ID for offline mode
        return { id: `local-${Date.now()}`, ...batchData };
    }

    const { data, error } = await supabase
        .from('batches')
        .insert([{
            name: batchData.name,
            image_url: batchData.imageUrl,
            aspect_ratio: batchData.aspectRatio,
            gender: batchData.gender,
            workspace_id: batchData.workspaceId || 'axe-revenue',
            created_by: userEmail
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating batch:', error);
        return null;
    }
    return data;
};

export const getBatches = async (workspaceId = null) => {
    if (!supabase) return [];

    let query = supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });

    if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching batches:', error);
        return [];
    }
    return data;
};

export const getBatchClips = async (batchId) => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('batch_id', batchId)
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Error fetching batch clips:', error);
        return [];
    }
    return data;
};

export const deleteBatch = async (batchId) => {
    if (!supabase) return;

    // First delete all clips in the batch
    await supabase
        .from('generations')
        .delete()
        .eq('batch_id', batchId);

    // Then delete the batch
    const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId);

    if (error) {
        console.error('Error deleting batch:', error);
    }
};

// ============ GENERATION FUNCTIONS ============

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

export const getLegacyGenerations = async () => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('generations')
        .select('*')
        .is('batch_id', null)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching legacy generations:', error);
        return [];
    }
    return data;
};

export const saveGeneration = async (generation, userEmail, batchId = null) => {
    if (!supabase) return;

    const { error } = await supabase
        .from('generations')
        .insert([{
            ...generation,
            created_by: userEmail,
            batch_id: batchId
        }]);

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

// ============ WORKSPACE FUNCTIONS ============

export const getWorkspaceBatches = async (workspaceId) => {
    if (!supabase) return [];

    const workspace = WORKSPACES[workspaceId];
    if (!workspace) return [];

    const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching workspace batches:', error);
        return [];
    }
    return data;
};

export const getWorkspaceGenerations = async (workspaceId) => {
    if (!supabase) return [];

    const workspace = WORKSPACES[workspaceId];
    if (!workspace) return [];

    // Get all generations from workspace members
    const { data, error } = await supabase
        .from('generations')
        .select('*')
        .in('created_by', workspace.members)
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('Error fetching workspace generations:', error);
        return [];
    }
    return data;
};
