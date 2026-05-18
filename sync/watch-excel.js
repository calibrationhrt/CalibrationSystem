import chokidar from "chokidar";
import * as XLSX from "xlsx";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

XLSX.set_fs(fs);

const SUPABASE_URL = "https://zecloiixseojpeqferow.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY2xvaWl4c2VvanBlcWZlcm93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1MDUxMywiZXhwIjoyMDkyNDI2NTEzfQ.9m7Z22YbuSscIpCwgtjZwUyLFTISBFASrHxxnfZJjv8";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const EXCEL_FILE = "D:\\Plan\\Calibration_Website.xlsx";

async function syncExcel() {
  try {

    console.log("📖 Reading Excel...");

    const workbook = XLSX.readFile(EXCEL_FILE, {
        cellDates: true
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(rows.slice(0,3));

    console.log(`📦 ${rows.length} rows`);

    const { error } = await supabase
      .from("tools")
      .upsert(rows, {
        onConflict: "code"
      });

    if (error) {
      console.error("❌ Supabase Error:", error);
    } else {
      console.log("✅ Sync Success");
    }

  } catch (err) {
    console.error(err);
  }
}

let timeout;

chokidar.watch(EXCEL_FILE, {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 3000,
    pollInterval: 100
  }
})
.on("all", async (event, path) => {

  console.log("📁 Event:", event);

  clearTimeout(timeout);

  timeout = setTimeout(async () => {

    console.log("📝 Syncing Excel...");

    await syncExcel();

  }, 3000);

});

console.log("👀 Watching Excel...");
