const SUPPLIERS_JSON = "./suppliers.json";
const TEMPLATE_PDF = "./2307_Jan_2018_ENCS_v3_original.pdf";

const PAYOR = {
  tin: "619-447-904-00000",
  name: "PIXELENS CREATIVE ADVERTISING INC.",
  address: "G8-4 2ND FLOOR GEMS PLAZA CIRCUMFERENTIAL ROAD SAN JOSE, ANTIPOLO CITY",
  zip: "1870",
  signatory: "ARWIN EDWARD M. BAGASLAO - CHIEF FINANCIAL OFFICER"
};

let suppliers = [];
let selectedSupplier = null;
let currentPreview = null;

const supplierInput = document.getElementById("supplierInput");
const yearInput = document.getElementById("yearInput");
const monthInput = document.getElementById("monthInput");
const amountInput = document.getElementById("amountInput");
const zipInput = document.getElementById("zipInput");
const supplierNameOutput = document.getElementById("supplierNameOutput");
const supplierTinOutput = document.getElementById("supplierTinOutput");
const supplierAddressOutput = document.getElementById("supplierAddressOutput");
const quarterPeriodOutput = document.getElementById("quarterPeriodOutput");
const monthBoxOutput = document.getElementById("monthBoxOutput");
const taxOutput = document.getElementById("taxOutput");
const statusNote = document.getElementById("statusNote");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

function setStatus(message) {
  if (statusNote) statusNote.textContent = message;
}

function getSupplierName(supplier) {
  return String(supplier.name || supplier["Supplier Name"] || supplier["supplier name"] || supplier.supplierName || supplier.Name || supplier.NAME || supplier.payee || supplier.Payee || "").trim();
}

function getSupplierTin(supplier) {
  return String(supplier.tin || supplier.TIN || supplier.Tin || supplier["Tax Identification Number"] || supplier["tax identification number"] || "").trim();
}

