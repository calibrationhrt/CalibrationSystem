import chokidar from "chokidar";
import * as XLSX from "xlsx";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { type } from "os";

const SUPABASE_URL = "https://zecloiixseojpeqferow.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplY2xvaWl4c2VvanBlcWZlcm93Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1MDUxMywiZXhwIjoyMDkyNDI2NTEzfQ.9m7Z22YbuSscIpCwgtjZwUyLFTISBFASrHxxnfZJjv8";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

function calcExpire(lastDate, interval) {

  if (!lastDate || !interval) return null;

  const date = new Date(lastDate);

  const regex = /(\d+)(d|m|y)/g;
  let match;

  while ((match = regex.exec(interval)) !== null) {

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === "d") date.setDate(date.getDate() + value);
    if (unit === "m") date.setMonth(date.getMonth() + value);
    if (unit === "y") date.setFullYear(date.getFullYear() + value);
  }

  return date.toISOString().split("T")[0];
}

const EXCEL_FILE = "D:\\Plan\\Calibration_Website.xlsx";

async function syncExcel() {
  try {

    console.log("📖 Reading Excel...");

    const file = await fs.promises.readFile(EXCEL_FILE);

    const workbook = XLSX.read(file, {
        type: "buffer",
        cellDates: true
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rawRows = XLSX.utils.sheet_to_json(sheet);

    const rows = rawRows.map(row => {

    const lastDate = row["วันสอบเทียบล่าสุด"];
    const interval = row["รอบสอบเทียบ"];

    return {
        code: row["รหัสเครื่องมือ"] || "",
        name: row["ชื่อเครื่องมือ"] || "",
        type: row["ประเภท"] || "",
        dept: row["แผนก"] || "",
        loc: row["ตำแหน่งที่ตั้ง"] || "",
        owner: row["ผู้รับผิดชอบ"] || "",

        last: lastDate || null,

        interval: interval || "",

        expire: interval
        ? calcExpire(lastDate, interval)
        : null,

        source: row["แหล่งสอบเทียบ"] || "",

        cert: row["เลขที่ใบรับรอง"] || "",

        lab: row["ห้องปฏิบัติการ"] || "",

        status: row["สถานะ"] || "Active"
    };

    });
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
