'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: T[keyof T], row: T, index: number) => React.ReactNode;
  exportValue?: (value: T[keyof T], row: T) => string;
}

export interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  exportable?: boolean;
  refreshable?: boolean;
  onRefresh?: () => Promise<void>;
  onRowClick?: (row: T, index: number) => void;
  rowActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
  stickyHeader?: boolean;
  striped?: boolean;
  compact?: boolean;
  className?: string;
}

// ─── Status Badge Component ───────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  };

  const style = styles[status.toLowerCase()] || styles.inactive;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
// ─── DataTable Component ──────────────────────────────────────────────────────

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = 'Search...',
  exportable = false,
  refreshable = false,
  onRefresh,
  onRowClick,
  rowActions,
  emptyMessage = 'No data found',
  loading = false,
  stickyHeader = false,
  striped = true,
  compact = false,
  className = '',
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Search filtering ─────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    const searchableKeys = columns.filter(c => c.filterable !== false).map(c => c.key);
    return data.filter(row =>
      searchableKeys.some(key => {
        const val = row[key];
        if (val == null) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  }, [data, searchQuery, columns]);

  // ── Sorting ─────────────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal));
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filteredData, sortKey, sortDir]);

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  }, [sortKey, sortDir]);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try { await onRefresh(); } finally { setIsRefreshing(false); }
  }, [onRefresh]);

  const handleExport = useCallback(() => {
    const headers = columns.map(c => c.header).join(',');
    const rows = sortedData.map(row =>
      columns.map(col => {
        const val = col.exportValue ? col.exportValue(row[col.key], row) : String(row[col.key] ?? '');
        return val.includes(',') ? `"${val}"` : val;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedData, columns]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    return sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';
  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950 ${className}`}>
      {/* Toolbar */}
      {(searchable || exportable || refreshable) && (
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-gray-300 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            {refreshable && (
              <button onClick={handleRefresh} disabled={isRefreshing} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
            {exportable && (
              <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <Download className="h-4 w-4" />
                Export
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
              {columns.map(col => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`${cellPadding} text-${col.align || 'left'} font-medium text-gray-600 dark:text-gray-400 ${col.sortable !== false ? 'cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-200' : ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable !== false && <SortIcon columnKey={col.key} />}
                  </div>
                </th>
              ))}
              {rowActions && <th className={`${cellPadding} w-12`} />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + (rowActions ? 1 : 0)} className="py-12 text-center text-gray-500">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                <p className="mt-2">Loading...</p>
              </td></tr>
            ) : paginatedData.length === 0 ? (
              <tr><td colSpan={columns.length + (rowActions ? 1 : 0)} className="py-12 text-center text-gray-500">
                {emptyMessage}
              </td></tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(row, idx)}
                  className={`border-b border-gray-100 transition-colors dark:border-gray-800/50 ${onRowClick ? 'cursor-pointer' : ''} ${striped && idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-900/30' : ''} hover:bg-blue-50/50 dark:hover:bg-blue-950/20`}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`${cellPadding} text-${col.align || 'left'} text-gray-900 dark:text-gray-100`}>
                      {col.render ? col.render(row[col.key], row, idx) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                  {rowActions && (
                    <td className={`${cellPadding} text-right`}>{rowActions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
            {searchQuery && ` (filtered from ${data.length})`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) page = i + 1;
              else if (currentPage <= 3) page = i + 1;
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
              else page = currentPage - 2 + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
