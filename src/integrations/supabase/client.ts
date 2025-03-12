
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://yhgjyuwnforkuskplebv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZ2p5dXduZm9ya3Vza3BsZWJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2MDAyNTksImV4cCI6MjA1NzE3NjI1OX0.juMDTicqz-3d4GPHzdiLR2GWsRKQzteOXHDYRTGSIsk";

// Create a Supabase client with the URL and anon key
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// Log when client is initialized
console.log("Supabase client initialized with project URL:", SUPABASE_URL);
