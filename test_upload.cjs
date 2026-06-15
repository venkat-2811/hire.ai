const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://upssvrvshcqwcuyrkehj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc3N2cnZzaGNxd2N1eXJrZWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODE5NzcsImV4cCI6MjA4NTc1Nzk3N30.Z5nQ_A-iCstBhhbX_lOa8XvQ7-v90_xK7d1Jp3x53iI' // Anon key, but let me get the real one from .env
);

async function testUpload() {
  const fileContent = 'dummy data';
  const { data, error } = await supabase.storage
    .from('session-screenshots')
    .upload('assessment/test_session/latest.jpg', fileContent, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    
  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('Upload successful:', data);
  }
}

testUpload();
