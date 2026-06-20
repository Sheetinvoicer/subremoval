import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ruljiaoqscjcvhocqjtq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1bGppYW9xc2NqY3Zob2NxanRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDc3ODgsImV4cCI6MjA5NTI4Mzc4OH0.aZnaX29ps0S_Ju2cNAVQnEeU0E7Ar8TdF86hpWtgfDI'
)

const { data, error } = await supabase.auth.signUp({
  email: 'test-supabase@example.com',
  password: 'Test123456'
})

console.log('Result:', { data, error })
