/**
 * End-to-end debug script.
 * Run: node debug_screenshot.cjs
 * 
 * This checks:
 * 1. What files exist in the bucket
 * 2. That we can load the public URL for each file
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://upssvrvshcqwcuyrkehj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc3N2cnZzaGNxd2N1eXJrZWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE4MTk3NywiZXhwIjoyMDg1NzU3OTc3fQ.AIffXg681MdstholWBLJturcDtycCjgK0aJ88FamNHc';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debug() {
  console.log('=== Screenshot Bucket Debug ===\n');

  // 1. List all files in assessment/ folder
  const { data: assessmentFiles, error: ae } = await supabase.storage
    .from('session-screenshots')
    .list('assessment', { limit: 50 });

  if (ae) {
    console.log('Error listing assessment/:', ae.message);
  } else {
    console.log('assessment/ folder contents:');
    console.log(JSON.stringify(assessmentFiles, null, 2));
    
    // For each session folder, check if latest.jpg exists
    for (const folder of (assessmentFiles || [])) {
      if (folder.name && !folder.name.includes('.')) {
        const { data: files } = await supabase.storage
          .from('session-screenshots')
          .list(`assessment/${folder.name}`);
        
        const path = `assessment/${folder.name}/latest.jpg`;
        const { data: urlData } = supabase.storage
          .from('session-screenshots')
          .getPublicUrl(path);
        
        console.log(`\nSession: ${folder.name}`);
        console.log(`  Files:`, files?.map(f => f.name));
        console.log(`  Public URL: ${urlData.publicUrl}`);
        
        // Test if URL is accessible
        const https = require('https');
        const http = require('http');
        const mod = urlData.publicUrl.startsWith('https') ? https : http;
        await new Promise((resolve) => {
          mod.get(urlData.publicUrl, (res) => {
            console.log(`  URL Status: ${res.statusCode} ${res.statusMessage}`);
            resolve();
          }).on('error', (e) => {
            console.log(`  URL Error: ${e.message}`);
            resolve();
          });
        });
      }
    }
  }

  // 2. List all files in ai_interview/ folder
  const { data: interviewFiles, error: ie } = await supabase.storage
    .from('session-screenshots')
    .list('ai_interview', { limit: 50 });

  if (ie) {
    console.log('\nError listing ai_interview/:', ie.message);
  } else {
    console.log('\nai_interview/ folder contents:');
    console.log(JSON.stringify(interviewFiles, null, 2));
  }
}

debug().catch(console.error);
