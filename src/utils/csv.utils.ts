import Papa from "papaparse";

export function parseEtradeCsv(csvContent: string): Record<string, string>[] {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        resolve(results.data as Record<string, string>[]);
      },
      error: (error) => {
        reject(new Error(`CSV parse error: ${error.message}`));
      },
    });
  });
}

export function stripCommas(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/,/g, "");
}

export function stripTrailingDagger(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/†/g, "").trim();
}

export function parseFloat_(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = stripCommas(value);
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseEstDateTime(dateTimeStr: string | undefined): Date | null {
  if (!dateTimeStr) return null;

  const trimmed = dateTimeStr.trim().replace(/"/g, "");

  // Format: "MM/DD/YY HH:MM:SS AM/PM EDT" or "MM/DD/YY HH:MM:SS AM/PM EST"
  // We need to convert EST/EDT to UTC
  const match = trimmed.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+(EST|EDT)/i
  );

  if (!match) return null;

  const [, monthStr, dayStr, yearStr, hourStr, minStr, secStr, ampm, tzStr] =
    match;
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const year = 2000 + parseInt(yearStr, 10);
  let hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  const sec = parseInt(secStr, 10);

  // Convert AM/PM
  if (ampm.toUpperCase() === "PM" && hour !== 12) {
    hour += 12;
  } else if (ampm.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  // Create date in local time first
  const estDate = new Date(year, month - 1, day, hour, min, sec);

  // Convert EST/EDT to UTC
  // EST is UTC-5, EDT is UTC-4
  const offsetHours = tzStr.toUpperCase() === "EDT" ? 4 : 5;
  const offsetMs = offsetHours * 60 * 60 * 1000;

  return new Date(estDate.getTime() + offsetMs);
}
