const SUPPLIERS_JSON = "./suppliers.json";
const TEMPLATE_PDF = "./2307_Jan_2018_ENCS_v3_original.pdf";
const APP_VERSION = "v2000";

let suppliers = [];
let selectedSupplier = null;
let currentPreview = null;

const supplierInput = document.getElementById("supplierName");
const yearInput = document.getElementById("year");
const monthInput = document.getElementById("month");
const amountInput = document.getElementById("amount");
const zipInput = document.getElementById("zip");

const nameOutput = document.getElementById("selectedSupplierName");
const tinOutput = document.getElementById("selectedSupplierTin");
const addressOutput = document.getElementById("selectedSupplierAddress");
const quarterPeriodOutput = document.getElementById("quarterPeriodOutput");
const monthBoxOutput = document.getElementById("monthBoxOutput");
const withholdingTaxOutput = document.getElementById("withholdingTaxOutput");

const downloadButton = document.getElementById("downloadBtn");
const resetButton = document.getElementById("resetBtn");

function getSupplierName(supplier) {
  return String(
    supplier.name ||
    supplier["Supplier Name"] ||
    supplier["supplier name"] ||
    supplier.supplierName ||
    supplier.Name ||
    supplier.NAME ||
    ""
  ).trim();
}

function getSupplierTin(supplier) {
  return String(
    supplier.tin ||
    supplier.TIN ||
    supplier.Tin ||
    supplier["Tax Identification Number"] ||
    ""
  ).trim();
}

