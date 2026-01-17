import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CONTROL_SUMMARY_COLUMNS,
  type ControlSummaryRow,
} from "@/lib/reporting";

interface ControlSummaryTableProps {
  rows: ControlSummaryRow[];
}

const ControlSummaryTable = ({ rows }: ControlSummaryTableProps) => {
  return (
    <div className="rounded-xl border border-border bg-card shadow-md">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-lg font-semibold text-foreground">
          Resumen de control
        </h3>
        <p className="text-sm text-muted-foreground">
          Columnas definidas para validar la operación.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {CONTROL_SUMMARY_COLUMNS.map((column) => (
              <TableHead key={column} className="font-semibold">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="font-medium text-muted-foreground">
                {row.label}
              </TableCell>
              <TableCell className="text-right font-semibold text-foreground">
                {row.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ControlSummaryTable;
