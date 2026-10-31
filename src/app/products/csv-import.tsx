
"use client";

import { ChangeEvent, useState } from "react";

type CsvRow = {
  name: string;
  category: string;
  unit: string;
  sellingPrice: number;
  stockQuantity: number;
  barcode: string;
  costPrice?: number;
  lowStockThreshold: number;
};

type PreviewRow = {
  rowNumber: number;
  data: (CsvRow & { proposedSku?: string }) | null;
  errors: string[];
};

type PreviewResult = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
};

type Props = {
  onImported: () => Promise<void>;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;

      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);

      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quotation mark.");

  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);

  return rows;
}

function convertRows(text: string): CsvRow[] {
  const parsed = parseCsv(text);

  if (parsed.length < 2) {
    throw new Error("Add a header row and at least one product.");
  }

  const headers = parsed[0].map((header) =>
    header.trim().toLowerCase()
  );

  const required = ["name", "sellingprice", "stockquantity"];
  const missing = required.filter((header) => !headers.includes(header));

  if (missing.length) {
    throw new Error(
      `Missing required CSV columns: ${missing.join(", ")}.`
    );
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error("The CSV contains duplicate column headings.");
  }

  if (parsed.length - 1 > 500) {
    throw new Error("Import up to 500 products per file.");
  }

  const column = (values: string[], name: string) => {
    const index = headers.indexOf(name);
    return index < 0 ? "" : (values[index] ?? "").trim();
  };

  return parsed.slice(1).map((values, index) => {
    const name = column(values, "name");
    const priceText = column(values, "sellingprice");
    const stockText = column(values, "stockquantity");
    const costText = column(values, "costprice");
    const thresholdText = column(values, "lowstockthreshold");

    const sellingPrice =
      priceText === "" ? Number.NaN : Number(priceText);
    const stockQuantity =
      stockText === "" ? Number.NaN : Number(stockText);
    const costPrice =
      costText === "" ? undefined : Number(costText);
    const lowStockThreshold =
      thresholdText === "" ? 5 : Number(thresholdText);

    if (!name) {
      throw new Error(`CSV row ${index + 2}: product name is required.`);
    }

    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      throw new Error(
        `CSV row ${index + 2}: sellingPrice must be a valid non-negative amount in GHS.`
      );
    }

    if (
      !Number.isSafeInteger(Math.round(sellingPrice * 100)) ||
      Math.round(sellingPrice * 100) > 2147483647
    ) {
      throw new Error(`CSV row ${index + 2}: selling price is too large.`);
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      throw new Error(
        `CSV row ${index + 2}: stockQuantity must be a whole number of zero or more.`
      );
    }

    if (
      costPrice !== undefined &&
      (!Number.isFinite(costPrice) ||
        costPrice < 0 ||
        !Number.isSafeInteger(Math.round(costPrice * 100)) ||
        Math.round(costPrice * 100) > 2147483647)
    ) {
      throw new Error(
        `CSV row ${index + 2}: costPrice must be a valid non-negative amount in GHS.`
      );
    }

    if (
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      throw new Error(
        `CSV row ${index + 2}: lowStockThreshold must be a whole number of zero or more.`
      );
    }

    return {
      name,
      category: column(values, "category"),
      unit: column(values, "unit") || "piece",
      sellingPrice,
      stockQuantity,
      barcode: column(values, "barcode"),
      ...(costPrice === undefined ? {} : { costPrice }),
      lowStockThreshold,
    };
  });
}