function getSupplierAddress(supplier) {
  return String(supplier.address || supplier.Address || supplier.ADDRESS || supplier["Supplier Address"] || supplier["supplier address"] || "").trim();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/,/g, " ")
    .replace(/\./g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAmount(value) {
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compactMoney(value) {
  return Number(value || 0).toFixed(2);
}

async function loadSuppliers() {
  try {
    const response = await fetch(SUPPLIERS_JSON, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cannot load ${SUPPLIERS_JSON}`);
    const data = await response.json();
    const rawList = Array.isArray(data) ? data : Object.values(data);
    suppliers = rawList.map((item) => ({
      name: getSupplierName(item),
      tin: getSupplierTin(item),
      address: getSupplierAddress(item),
      raw: item
    })).filter((item) => item.name);
    console.log("Supplier database loaded from:", SUPPLIERS_JSON);
    console.log("Supplier count:", suppliers.length);
    setStatus(`New uploaded BIR PDF template loaded locally. ${suppliers.length} supplier records ready.`);
  } catch (error) {
    console.error(error);
    suppliers = [];
    setStatus("Supplier database failed to load. Check suppliers.json in the repository root.");
  }
}

function findSupplier(query) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return null;
  const queryParts = cleanQuery.split(" ").filter(Boolean);
  return suppliers.find((supplier) => {
    const cleanName = normalizeText(supplier.name);
    if (cleanName.includes(cleanQuery)) return true;
    return queryParts.every((part) => cleanName.includes(part));
  }) || null;
}

function getMonthNumber(input) {
  const value = normalizeText(input);
  const monthMap = {
    january: 1, jan: 1, "1": 1, "01": 1,
    february: 2, feb: 2, "2": 2, "02": 2,
    march: 3, mar: 3, "3": 3, "03": 3,
    april: 4, apr: 4, "4": 4, "04": 4,
    may: 5, "5": 5, "05": 5,
    june: 6, jun: 6, "6": 6, "06": 6,
    july: 7, jul: 7, "7": 7, "07": 7,
    august: 8, aug: 8, "8": 8, "08": 8,
    september: 9, sept: 9, sep: 9, "9": 9, "09": 9,
    october: 10, oct: 10, "10": 10,
    november: 11, nov: 11, "11": 11,
    december: 12, dec: 12, "12": 12
  };
  return monthMap[value] || null;
}

function getQuarterInfo(monthNumber, year) {
  const safeYear = Number(year) || 2026;
  const quarters = [
    { startMonth: 1, endMonth: 3, endDay: 31, label: "First quarter", months: [1, 2, 3] },
    { startMonth: 4, endMonth: 6, endDay: 30, label: "Second quarter", months: [4, 5, 6] },
    { startMonth: 7, endMonth: 9, endDay: 30, label: "Third quarter", months: [7, 8, 9] },
    { startMonth: 10, endMonth: 12, endDay: 31, label: "Fourth quarter", months: [10, 11, 12] }
  ];
  const quarter = quarters.find((item) => item.months.includes(monthNumber));
  if (!quarter) return null;
  const monthPosition = quarter.months.indexOf(monthNumber) + 1;
  const fromDate = `${String(quarter.startMonth).padStart(2, "0")}/01/${safeYear}`;
  const toDate = `${String(quarter.endMonth).padStart(2, "0")}/${String(quarter.endDay).padStart(2, "0")}/${safeYear}`;
  const periodText = `${fromDate.replaceAll("/", " ")} to ${toDate.replaceAll("/", " ")}`;
  return {
    year: safeYear,
    startMonth: quarter.startMonth,
    endMonth: quarter.endMonth,
    endDay: quarter.endDay,
    monthPosition,
    label: quarter.label,
    fromDate,
    toDate,
    periodText,
    monthBox: monthPosition === 1 ? "First month of quarter" : monthPosition === 2 ? "Second month of quarter" : "Third month of quarter"
  };
}

function updateSupplierPreview() {
  selectedSupplier = findSupplier(supplierInput.value);
  if (!selectedSupplier) {
    supplierNameOutput.textContent = "No supplier selected";
    supplierTinOutput.textContent = "Pending";
    supplierAddressOutput.textContent = "Pending";
    return;
  }
  supplierNameOutput.textContent = selectedSupplier.name;
  supplierTinOutput.textContent = selectedSupplier.tin || "Pending";
  supplierAddressOutput.textContent = selectedSupplier.address || "Pending";
}

function updatePreview() {
  updateSupplierPreview();
  const year = yearInput.value || "2026";
  const monthNumber = getMonthNumber(monthInput.value);
  const amount = normalizeAmount(amountInput.value);
  const quarter = monthNumber ? getQuarterInfo(monthNumber, year) : null;
  const withholdingTax = amount * 0.02;
  currentPreview = {
    supplier: selectedSupplier,
    year: Number(year) || 2026,
    monthNumber,
    amount,
    withholdingTax,
    quarter,
    zip: zipInput.value.trim()
  };
  quarterPeriodOutput.textContent = quarter ? quarter.periodText : "Pending";
  monthBoxOutput.textContent = quarter ? quarter.monthBox : "Pending";
  taxOutput.textContent = amount ? `PHP ${money(withholdingTax)}` : "Pending";
}

function splitTin(tin) {
  return String(tin || "").replace(/[^\d]/g, "");
}

function drawText(page, text, x, y, size = 8, options = {}) {
  if (!text) return;
  page.drawText(String(text), {
    x,
    y,
    size,
    color: options.color || window.PDFLib.rgb(0, 0, 0),
    maxWidth: options.maxWidth,
    lineHeight: options.lineHeight || size + 2
  });
}

function drawRight(page, text, rightX, y, size = 7, font, color) {
  const value = String(text || "");
  const width = font.widthOfTextAtSize(value, size);
  drawText(page, value, rightX - width, y, size, { color });
}

function drawTinString(page, tin, x, y, size, color) {
  const digits = splitTin(tin);
  const formatted = digits.length >= 14 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9, 14)}` : tin;
  drawText(page, formatted, x, y, size, { color });
}

async function generatePdf() {
  updatePreview();
  if (!window.PDFLib) {
    alert("PDF library failed to load. Check your internet connection and refresh the page.");
    return;
  }
  if (!currentPreview.supplier) {
    alert("Please enter a supplier name that exists in suppliers.json.");
    return;
  }
  if (!currentPreview.quarter) {
    alert("Please enter a valid month.");
    return;
  }
  if (!currentPreview.amount) {
    alert("Please enter a valid gross amount.");
    return;
  }
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  let templateBytes;
  try {
    const response = await fetch(TEMPLATE_PDF, { cache: "no-store" });
    if (!response.ok) throw new Error("PDF template not found");
    templateBytes = await response.arrayBuffer();
  } catch (error) {
    console.error(error);
    alert("Cannot load 2307_Jan_2018_ENCS_v3_original.pdf. Make sure the uploaded BIR PDF template is in the repository root.");
    return;
  }
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.getPages()[0];
  const black = rgb(0, 0, 0);
  const supplier = currentPreview.supplier;
  const quarter = currentPreview.quarter;
  const amount = currentPreview.amount;
  const tax = currentPreview.withholdingTax;

  // Coordinates calibrated for uploaded BIR 2307 Jan 2018 ENCS v3 PDF, page 1, 612 x 936 pt.
  drawText(page, quarter.fromDate, 154, 820, 8, { color: black });
  drawText(page, quarter.toDate, 400, 820, 8, { color: black });

  // Part I - Payee information.
  drawTinString(page, supplier.tin, 210, 789, 8, black);
  drawText(page, supplier.name, 72, 752, 7.5, { color: black, maxWidth: 510, lineHeight: 9 });
  drawText(page, supplier.address, 72, 724, 6.2, { color: black, maxWidth: 465, lineHeight: 7.2 });
  if (currentPreview.zip) drawText(page, currentPreview.zip, 550, 724, 7, { color: black });

  // Part II - Pixelens payor information.
  drawTinString(page, PAYOR.tin, 210, 677, 8, black);
  drawText(page, PAYOR.name, 72, 649, 8, { color: black, maxWidth: 510 });
  drawText(page, PAYOR.address, 72, 621, 6.5, { color: black, maxWidth: 465, lineHeight: 7.5 });
  drawText(page, PAYOR.zip, 550, 621, 7, { color: black });

  // Part III - Expanded withholding tax row.
  const rowY = 552;
  const totalY = 424;
  const amountText = compactMoney(amount);
  const taxText = compactMoney(tax);
  drawText(page, "Professional fees, talent fees, service fees, and similar payments", 22, rowY, 5.6, { color: black, maxWidth: 150, lineHeight: 6.3 });
  drawText(page, "WC158", 184, rowY, 7, { color: black });
  if (quarter.monthPosition === 1) drawRight(page, amountText, 282, rowY, 7, font, black);
  if (quarter.monthPosition === 2) drawRight(page, amountText, 356, rowY, 7, font, black);
  if (quarter.monthPosition === 3) drawRight(page, amountText, 430, rowY, 7, font, black);
  drawRight(page, amountText, 500, rowY, 7, font, black);
  drawRight(page, taxText, 594, rowY, 7, font, black);

  // Total line for Part III expanded withholding section.
  drawRight(page, amountText, 500, totalY, 7, font, black);
  drawRight(page, taxText, 594, totalY, 7, font, black);

  // Printed name only. No scanned signature is inserted.
  page.setFont(boldFont);
  drawText(page, PAYOR.signatory, 245, 118, 6, { color: black, maxWidth: 245 });
  page.setFont(font);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const link = document.createElement("a");
  const cleanSupplierName = normalizeText(supplier.name).replace(/\s+/g, "_") || "supplier";
  const cleanMonth = normalizeText(monthInput.value).replace(/\s+/g, "_") || "month";
  link.href = URL.createObjectURL(blob);
  link.download = `BIR_2307_${cleanSupplierName}_${cleanMonth}_${currentPreview.year}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function resetForm() {
  supplierInput.value = "";
  monthInput.value = "";
  amountInput.value = "";
  zipInput.value = "";
  if (!yearInput.value) yearInput.value = "2026";
  selectedSupplier = null;
  currentPreview = null;
  updatePreview();
}

function attachEvents() {
  [supplierInput, monthInput, yearInput, amountInput, zipInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", updatePreview);
    input.addEventListener("change", updatePreview);
  });
  if (downloadBtn) downloadBtn.addEventListener("click", generatePdf);
  if (resetBtn) resetBtn.addEventListener("click", resetForm);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSuppliers();
  attachEvents();
  updatePreview();
  console.log("BIR 2307 app ready.");
});
