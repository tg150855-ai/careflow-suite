import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReactNode } from "react";

export type Col<T> = { header: string; cell: (r: T) => ReactNode; className?: string };

export function SimpleTable<T extends { id: string }>({ rows, columns, empty = "No records yet." }: { rows: T[]; columns: Col<T>[]; empty?: string }) {
  if (rows.length === 0) {
    return (
      <Card><CardContent className="pt-10 pb-10 text-center text-sm text-muted-foreground">{empty}</CardContent></Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>{columns.map((c, i) => <TableHead key={i} className={c.className}>{c.header}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                {columns.map((c, i) => <TableCell key={i} className={c.className}>{c.cell(r)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
