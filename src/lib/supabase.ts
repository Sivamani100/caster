import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uncnspkxfpwgsfcjwtmn.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuY25zcGt4ZnB3Z3NmY2p3dG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MzczODUsImV4cCI6MjExMDQxMzM4NX0.Rwew5C3GEIYEC4lYeYwmUmSGATqibM-3ZeiuCddwoig'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
})
