/* ── API: Supabase client & data loaders ── */
const SUPABASE_URL = "https://zecloiixseojpeqferow.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY2xvaWl4c2VvanBlcWZlcm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTA1MTMsImV4cCI6MjA5MjQyNjUxM30.NHfJbNeAN8RMQCw4_Z6Ep_Qwi3VUoZ6gtyGD5wXQQzU";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadTools() {
  const { data, error } = await client
    .from('tools')
    .select('*');

  if (error) {
    console.error('❌ โหลด tools ไม่ได้:', error);
    return;
  }

  tools = data;
  console.log('✅ tools from DB:', tools);
}

async function loadDepartments() {
  const { data, error } = await client
    .from('departments')
    .select('*')
    .order('id');

  if (error) {
    console.error('loadDepartments error:', error);
    departments = [];
    return;
  }

  departments = data ?? [];
  if (typeof populateDeptDropdowns === 'function') {
    populateDeptDropdowns();
  }
}

async function loadTypes() {
  const { data, error } = await client.from('types').select('*').order('id');
  if (error) { console.error(error); return; }
  types = data ?? [];
  populateTypeDropdowns();
}

async function loadLocations() {
  const { data, error } = await client.from('locations').select('*').order('id');
  if (error) { console.error(error); return; }
  locations = data ?? [];
  populateLocDropdowns();
}