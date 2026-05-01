const SUPPLIERS_JSON = "./suppliers.json";
const TEMPLATE_PDF = "./2307_template_blank.pdf";

let suppliers = [];
let selectedSupplier = null;
let currentPreview = null;

function pickElement(ids, selector) {
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) return element;
  }

  if (selector) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  return null;
}

function findInputByPlaceholder(words) {
  const inputs = Array.from(document.querySelectorAll("input"));
  return inputs.find((input) => {
    const placeholder = String(input.placeholder || "").toLowerCase();
    const id = String(input.id || "").toLowerCase();
    const name = String(input.name || "").toLowerCase();
    const combined = `${placeholder} ${id} ${name}`;
    return words.some((word) => combined.includes(word));
  }) || null;
}

const supplierInput =
  pickElement(
    ["supplierName", "supplierInput", "supplier", "supplier-name", "payeeName", "payee"],
    'input[placeholder*="supplier" i]'
  ) || findInputByPlaceholder(["supplier", "payee", "name"]);

const yearInput =
  pickElement(
    ["year", "taxYear", "yearInput"],
    'input[placeholder*="year" i]'
  ) || findInputByPlaceholder(["year"]);

const monthInput =
  pickElement(
    ["month", "monthInput", "taxMonth"],
    'input[placeholder*="month" i]'
  ) || findInputByPlaceholder(["month", "march", "jun"]);

const amountInput =
  pickElement(
    ["amount", "grossAmount", "gross", "amountInput"],
    'input[placeholder*="150000" i]'
  ) || findInputByPlaceholder(["amount", "gross", "150000"]);

const zipInput =
  pickElement(
    ["zip", "zipCode", "zipInput"],
    'input[placeholder*="unknown" i]'
  ) || findInputByPlaceholder(["zip", "unknown"]);

const downloadButton =
  pickElement(
    ["downloadBtn", "downloadButton", "generatePdf", "downloadPdf"],
    null
  ) || Array.from(document.querySelectorAll("button")).find((button) =>
    String(button.textContent || "").toLowerCase().includes("download")
  );

const resetButton =
  pickElement(
    ["resetBtn", "resetButton"],
    null
  ) || Array.from(document.querySelectorAll("button")).find((button) =>
    String(button.textContent || "").toLowerCase().includes("reset")
  );

function getSupplierName(supplier) {
  return String(
    supplier.name ||
    supplier["Supplier Name"] ||
    supplier["supplier name"] ||
    supplier.supplierName ||
    supplier.Name ||
    supplier.NAME ||
    supplier.payee ||
    supplier.Payee ||
    ""
  ).trim();
}

function getSupplierTin(supplier) {
  return String(
    supplier.tin ||
    supplier.TIN ||
    supplier.Tin ||
    supplier["tin"] ||
    supplier["Tax Identification Number"] ||
    supplier["tax identification number"] ||
    ""
  ).trim();
}

function getSupplierAddress(supplier) {
  return String(
    supplier.address ||
    supplier.Address ||
    supplier.ADDRESS ||
    supplier["Supplier Address"] ||
    supplier["supplier address"] ||
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
  const number = Number(value || 0);
  return number.toFixed(2);
}

async function loadSuppliers() {
  const possiblePaths = [
    SUPPLIERS_JSON,
    "./suppliers.json",
    "suppliers.json",
    "./data/suppliers.json",
    "data/suppliers.json"
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) continue;

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

      console.log("Supplier database loaded from:", path);
      console.log("Supplier count:", suppliers.length);
      return;
    } catch (error) {
      console.warn("Failed loading supplier path:", path, error);
    }
  }

  suppliers = [];
  console.error("No supplier database found.");
}