function downloadTemplate() {
  const csv = [
    "name,sellingPrice,stockQuantity,category,unit,barcode,costPrice,lowStockThreshold",
    'Nido Milk 400g,12.50,20,Beverages,piece,,10.00,5',
    'Bathing Soap,5.00,35,Personal Care,piece,,,5',
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "retail-pos-product-template.csv";
  link.click();

  URL.revokeObjectURL(url);
}

export default function CsvImport({ onImported }: Props) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setPreview(null);
    setRows([]);
    setMessage("");

    if (!file) {
      setFileName("");
      return;
    }

    setFileName(file.name);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Please choose a .csv file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("The CSV file must be smaller than 2 MB.");
      return;
    }

    try {
      const converted = convertRows(await file.text());
      setRows(converted);
      setMessage(
        `${converted.length} product rows loaded. Review them with Preview before importing.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not read the CSV file."
      );
    }
  }

  async function requestPreview() {
    if (!rows.length || busy) return;

    setBusy(true);
    setMessage("");
    setPreview(null);

    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", rows }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Could not preview this import.");
        return;
      }

      setPreview(data as PreviewResult);
      setMessage(
        data.invalidRows === 0
          ? "Preview passed. Review the products and confirm the import when ready."
          : "Some rows need attention. Correct the CSV and upload it again before importing."
      );
    } catch {
      setMessage("Request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (
      !preview ||
      preview.invalidRows !== 0 ||
      preview.rows.some((row) => !row.data) ||
      busy
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Import ${preview.totalRows} new products and their opening stock? Existing products will not be updated.`
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    try {
      const importRows = preview.rows.map((row) => row.data);

      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", rows: importRows }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Import failed. Preview the file again.");
        return;
      }

      setMessage(`Successfully imported ${data.importedCount} products.`);
      setRows([]);
      setPreview(null);
      setFileName("");
      await onImported();
    } catch {
      setMessage("Request failed. Check the server before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Bulk product setup
        </p>
        <h2 className="mt-2 text-xl font-bold">Import products from CSV</h2>
        <p className="mt-2 text-sm text-slate-600">
          Upload product details and opening stock in bulk. SKUs are generated
          automatically. Existing products and their stock will not be changed.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Download sample CSV
          </button>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Choose CSV file
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-800"
          />
        </label>

        {fileName && (
          <p className="text-sm text-slate-600">
            Selected file: <strong>{fileName}</strong>
          </p>
        )}

        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Before importing</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Required columns: name, sellingPrice, stockQuantity.</li>
            <li>Enter prices in GHS, such as 12.50.</li>
            <li>Stock quantities must be whole numbers.</li>
            <li>Blank units default to piece; blank low-stock thresholds default to 5.</li>
            <li>Import up to 500 products per file.</li>
          </ul>
        </div>

        {message && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          >
            {message}
          </div>
        )}

        <button
          type="button"
          disabled={!rows.length || busy}
          onClick={() => void requestPreview()}
          className="min-h-11 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Please wait..." : "Preview import"}
        </button>

        {preview && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Rows found</p>
                <p className="mt-1 text-2xl font-bold">{preview.totalRows}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">Valid rows</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">
                  {preview.validRows}
                </p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">Rows with errors</p>
                <p className="mt-1 text-2xl font-bold text-red-900">
                  {preview.invalidRows}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">CSV row</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Generated SKU</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Opening stock</th>
                    <th className="px-4 py-3">Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-4 py-3">{row.rowNumber}</td>
                      <td className="px-4 py-3 font-medium">
                        {row.data?.name ?? "Invalid row"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.data?.proposedSku ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.data
                          ? `GH₵ ${row.data.sellingPrice.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.data?.stockQuantity ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.errors.length ? (
                          <ul className="list-inside list-disc text-xs text-red-700">
                            {row.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="font-semibold text-emerald-700">
                            Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                preview.invalidRows > 0 ||
                preview.totalRows === 0 ||
                preview.rows.some((row) => !row.data)
              }
              onClick={() => void confirmImport()}
              className="min-h-12 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Importing..."
                : `Confirm and import ${preview.validRows} products`}
            </button>

            {preview.invalidRows > 0 && (
              <p className="text-sm text-red-700">
                Import is disabled until all rows pass validation. Correct the
                CSV and upload it again to generate a fresh preview.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
