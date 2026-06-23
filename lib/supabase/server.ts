import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient(accessToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing Supabase credentials, using mock client');
    // Return mock client for build time
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: 'mock-user-id' } }, error: null })
      },
      from: (table: string) => {
        const mockQuery = {
          select: (fields: string) => {
            const query = {
              eq: (field: string, value: any) => {
                const query2 = {
                  eq: (field2: string, value2: any) => {
                    return {
                      then: (callback: any) => callback({ data: [], error: null }),
                      catch: (callback: any) => callback(null)
                    };
                  },
                  then: (callback: any) => callback({ data: [], error: null }),
                  catch: (callback: any) => callback(null)
                };
                return query2;
              },
              then: (callback: any) => callback({ data: [], error: null }),
              catch: (callback: any) => callback(null)
            };
            return query;
          },
          insert: (data: any) => Promise.resolve({ data, error: null }),
          update: (data: any) => Promise.resolve({ data, error: null }),
          eq: (field: string, value: any) => ({
            single: () => Promise.resolve({ data: null, error: null })
          })
        };
        return mockQuery;
      }
    };
  }
  
  // When an access token is supplied (e.g. from a bearer Authorization header),
  // attach it so PostgREST/RLS queries run as the authenticated user instead of
  // the anonymous role.
  return createSupabaseClient(
    supabaseUrl,
    supabaseKey,
    accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : undefined,
  );
}