function findSupplier(query) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return null;

  const queryParts = cleanQuery.split(" ").filter(Boolean);

  const exactOrIncluded = suppliers.find((supplier) => {
    const cleanName = normalizeText(supplier.name);
    return cleanName.includes(cleanQuery);
  });

  if (exactOrIncluded) return exactOrIncluded;

  const allPartsMatch = suppliers.find((supplier) => {
    const cleanName = normalizeText(supplier.name);
    return queryParts.every((part) => cleanName.includes(part));
  });

  if (allPartsMatch) return allPartsMatch;

  return null;
}

function getMonthNumber(input) {
  const value = normalizeText(input);

  const monthMap = {
    january: 1,
    jan: 1,
    "1": 1,
    "01": 1,

    february: 2,
    feb: 2,
    "2": 2,
    "02": 2,

    march: 3,
    mar: 3,
    "3": 3,
    "03": 3,

    april: 4,
    apr: 4,
    "4": 4,
    "04": 4,

    may: 5,
    "5": 5,
    "05": 5,

    june: 6,
    jun: 6,
    "6": 6,
    "06": 6,

    july: 7,
    jul: 7,
    "7": 7,
    "07": 7,

    august: 8,
    aug: 8,
    "8": 8,
    "08": 8,

    september: 9,
    sept: 9,
    sep: 9,
    "9": 9,
    "09": 9,

    october: 10,
    oct: 10,

    november: 11,
    nov: 11,

    december: 12,
    dec: 12
  };

  return monthMap[value] || null;
}

function getQuarterInfo(monthNumber, year) {
  const safeYear = Number(year) || new Date().getFullYear();

  const quarters = [
    {
      startMonth: 1,
      endMonth: 3,
      startDay: 1,
      endDay: 31,
      label: "First quarter",
      months: [1, 2, 3]
    },
    {
      startMonth: 4,
      endMonth: 6,
      startDay: 1,
      endDay: 30,
      label: "Second quarter",
      months: [4, 5, 6]
    },
    {
      startMonth: 7,
      endMonth: 9,
      startDay: 1,
      endDay: 30,
      label: "Third quarter",
      months: [7, 8, 9]
    },
    {
      startMonth: 10,
      endMonth: 12,
      startDay: 1,
      endDay: 31,
      label: "Fourth quarter",
      months: [10, 11, 12]
    }
  ];

  const quarter = quarters.find((item) => item.months.includes(monthNumber));
  if (!quarter) return null;

  const monthPosition = quarter.months.indexOf(monthNumber) + 1;

  return {
    year: safeYear,
    startMonth: quarter.startMonth,
    endMonth: quarter.endMonth,
    startDay: quarter.startDay,
    endDay: quarter.endDay,
    monthPosition,
    label: quarter.label,
    periodText: `${String(quarter.startMonth).padStart(2, "0")} ${String(quarter.startDay).padStart(2, "0")} ${safeYear} to ${String(quarter.endMonth).padStart(2, "0")} ${String(quarter.endDay).padStart(2, "0")} ${safeYear}`,
    fromDate: `${String(quarter.startMonth).padStart(2, "0")} ${String(quarter.startDay).padStart(2, "0")} ${safeYear}`,
    toDate: `${String(quarter.endMonth).padStart(2, "0")} ${String(quarter.endDay).padStart(2, "0")} ${safeYear}`,
    monthBox: monthPosition === 1 ? "First month of quarter" : monthPosition === 2 ? "Second month of quarter" : "Third month of quarter"
  };
}

function findCardByLabel(labelWords) {
  const cards = Array.from(document.querySelectorAll(".supplier-card div, .result-card div, .card, .info-card, .summary-card"));
  return cards.find((card) => {
    const text = normalizeText(card.textContent);
    return labelWords.every((word) => text.includes(normalizeText(word)));
  }) || null;
}

function setCardValue(labelWords, value) {
  const card = findCardByLabel(labelWords);
  if (!card) return false;

  const strong = card.querySelector("strong");
  if (strong) {
    strong.textContent = value;
    return true;
  }

  const spans = Array.from(card.querySelectorAll("span"));
  if (spans.length) {
    const lastSpan = spans[spans.length - 1];
    lastSpan.textContent = value;
    return true;
  }

  card.textContent = value;
  return true;
}

