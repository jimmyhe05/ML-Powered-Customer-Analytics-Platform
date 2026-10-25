// Check uploads by file extension, not only by MIME type.
// Browsers report CSV files inconsistently: Windows machines with Excel
// installed send "application/vnd.ms-excel", and some browsers send an
// empty string, so a strict `file.type === "text/csv"` check rejects valid files.
// The backend still validates the contents.

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const hasExtension = (file, ext) => file?.name?.toLowerCase().endsWith(ext) ?? false;

export const isCsvFile = (file) => Boolean(file) && (hasExtension(file, ".csv") || file.type === "text/csv");

export const isCsvOrXlsxFile = (file) =>
  Boolean(file) && (isCsvFile(file) || hasExtension(file, ".xlsx") || file.type === XLSX_TYPE);
