import { AmortizationRow, formatCurrency } from "@/lib/loanCalculations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AmortizationTableProps {
  data: AmortizationRow[];
}

const AmortizationTable = ({ data }: AmortizationTableProps) => {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-md">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-lg font-semibold text-foreground">
          Tabla de Amortización
        </h3>
        <p className="text-sm text-muted-foreground">
          Desglose mensual de tu crédito
        </p>
      </div>
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-20 text-center font-semibold">Mes</TableHead>
              <TableHead className="text-right font-semibold">Pago</TableHead>
              <TableHead className="text-right font-semibold">Capital</TableHead>
              <TableHead className="text-right font-semibold">Interés</TableHead>
              <TableHead className="text-right font-semibold">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow
                key={row.month}
                className="transition-colors hover:bg-muted/50"
              >
                <TableCell className="text-center font-medium">
                  {row.month}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.payment)}
                </TableCell>
                <TableCell className="text-right text-secondary">
                  {formatCurrency(row.principal)}
                </TableCell>
                <TableCell className="text-right text-accent">
                  {formatCurrency(row.interest)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(row.balance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};

export default AmortizationTable;
