import { Archive, Boxes, Download, Pill, Printer } from "lucide-react";

import type { Supplier } from "../types";
import { ReportTable } from "./ReadOnlyViews";
import { MobileDisclosure } from "./MobileDisclosure";

export type ReportKind = "stock" | "movement" | "supplier" | "expiry" | "reorder";
export type ReportItemType = "medicine" | "product";
export type ReportRow = Record<string, string | number>;

type MovementFilterOption = {
  value: string;
  label: string;
};

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});
const number = new Intl.NumberFormat("en-NG");

export function ReportsPanel({
  report,
  setReport,
  rows,
  categories,
  suppliers,
  movementFilterOptions,
  stockItemType,
  setStockItemType,
  movementItemType,
  setMovementItemType,
  movementStartDate,
  setMovementStartDate,
  movementEndDate,
  setMovementEndDate,
  movementType,
  setMovementType,
  medicineFilter,
  setMedicineFilter,
  genericFilter,
  setGenericFilter,
  categoryFilter,
  setCategoryFilter,
  supplierFilter,
  setSupplierFilter,
  supplierDate,
  setSupplierDate,
  movementQuantityTotal,
  movementUnitsMoved,
  movementSalesTotal,
  stockQuantityTotal,
  stockCostTotal,
  historyStatusLabel,
  canLoadMoreHistory,
  historyLoading,
  historyLoadMoreLabel = "Load older history",
  onLoadMoreHistory,
  onExportCsv,
  onPrint,
}: {
  report: ReportKind;
  setReport: (report: ReportKind) => void;
  rows: ReportRow[];
  categories: string[];
  suppliers: Supplier[];
  movementFilterOptions: MovementFilterOption[];
  stockItemType: ReportItemType;
  setStockItemType: (itemType: ReportItemType) => void;
  movementItemType: ReportItemType;
  setMovementItemType: (itemType: ReportItemType) => void;
  movementStartDate: string;
  setMovementStartDate: (value: string) => void;
  movementEndDate: string;
  setMovementEndDate: (value: string) => void;
  movementType: string;
  setMovementType: (value: string) => void;
  medicineFilter: string;
  setMedicineFilter: (value: string) => void;
  genericFilter: string;
  setGenericFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  supplierFilter: string;
  setSupplierFilter: (value: string) => void;
  supplierDate: string;
  setSupplierDate: (value: string) => void;
  movementQuantityTotal: number;
  movementUnitsMoved: number;
  movementSalesTotal: number;
  stockQuantityTotal: number;
  stockCostTotal: number;
  historyStatusLabel?: string;
  canLoadMoreHistory?: boolean;
  historyLoading?: boolean;
  historyLoadMoreLabel?: string;
  onLoadMoreHistory?: () => void;
  onExportCsv: (fileName: string, rows: ReportRow[]) => void;
  onPrint: () => void;
}) {
  function clearItemFilters() {
    setCategoryFilter("");
    setMedicineFilter("");
    setGenericFilter("");
  }

  const activeFilterCount = report === "supplier"
    ? [supplierFilter, supplierDate].filter(Boolean).length
    : [medicineFilter, genericFilter, categoryFilter,
        ...(report === "movement" ? [movementStartDate, movementEndDate, movementType] : [])]
        .filter(Boolean).length;
  const filterSummary = activeFilterCount
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
    : "All items · tap to narrow results";

  return (
    <section className="content-section reports-panel">
      <div className="section-heading">
        <div>
          <h2>Reports and Exports</h2>
          <p>
            CSV export and browser print cover spreadsheet and PDF workflows.
          </p>
        </div>
        <div className="button-row">
          <button
            className="ghost-button"
            type="button"
            onClick={() => onExportCsv(`${report}-report.csv`, rows)}
            disabled={!rows.length}
          >
            <Download size={16} />
            CSV
          </button>
          <button className="ghost-button" type="button" onClick={onPrint}>
            <Printer size={16} />
            Print/PDF
          </button>
        </div>
      </div>
      <label className="mobile-report-selector">
        Report
        <select value={report} onChange={(event) => setReport(event.target.value as ReportKind)}>
          <option value="stock">Stock on hand</option>
          <option value="movement">Movement ledger</option>
          <option value="supplier">Supplier</option>
          <option value="expiry">Expiry</option>
          <option value="reorder">Reorder</option>
        </select>
      </label>
      <div className="tabs report-desktop-tabs">
        <button
          className={report === "stock" ? "active" : ""}
          onClick={() => setReport("stock")}
          type="button"
        >
          Stock on hand
        </button>
        <button
          className={report === "movement" ? "active" : ""}
          onClick={() => setReport("movement")}
          type="button"
        >
          Movement ledger
        </button>
        <button
          className={report === "supplier" ? "active" : ""}
          onClick={() => setReport("supplier")}
          type="button"
        >
          Supplier
        </button>
        <button
          className={report === "expiry" ? "active" : ""}
          onClick={() => setReport("expiry")}
          type="button"
        >
          Expiry
        </button>
        <button
          className={report === "reorder" ? "active" : ""}
          onClick={() => setReport("reorder")}
          type="button"
        >
          Reorder
        </button>
      </div>
      {report === "movement" && (
        <>
          <div className="report-mode-switch">
            <button
              className={movementItemType === "medicine" ? "active" : ""}
              type="button"
              onClick={() => {
                setMovementItemType("medicine");
                clearItemFilters();
              }}
            >
              <Pill size={16} />
              Pharmacy
            </button>
            <button
              className={movementItemType === "product" ? "active" : ""}
              type="button"
              onClick={() => {
                setMovementItemType("product");
                clearItemFilters();
              }}
            >
              <Boxes size={16} />
              Mart
            </button>
          </div>
          <MobileDisclosure title="Filters" summary={filterSummary}>
          <div className="report-filters">
            <label>
              Start date
              <input
                type="date"
                value={movementStartDate}
                onChange={(event) => setMovementStartDate(event.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={movementEndDate}
                onChange={(event) => setMovementEndDate(event.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={movementType}
                onChange={(event) => setMovementType(event.target.value)}
              >
                <option value="">All types</option>
                {movementFilterOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {movementItemType === "medicine" ? "Brand" : "Product"}
              <input
                value={medicineFilter}
                onChange={(event) => setMedicineFilter(event.target.value)}
                placeholder={
                  movementItemType === "medicine"
                    ? "Brand name"
                    : "Product name"
                }
              />
            </label>
            {movementItemType === "medicine" && (
              <label>
                Generic
                <input
                  value={genericFilter}
                  onChange={(event) => setGenericFilter(event.target.value)}
                  placeholder="Generic name"
                />
              </label>
            )}
            <label>
              Category
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </MobileDisclosure>
        </>
      )}
      {report === "stock" && (
        <>
          <div className="report-mode-switch">
            <button
              className={stockItemType === "medicine" ? "active" : ""}
              type="button"
              onClick={() => {
                setStockItemType("medicine");
                clearItemFilters();
              }}
            >
              <Pill size={16} />
              Pharmacy
            </button>
            <button
              className={stockItemType === "product" ? "active" : ""}
              type="button"
              onClick={() => {
                setStockItemType("product");
                clearItemFilters();
              }}
            >
              <Boxes size={16} />
              Mart
            </button>
          </div>
          <MobileDisclosure title="Filters" summary={filterSummary}>
          <div className="report-filters">
            <label>
              {stockItemType === "medicine" ? "Brand" : "Product"}
              <input
                value={medicineFilter}
                onChange={(event) => setMedicineFilter(event.target.value)}
                placeholder={
                  stockItemType === "medicine"
                    ? "Brand name or SKU"
                    : "Product name or SKU"
                }
              />
            </label>
            {stockItemType === "medicine" && (
              <label>
                Generic
                <input
                  value={genericFilter}
                  onChange={(event) => setGenericFilter(event.target.value)}
                  placeholder="Generic name"
                />
              </label>
            )}
            <label>
              Category
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </MobileDisclosure>
          <div className="report-summary">
            <Archive size={16} />
            <strong>{number.format(stockQuantityTotal)}</strong>
            <span>
              {stockItemType === "medicine" ? "pharmacy units" : "mart units"}{" "}
              on hand / {money.format(stockCostTotal)} value
            </span>
          </div>
        </>
      )}
      {report === "supplier" && (
        <MobileDisclosure title="Filters" summary={filterSummary}>
          <div className="report-filters">
          <label>
            Supplier
            <select
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
            >
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.name}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date supplied
            <input
              type="date"
              value={supplierDate}
              onChange={(event) => setSupplierDate(event.target.value)}
            />
          </label>
        </div>
          </MobileDisclosure>
      )}
      {report === "movement" && (
        <div className="report-summary">
          <Archive size={16} />
          <strong>{number.format(movementUnitsMoved)}</strong>
          <span>
            units moved{categoryFilter ? ` in ${categoryFilter}` : ""} / net{" "}
            {number.format(movementQuantityTotal)} / POS sales value{" "}
            {money.format(movementSalesTotal)}
          </span>
        </div>
      )}
      <ReportTable rows={rows} />
      {(historyStatusLabel || canLoadMoreHistory) && (
        <div className="history-paging">
          {historyStatusLabel && <span>{historyStatusLabel}</span>}
          {canLoadMoreHistory && onLoadMoreHistory && (
            <button
              className="ghost-button"
              type="button"
              onClick={onLoadMoreHistory}
              disabled={historyLoading}
            >
              {historyLoading ? "Loading..." : historyLoadMoreLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
