
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Retrieve Gemini API key from environment
  const apiKey = env.API_KEY || env.VITE_GOOGLE_API_KEY || (process as any).env.API_KEY || (process as any).env.VITE_GOOGLE_API_KEY || '';

  // Use provided Supabase credentials as hardcoded defaults for this specific setup
  const supabaseUrl = env.VITE_SUPABASE_URL || (process as any).env.VITE_SUPABASE_URL || 'https://rucwfhprvsvbytijwzya.supabase.co';
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || (process as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y3dmaHByc3ZieXRpand6eWEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwODU1MDc5MCwiZXhwIjoxODY2MzE3MTkwfQ.F_2Km0bVkkfjq0p5n5kFf5lU5rGR2nVYKK3kXqBxJGk';

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
    },
    define: {
      // Provide Gemini API key to the client
      'process.env.API_KEY': JSON.stringify(apiKey),
      
      // Define Supabase environment variables for the client side. 
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
      
      'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey)
    }
  };
});