function setElementText(ids, labelWords, value) {
  const element = pickElement(ids, null);
  if (element) {
    element.textContent = value;
    return;
  }

  setCardValue(labelWords, value);
}

function updateSupplierPreview() {
  const query = supplierInput ? supplierInput.value : "";
  selectedSupplier = findSupplier(query);

  if (!selectedSupplier) {
    setElementText(
      ["selectedSupplierName", "supplierNameOutput", "nameOutput", "payeeNameOutput"],
      ["name"],
      "No supplier selected"
    );
    setElementText(
      ["selectedSupplierTin", "tinOutput", "payeeTinOutput"],
      ["tin"],
      "Pending"
    );
    setElementText(
      ["selectedSupplierAddress", "addressOutput", "payeeAddressOutput"],
      ["address"],
      "Pending"
    );
    return;
  }

  setElementText(
    ["selectedSupplierName", "supplierNameOutput", "nameOutput", "payeeNameOutput"],
    ["name"],
    selectedSupplier.name
  );
  setElementText(
    ["selectedSupplierTin", "tinOutput", "payeeTinOutput"],
    ["tin"],
    selectedSupplier.tin || "Pending"
  );
  setElementText(
    ["selectedSupplierAddress", "addressOutput", "payeeAddressOutput"],
    ["address"],
    selectedSupplier.address || "Pending"
  );
}

function updatePreview() {
  updateSupplierPreview();

  const year = yearInput ? yearInput.value : "2026";
  const monthNumber = getMonthNumber(monthInput ? monthInput.value : "");
  const amount = normalizeAmount(amountInput ? amountInput.value : "");
  const quarter = monthNumber ? getQuarterInfo(monthNumber, year) : null;
  const withholdingTax = amount * 0.02;

  currentPreview = {
    supplier: selectedSupplier,
    year: Number(year) || 2026,
    monthNumber,
    amount,
    withholdingTax,
    quarter,
    zip: zipInput ? zipInput.value.trim() : ""
  };

  if (!quarter) {
    setElementText(
      ["quarterPeriodOutput", "quarterOutput", "periodOutput"],
      ["quarter", "period"],
      "Pending"
    );
    setElementText(
      ["monthBoxOutput", "monthOutput"],
      ["month", "box"],
      "Pending"
    );
  } else {
    setElementText(
      ["quarterPeriodOutput", "quarterOutput", "periodOutput"],
      ["quarter", "period"],
      quarter.periodText
    );
    setElementText(
      ["monthBoxOutput", "monthOutput"],
      ["month", "box"],
      quarter.monthBox
    );
  }

  setElementText(
    ["taxOutput", "withholdingTaxOutput", "withholdingOutput"],
    ["withholding", "tax"],
    amount ? `PHP ${money(withholdingTax)}` : "Pending"
  );
}

function requirePdfLib() {
  if (!window.PDFLib) {
    alert("PDF library is missing. Please make sure pdf-lib is loaded in index.html.");
    return false;
  }
  return true;
}

