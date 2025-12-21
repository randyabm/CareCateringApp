'use client';

import { FileText, Download } from 'lucide-react';

type ExportColumn<T> = {
    label: string;
    accessor: (row: T) => string | number | null | undefined;
};

type ExportControlsProps<T> = {
    title: string;
    filename: string;
    columns: ExportColumn<T>[];
    data: T[];
};

function exportToCSV<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
    const headers = columns.map(c => `"${c.label}"`).join(',');
    const body = rows
        .map(row =>
            columns
                .map(c => {
                    const value = c.accessor(row);
                    const safe = value === null || value === undefined ? '' : String(value);
                    return `"${safe.replace(/"/g, '""')}"`;
                })
                .join(',')
        )
        .join('\n');

    const csvContent = [headers, body].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportToPDF<T>(title: string, filename: string, columns: ExportColumn<T>[], rows: T[]) {
    const headerRow = columns.map(c => `<th style="text-align:left;padding:8px;">${c.label}</th>`).join('');
    const bodyRows = rows
        .map(
            row =>
                `<tr>${columns
                    .map(c => `<td style="padding:6px 8px;border-top:1px solid #e2e8f0;">${c.accessor(row) ?? ''}</td>`)
                    .join('')}</tr>`
        )
        .join('');

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 20px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead><tr>${headerRow}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();

    // Note: users can choose "Save as PDF" from the print dialog.
}

export function ExportControls<T>({ title, filename, columns, data }: ExportControlsProps<T>) {
    const handleCSV = () => exportToCSV(filename, columns, data);
    const handlePDF = () => exportToPDF(title, filename, columns, data);

    return (
        <div className="flex gap-2">
            <button
                onClick={handleCSV}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
                <Download className="h-4 w-4" />
                Export CSV
            </button>
            <button
                onClick={handlePDF}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
                <FileText className="h-4 w-4" />
                Export PDF
            </button>
        </div>
    );
}