function getSupplierAddress(supplier) {
  return String(
    supplier.address ||
    supplier.Address ||
    supplier.ADDRESS ||
    supplier["Supplier Address"] ||
    ""
  ).trim();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/,/g, " ")
    .replace(/\./g, " ")
    .replace(/\-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeAmount(value) {
  const number = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function compactMoney(value) {
  return Number(value || 0).toFixed(2);
}

function getATCCode(name) {
  const value = String(name || '').toUpperCase();
  const isCompany = /\bINC\.?\b|\bINCORPORATED\b|\bCORP\.?\b|\bCORPORATION\b/.test(value);
  return isCompany ? 'WC100' : 'WI120';
}

async function loadSuppliers() {
  try {
    const response = await fetch(SUPPLIERS_JSON, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Cannot load ${SUPPLIERS_JSON}`);
    }

    const data = await response.json();
    const rawList = Array.isArray(data) ? data : Object.values(data);

    suppliers = rawList
      .map((item) => ({
        name: getSupplierName(item),
        tin: getSupplierTin(item),
        address: getSupplierAddress(item),
        raw: item
      }))
      .filter((item) => item.name);

    console.log("Supplier database loaded from:", SUPPLIERS_JSON);
    console.log("Supplier count:", suppliers.length);
  } catch (error) {
    suppliers = [];
    console.error(error);
    alert("Cannot load suppliers.json. Make sure suppliers.json is in the repository root.");
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
  const safeYear = Number(year) || new Date().getFullYear();

  const quarters = [
    { startMonth: 1, endMonth: 3, endDay: 31, months: [1, 2, 3] },
    { startMonth: 4, endMonth: 6, endDay: 30, months: [4, 5, 6] },
    { startMonth: 7, endMonth: 9, endDay: 30, months: [7, 8, 9] },
    { startMonth: 10, endMonth: 12, endDay: 31, months: [10, 11, 12] }
  ];

  const quarter = quarters.find((item) => item.months.includes(monthNumber));
  if (!quarter) return null;

  const monthPosition = quarter.months.indexOf(monthNumber) + 1;

  return {
    year: safeYear,
    monthPosition,
    periodText: `${String(quarter.startMonth).padStart(2, "0")} 01 ${safeYear} to ${String(quarter.endMonth).padStart(2, "0")} ${String(quarter.endDay).padStart(2, "0")} ${safeYear}`,
    fromDigits: `${String(quarter.startMonth).padStart(2, "0")}01${safeYear}`,
    toDigits: `${String(quarter.endMonth).padStart(2, "0")}${String(quarter.endDay).padStart(2, "0")}${safeYear}`,
    monthBox: monthPosition === 1 ? "First month of quarter" : monthPosition === 2 ? "Second month of quarter" : "Third month of quarter"
  };
}

function updateSupplierPreview() {
  selectedSupplier = findSupplier(supplierInput.value);

  if (!selectedSupplier) {
    nameOutput.textContent = "No supplier selected";
    tinOutput.textContent = "Pending";
    addressOutput.textContent = "Pending";
    return;
  }

  nameOutput.textContent = selectedSupplier.name;
  tinOutput.textContent = selectedSupplier.tin || "Pending";
  addressOutput.textContent = selectedSupplier.address || "Pending";
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
  withholdingTaxOutput.textContent = amount ? `PHP ${money(withholdingTax)}` : "Pending";
}

function splitTin(tin) {
  return onlyDigits(tin).padEnd(14, '0').slice(0, 14);
}

function drawText(page, text, x, y, size = 8, options = {}) {
  if (!text) return;
  page.drawText(String(text), {
    x,
    y,
    size,
    color: options.color || PDFLib.rgb(0, 0, 0),
    maxWidth: options.maxWidth,
    lineHeight: options.lineHeight || size + 2
  });
}

function drawDigits(page, digits, positions, y, size, options = {}) {
  const clean = onlyDigits(digits);
  const font = options.font;
  const color = options.color || PDFLib.rgb(0, 0, 0);
  positions.forEach((centerX, index) => {
    const digit = clean[index];
    if (!digit) return;
    let x = centerX - size * 0.28;
    if (font && typeof font.widthOfTextAtSize === 'function') {
      x = centerX - font.widthOfTextAtSize(digit, size) / 2;
    }
    page.drawText(digit, { x, y, size, color });
  });
}

function drawRightText(page, font, text, rightX, y, size, options = {}) {
  const value = String(text || '');
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, {
    x: rightX - width,
    y,
    size,
    color: options.color || PDFLib.rgb(0, 0, 0)
  });
}

async function generatePdf() {
  updatePreview();
  if (!window.PDFLib) {
    alert('PDF library is missing. Check your internet connection and reload the page.');
    return;
  }
  if (!currentPreview.supplier) {
    alert('Please select a valid supplier first.');
    return;
  }
  if (!currentPreview.quarter) {
    alert('Please enter a valid month.');
    return;
  }
  if (!currentPreview.amount) {
    alert('Please enter a valid gross amount.');
    return;
  }

  let templateBytes;
  try {
    const response = await fetch(TEMPLATE_PDF, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Cannot load ${TEMPLATE_PDF}`);
    templateBytes = await response.arrayBuffer();
  } catch (error) {
    console.error(error);
    alert('Cannot load 2307_Jan_2018_ENCS_v3_original.pdf. Make sure the uploaded BIR PDF template is in the repository root.');
    return;
  }

  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.getPages()[0];
  const black = rgb(0, 0, 0);

  const supplier = currentPreview.supplier;
  const quarter = currentPreview.quarter;
  const amount = currentPreview.amount;
  const tax = currentPreview.withholdingTax;
  const tinDigits = splitTin(supplier.tin);
  const payorTinDigits = '61944790400000';
  const atc = getATCCode(supplier.name);

  const dateFromCenters = [157.8, 171.3, 184.8, 198.0, 211.5, 224.8, 238.3, 251.5];
  const dateToCenters = [405.3, 418.3, 431.8, 445.3, 458.0, 471.3, 484.8, 497.8];

  const payeeTinCenters = [
    211.0, 224.5, 238.0,
    265.0, 278.5, 292.0,
    319.0, 332.5, 346.0,
    376.0, 389.5, 403.0, 416.5, 430.0
  ];

  const payorTinCenters = [
    214.0, 227.5, 241.0,
    268.0, 281.5, 295.0,
    322.0, 335.5, 349.0,
    379.0, 392.5, 406.0, 419.5, 433.0
  ];

  const payeeZipCenters = [552.0, 565.5, 579.0, 592.5];
  const payorZipCenters = [549.0, 562.5, 576.0, 589.5];

  page.setFont(boldFont);
  drawDigits(page, quarter.fromDigits, dateFromCenters, 817.2, 10.5, { font: boldFont, color: black });
  drawDigits(page, quarter.toDigits, dateToCenters, 817.2, 10.5, { font: boldFont, color: black });

  drawDigits(page, tinDigits, payeeTinCenters, 785.8, 9.8, { font: boldFont, color: black });

  page.setFont(font);
  drawText(page, supplier.name, 68, 758, 10.5, { color: black, maxWidth: 500, lineHeight: 11.5 });
  drawText(page, supplier.address, 68, 734.0, 8.8, { color: black, maxWidth: 492, lineHeight: 9.6 });

  if (currentPreview.zip) {
    drawDigits(page, onlyDigits(currentPreview.zip).padStart(4, '0').slice(-4), payeeZipCenters, 715.0, 9.0, { font: boldFont, color: black });
  }

  page.setFont(boldFont);
  drawDigits(page, payorTinDigits, payorTinCenters, 760.0, 9.8, { font: boldFont, color: black });

  page.setFont(font);
  drawText(page, 'PIXELENS CREATIVE ADVERTISING INC.', 68, 660.0, 10, { color: black, maxWidth: 500 });
  drawText(page, 'G8-4 2ND FLOOR GEMS PLAZA CIRCUMFERENTIAL ROAD SAN JOSE, ANTIPOLO CITY', 68, 560.0, 8.2, { color: black, maxWidth: 492, lineHeight: 9 });
  drawDigits(page, '1870', payorZipCenters, 560.0, 9.0, { font: boldFont, color: black });

  const incomeDescription = 'Professional fees, talent fees, service fees, and similar payments';
  const rowY = 559.5;
  const totalY = 492.5;
  const amountText = compactMoney(amount);
  const taxText = compactMoney(tax);

  page.setFont(font);
  drawText(page, incomeDescription, 22, rowY, 7.2, { color: black, maxWidth: 145, lineHeight: 8 });
  page.setFont(boldFont);
  drawText(page, atc, 188, rowY, 8.8, { color: black });

  if (quarter.monthPosition === 1) {
    drawRightText(page, boldFont, amountText, 288, rowY, 8.8, { color: black });
  } else if (quarter.monthPosition === 2) {
    drawRightText(page, boldFont, amountText, 363, rowY, 8.8, { color: black });
  } else {
    drawRightText(page, boldFont, amountText, 435, rowY, 8.8, { color: black });
  }

  drawRightText(page, boldFont, amountText, 507, rowY, 8.8, { color: black });
  drawRightText(page, boldFont, taxText, 592, rowY, 8.8, { color: black });
  drawRightText(page, boldFont, amountText, 507, totalY, 8.8, { color: black });
  drawRightText(page, boldFont, taxText, 592, totalY, 8.8, { color: black });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  const cleanSupplierName = normalizeText(supplier.name).replace(/\s+/g, '_') || 'supplier';
  const cleanMonth = normalizeText(monthInput.value).replace(/\s+/g, '_') || 'month';

  link.href = URL.createObjectURL(blob);
  link.download = `BIR_2307_${cleanSupplierName}_${cleanMonth}_${currentPreview.year}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function resetForm() {
  supplierInput.value = '';
  monthInput.value = '';
  amountInput.value = '';
  zipInput.value = '';
  if (!yearInput.value) yearInput.value = '2026';
  selectedSupplier = null;
  currentPreview = null;
  updatePreview();
}

function attachEvents() {
  supplierInput.addEventListener('input', updatePreview);
  supplierInput.addEventListener('change', updatePreview);
  monthInput.addEventListener('input', updatePreview);
  monthInput.addEventListener('change', updatePreview);
  yearInput.addEventListener('input', updatePreview);
  yearInput.addEventListener('change', updatePreview);
  amountInput.addEventListener('input', updatePreview);
  amountInput.addEventListener('change', updatePreview);
  zipInput.addEventListener('input', updatePreview);
  zipInput.addEventListener('change', updatePreview);
  downloadButton.addEventListener('click', generatePdf);
  resetButton.addEventListener('click', resetForm);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSuppliers();
  attachEvents();
  updatePreview();
  console.log('BIR 2307 app ready.', APP_VERSION);
});
