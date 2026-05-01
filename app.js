const TEMPLATE_PDF = "assets/2307_template_blank.pdf";
const SUPPLIERS_JSON = "data/suppliers.json";

const state = {
  suppliers: [],
  selectedSupplier: null,
};

const el = {
  supplierInput: document.getElementById("supplierInput"),
  supplierList: document.getElementById("supplierList"),
  yearInput: document.getElementById("yearInput"),
  monthInput: document.getElementById("monthInput"),
  amountInput: document.getElementById("amountInput"),
  zipInput: document.getElementById("zipInput"),
  previewName: document.getElementById("previewName"),
  previewTin: document.getElementById("previewTin"),
  previewAddress: document.getElementById("previewAddress"),
  quarterPreview: document.getElementById("quarterPreview"),
  monthBoxPreview: document.getElementById("monthBoxPreview"),
  taxPreview: document.getElementById("taxPreview"),
  statusText: document.getElementById("statusText"),
  downloadPdfBtn: document.getElementById("downloadPdfBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

const MONTHS = [
  ["january", "jan", "1"],
  ["february", "feb", "2"],
  ["march", "mar", "3"],
  ["april", "apr", "4"],
  ["may", "5"],
  ["june", "jun", "6"],
  ["july", "jul", "7"],
  ["august", "aug", "8"],
  ["september", "sep", "sept", "9"],
  ["october", "oct", "10"],
  ["november", "nov", "11"],
  ["december", "dec", "12"],
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseAmount(value) {
  const cleaned = String(value || "").replace(/,/g, "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMonth(value) {
  const needle = normalizeText(value);
  if (!needle) return null;
  for (let i = 0; i < MONTHS.length; i++) {
    if (MONTHS[i].includes(needle)) return i + 1;
  }
  return null;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateParts(month, day, year) {
  return `${pad2(month)} ${pad2(day)} ${year}`;
}

function quarterInfo(month, year) {
  const q = Math.ceil(month / 3);
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const endDay = new Date(year, endMonth, 0).getDate();
  const monthPosition = ((month - 1) % 3) + 1;
  const labels = { 1: "1st Month of the Quarter", 2: "2nd Month of the Quarter", 3: "3rd Month of the Quarter" };
  return {
    q,
    startMonth,
    endMonth,
    endDay,
    from: formatDateParts(startMonth, 1, year),
    to: formatDateParts(endMonth, endDay, year),
    monthPosition,
    monthLabel: labels[monthPosition],
  };
}

function findSupplier(value) {
  const needle = normalizeText(value);
  if (!needle) return null;
  return state.suppliers.find(s => normalizeText(s.name) === needle)
    || state.suppliers.find(s => normalizeText(s.tab) === needle)
    || state.suppliers.find(s => normalizeText(s.name).includes(needle))
    || state.suppliers.find(s => normalizeText(s.tab).includes(needle));
}

function setStatus(message) {
  el.statusText.textContent = message;
}

function updateSupplierPreview() {
  const supplier = findSupplier(el.supplierInput.value);
  state.selectedSupplier = supplier;
  el.previewName.textContent = supplier ? supplier.name : "No supplier selected";
  el.previewTin.textContent = supplier ? supplier.tin : "Pending";
  el.previewAddress.textContent = supplier ? supplier.address : "Pending";
}

function updateComputedPreview() {
  const month = parseMonth(el.monthInput.value);
  const year = Number(el.yearInput.value) || 2026;
  const amount = parseAmount(el.amountInput.value);

  if (month) {
    const q = quarterInfo(month, year);
    el.quarterPreview.textContent = `${q.from} to ${q.to}`;
    el.monthBoxPreview.textContent = q.monthLabel;
  } else {
    el.quarterPreview.textContent = "Pending";
    el.monthBoxPreview.textContent = "Pending";
  }

  if (amount !== null) {
    el.taxPreview.textContent = money(amount * 0.02);
  } else {
    el.taxPreview.textContent = "Pending";
  }
}

function clearText(page, topX, topY, width, height) {
  const pageHeight = page.getHeight();
  page.drawRectangle({
    x: topX,
    y: pageHeight - topY - height,
    width,
    height,
    color: PDFLib.rgb(1, 1, 1),
    borderColor: PDFLib.rgb(1, 1, 1),
    borderWidth: 0,
  });
}

function drawTextTop(page, text, topX, baselineTopY, size, font) {
  const pageHeight = page.getHeight();
  page.drawText(String(text || ""), {
    x: topX,
    y: pageHeight - baselineTopY,
    size,
    font,
    color: PDFLib.rgb(0, 0, 0),
  });
}

function drawRightTextTop(page, text, rightX, baselineTopY, size, font) {
  const value = String(text || "");
  const width = font.widthOfTextAtSize(value, size);
  drawTextTop(page, value, rightX - width, baselineTopY, size, font);
}

function fitSize(text, font, targetWidth, startingSize, minSize = 6.2) {
  let size = startingSize;
  while (size > minSize && font.widthOfTextAtSize(String(text || ""), size) > targetWidth) {
    size -= 0.2;
  }
  return size;
}

function tinForDisplay(tin) {
  const digits = String(tin || "").replace(/\D/g, "");
  if (digits.length >= 12) {
    return `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,9)} ${digits.slice(9)}`;
  }
  return tin || "";
}

function sanitizeFilename(value) {
  return String(value || "2307")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function validateInputs() {
  const supplier = state.selectedSupplier || findSupplier(el.supplierInput.value);
  const month = parseMonth(el.monthInput.value);
  const year = Number(el.yearInput.value);
  const amount = parseAmount(el.amountInput.value);

  if (!supplier) throw new Error("Supplier not found. Please type or select a supplier from the list.");
  if (!month) throw new Error("Month not recognized. Use March, June, 3, 6, etc.");
  if (!Number.isFinite(year) || year < 2000 || year > 2100) throw new Error("Year is not valid.");
  if (amount === null || amount < 0) throw new Error("Amount is not valid.");

  return { supplier, month, year, amount, quarter: quarterInfo(month, year) };
}

async function generatePdf() {
  const { supplier, amount, quarter } = validateInputs();
  const pdfBytes = await fetch(TEMPLATE_PDF).then(r => r.arrayBuffer());
  const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const tax = amount * 0.02;

  clearText(page, 164, 116, 104, 19);
  clearText(page, 421, 116, 104, 19);
  drawTextTop(page, quarter.from, 169, 130, 9, font);
  drawTextTop(page, quarter.to, 426, 130, 9, font);

  clearText(page, 210, 147, 238, 20);
  drawTextTop(page, tinForDisplay(supplier.tin), 220, 162, 9, font);

  clearText(page, 38, 180, 548, 22);
  const nameSize = fitSize(supplier.name, bold, 520, 10.8, 7);
  drawTextTop(page, supplier.name, 40, 196, nameSize, bold);

  clearText(page, 38, 211, 498, 22);
  clearText(page, 565, 209, 47, 18);
  const addressSize = fitSize(supplier.address, font, 490, 8.8, 5.8);
  drawTextTop(page, supplier.address, 40, 226, addressSize, font);

  const zip = String(el.zipInput.value || "").trim();
  if (zip) drawTextTop(page, zip.replace(/\D/g, "").slice(0, 6), 570, 224, 8.5, font);

  const monthColumns = {
    1: { left: 222, right: 296 },
    2: { left: 301, right: 377 },
    3: { left: 381, right: 457 },
  };
  const activeColumn = monthColumns[quarter.monthPosition];

  [
    [224, 400, 72, 14], [304, 400, 72, 14], [384, 400, 72, 14], [463, 400, 70, 14], [542, 400, 66, 14],
    [224, 552, 72, 14], [304, 552, 72, 14], [384, 552, 72, 14], [463, 552, 70, 14], [542, 552, 66, 14],
  ].forEach(r => clearText(page, r[0], r[1], r[2], r[3]));

  drawRightTextTop(page, money(amount), activeColumn.right - 3, 412, 8, font);
  drawRightTextTop(page, money(amount), 532, 412, 8, font);
  drawRightTextTop(page, money(tax), 607, 412, 8, font);

  for (let pos = 1; pos <= 3; pos++) {
    const col = monthColumns[pos];
    const value = pos === quarter.monthPosition ? money(amount) : "-";
    drawRightTextTop(page, value, col.right - 3, 564, 8, font);
  }
  drawRightTextTop(page, money(amount), 532, 564, 8, font);
  drawRightTextTop(page, money(tax), 607, 564, 8, font);

  const output = await pdfDoc.save();
  const blob = new Blob([output], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BIR_2307_${sanitizeFilename(supplier.name)}_${quarter.from.replaceAll(" ", "")}_${quarter.to.replaceAll(" ", "")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  try {
    const response = await fetch(SUPPLIERS_JSON);
    state.suppliers = await response.json();
    el.supplierList.innerHTML = state.suppliers
      .map(s => `<option value="${String(s.name).replaceAll('"', '&quot;')}">${s.tin}</option>`)
      .join("");
    setStatus(`Loaded ${state.suppliers.length} visible supplier records. Hidden tabs are not included.`);
  } catch (error) {
    setStatus("Supplier database failed to load. Check the data folder path.");
  }
}

[el.supplierInput, el.monthInput, el.yearInput, el.amountInput, el.zipInput].forEach(input => {
  input.addEventListener("input", () => {
    updateSupplierPreview();
    updateComputedPreview();
  });
});

el.downloadPdfBtn.addEventListener("click", async () => {
  el.downloadPdfBtn.disabled = true;
  setStatus("Generating PDF...");
  try {
    updateSupplierPreview();
    await generatePdf();
    setStatus("Done. Your filled BIR 2307 PDF has been downloaded.");
  } catch (error) {
    setStatus(error.message || "Something went wrong while generating the PDF.");
  } finally {
    el.downloadPdfBtn.disabled = false;
  }
});

el.resetBtn.addEventListener("click", () => {
  el.supplierInput.value = "";
  el.monthInput.value = "";
  el.yearInput.value = "2026";
  el.amountInput.value = "";
  el.zipInput.value = "";
  state.selectedSupplier = null;
  updateSupplierPreview();
  updateComputedPreview();
  setStatus(`Loaded ${state.suppliers.length} visible supplier records. Hidden tabs are not included.`);
});

init();
