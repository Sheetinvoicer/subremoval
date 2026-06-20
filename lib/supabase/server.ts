import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createClient() {
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
  
  return createSupabaseClient(supabaseUrl, supabaseKey);
}