function drawText(page, text, x, y, size = 9, options = {}) {
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

function splitTin(tin) {
  const cleanTin = String(tin || "").replace(/[^\d]/g, "");
  return {
    part1: cleanTin.slice(0, 3),
    part2: cleanTin.slice(3, 6),
    part3: cleanTin.slice(6, 9),
    branch: cleanTin.slice(9, 14) || "00000"
  };
}

async function generatePdf() {
  updatePreview();

  if (!requirePdfLib()) return;

  if (!currentPreview.supplier) {
    alert("Please select a valid supplier first.");
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
    if (!response.ok) {
      throw new Error("PDF template not found.");
    }
    templateBytes = await response.arrayBuffer();
  } catch (error) {
    console.error(error);
    alert("Cannot load 2307 template PDF. Check that 2307_template_blank.pdf is uploaded in the same folder as index.html.");
    return;
  }

  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  const supplier = currentPreview.supplier;
  const quarter = currentPreview.quarter;
  const amount = currentPreview.amount;
  const tax = currentPreview.withholdingTax;
  const tin = splitTin(supplier.tin);

  page.setFont(font);

  const black = rgb(0, 0, 0);

  const textOptions = {
    color: black
  };

  drawText(page, quarter.fromDate.slice(0, 2), 164, 657, 8, textOptions);
  drawText(page, quarter.fromDate.slice(3, 5), 195, 657, 8, textOptions);
  drawText(page, quarter.fromDate.slice(6, 10), 226, 657, 8, textOptions);

  drawText(page, quarter.toDate.slice(0, 2), 322, 657, 8, textOptions);
  drawText(page, quarter.toDate.slice(3, 5), 353, 657, 8, textOptions);
  drawText(page, quarter.toDate.slice(6, 10), 384, 657, 8, textOptions);

  drawText(page, tin.part1, 111, 614, 8, textOptions);
  drawText(page, tin.part2, 159, 614, 8, textOptions);
  drawText(page, tin.part3, 207, 614, 8, textOptions);
  drawText(page, tin.branch, 255, 614, 8, textOptions);

  drawText(page, supplier.name, 98, 588, 8, {
    color: black,
    maxWidth: 410,
    lineHeight: 10
  });

  drawText(page, supplier.address, 98, 560, 7.5, {
    color: black,
    maxWidth: 410,
    lineHeight: 9
  });

  if (currentPreview.zip) {
    drawText(page, currentPreview.zip, 465, 540, 8, textOptions);
  }

  drawText(page, "WC 158", 66, 338, 8, textOptions);
  drawText(page, "Professional fees, talent fees, service fees, and similar payments", 110, 338, 7, {
    color: black,
    maxWidth: 250
  });

  const monthAmountY = 338;
  const amountText = compactMoney(amount);
  const taxText = compactMoney(tax);

  if (quarter.monthPosition === 1) {
    drawText(page, amountText, 353, monthAmountY, 8, textOptions);
  }

  if (quarter.monthPosition === 2) {
    drawText(page, amountText, 414, monthAmountY, 8, textOptions);
  }

  if (quarter.monthPosition === 3) {
    drawText(page, amountText, 475, monthAmountY, 8, textOptions);
  }

  drawText(page, amountText, 536, monthAmountY, 8, textOptions);
  drawText(page, taxText, 536, 313, 8, textOptions);

  page.setFont(boldFont);
  drawText(page, taxText, 536, 286, 8, textOptions);

  const pdfBytes = await pdfDoc.save();

  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const link = document.createElement("a");
  const cleanSupplierName = normalizeText(supplier.name).replace(/\s+/g, "_") || "supplier";
  const cleanMonth = monthInput ? normalizeText(monthInput.value).replace(/\s+/g, "_") : "month";

  link.href = URL.createObjectURL(blob);
  link.download = `BIR_2307_${cleanSupplierName}_${cleanMonth}_${currentPreview.year}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function resetForm() {
  if (supplierInput) supplierInput.value = "";
  if (monthInput) monthInput.value = "";
  if (amountInput) amountInput.value = "";
  if (zipInput) zipInput.value = "";
  if (yearInput && !yearInput.value) yearInput.value = "2026";

  selectedSupplier = null;
  currentPreview = null;
  updatePreview();
}

function attachEvents() {
  [
    supplierInput,
    monthInput,
    yearInput,
    amountInput,
    zipInput
  ].forEach((input) => {
    if (input) {
      input.addEventListener("input", updatePreview);
      input.addEventListener("change", updatePreview);
    }
  });

  if (downloadButton) {
    downloadButton.addEventListener("click", generatePdf);
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetForm);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (yearInput && !yearInput.value) {
    yearInput.value = "2026";
  }

  await loadSuppliers();
  attachEvents();
  updatePreview();

  console.log("BIR 2307 app ready.");
});
