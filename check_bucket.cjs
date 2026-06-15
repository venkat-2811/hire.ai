const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://upssvrvshcqwcuyrkehj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwc3N2cnZzaGNxd2N1eXJrZWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE4MTk3NywiZXhwIjoyMDg1NzU3OTc3fQ.AIffXg681MdstholWBLJturcDtycCjgK0aJ88FamNHc'
);

async function list() {
  const { data, error } = await supabase.storage.from('session-screenshots').list('assessment', { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });
  if (error) console.error('Error listing:', error);
  else console.log('Assessment folder:', data);

  const { data: d2, error: e2 } = await supabase.storage.from('session-screenshots').list('ai_interview', { limit: 100 });
  if (e2) console.error('Error listing:', e2);
  else console.log('AI Interview folder:', d2);
}

list();
