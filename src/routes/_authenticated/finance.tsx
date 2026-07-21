import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";

export const Route = createFileRoute("/_authenticated/finance")({ component: Finance });

const TYPES = ["asset", "liability", "income", "expense", "equity"];

function Finance() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [jes, setJes] = useState<any[]>([]);
  const [openAcc, setOpenAcc] = useState(false);
  const [openTxn, setOpenTxn] = useState(false);
  const [accForm, setAccForm] = useState({ code: "", name: "", type: "asset" });
  const [txnForm, setTxnForm] = useState({ type: "income", category: "", amount: 0, description: "", account_id: "" });

  async function load() {
    const [a, t, j] = await Promise.all([
      (supabase as any).from("accounts").select("*").order("code"),
      (supabase as any).from("transactions").select("*").order("txn_date", { ascending: false }).limit(100),
      (supabase as any).from("journal_entries").select("*").order("entry_date", { ascending: false }).limit(100),
    ]);
    setAccounts(a.data ?? []); setTxns(t.data ?? []); setJes(j.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function createAcc() {
    if (!accForm.code || !accForm.name) return toast.error("Code & name required");
    const { error } = await (supabase as any).from("accounts").insert(accForm as any);
    if (error) return toast.error(error.message);
    toast.success("Account added"); setOpenAcc(false);
    setAccForm({ code: "", name: "", type: "asset" });
    load();
  }

  async function createTxn() {
    if (!txnForm.amount) return toast.error("Amount required");
    const { error } = await (supabase as any).from("transactions").insert({ ...txnForm, account_id: txnForm.account_id || null, created_by: user?.id } as any);
    if (error) return toast.error(error.message);
    if (txnForm.account_id) {
      const dr = txnForm.type === "expense" || txnForm.type === "asset_purchase" ? txnForm.amount : 0;
      const cr = txnForm.type === "income" || txnForm.type === "revenue" ? txnForm.amount : 0;
      await (supabase as any).from("journal_entries").insert({ account_id: txnForm.account_id, debit: dr, credit: cr, description: txnForm.description, created_by: user?.id } as any);
    }
    toast.success("Transaction recorded"); setOpenTxn(false);
    setTxnForm({ type: "income", category: "", amount: 0, description: "", account_id: "" });
    load();
  }

  async function removeTxn(id: string) {
    const { error } = await (supabase as any).from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Transaction deleted"); load();
  }

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filteredTxns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = from ? new Date(from).getTime() : null;
    const toT = to ? new Date(to).getTime() + 86_400_000 - 1 : null;
    return txns.filter((t) => {
      const d = new Date(t.txn_date).getTime();
      if (fromT && d < fromT) return false;
      if (toT && d > toT) return false;
      if (!q) return true;
      return `${t.category ?? ""} ${t.description ?? ""} ${t.type ?? ""}`.toLowerCase().includes(q);
    });
  }, [txns, search, from, to]);

  const totalIncome = filteredTxns.filter((t) => t.type === "income" || t.type === "revenue").reduce((s, t) => s + +t.amount, 0);
  const totalExpense = filteredTxns.filter((t) => t.type === "expense").reduce((s, t) => s + +t.amount, 0);
  const profit = totalIncome - totalExpense;

  // Trial balance
  const trial = accounts.map((a) => {
    const dr = jes.filter((j) => j.account_id === a.id).reduce((s, j) => s + +j.debit, 0);
    const cr = jes.filter((j) => j.account_id === a.id).reduce((s, j) => s + +j.credit, 0);
    return { ...a, debit: dr, credit: cr, balance: dr - cr };
  }).filter((a) => a.debit > 0 || a.credit > 0);

  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Landmark className="size-6 text-primary" /> Finance & Accounting</h1>
          <p className="text-sm text-muted-foreground">Chart of accounts, transactions, ledger.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" /> Total Income</div><div className="text-2xl font-semibold text-emerald-600">{fmtINR(totalIncome)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="size-3" /> Total Expense</div><div className="text-2xl font-semibold text-rose-600">{fmtINR(totalExpense)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Net Profit</div><div className={`text-2xl font-semibold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmtINR(profit)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Accounts</div><div className="text-2xl font-semibold">{accounts.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="txns">
        <TabsList>
          <TabsTrigger value="txns">Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="ledger">Ledger / Trial Balance</TabsTrigger>
          <TabsTrigger value="pl">P&amp;L</TabsTrigger>
        </TabsList>

        <TabsContent value="txns">
          <Card>
            <CardHeader className="flex flex-row justify-between"><CardTitle>Transactions</CardTitle>
              <Dialog open={openTxn} onOpenChange={setOpenTxn}>
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New Transaction</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record Transaction</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Type</Label>
                        <Select value={txnForm.type} onValueChange={(v) => setTxnForm({ ...txnForm, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="vendor_payment">Vendor Payment</SelectItem>
                            <SelectItem value="salary">Salary</SelectItem>
                            <SelectItem value="insurance_settlement">Insurance Settlement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Amount</Label><Input type="number" value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: Number(e.target.value) })} /></div>
                    </div>
                    <div><Label>Category</Label><Input value={txnForm.category} onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })} /></div>
                    <div><Label>Account</Label>
                      <Select value={txnForm.account_id} onValueChange={(v) => setTxnForm({ ...txnForm, account_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Description</Label><Input value={txnForm.description} onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={createTxn}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{format(new Date(t.txn_date), "dd MMM")}</TableCell>
                      <TableCell><Badge variant={t.type === "income" || t.type === "revenue" ? "default" : "secondary"}>{t.type}</Badge></TableCell>
                      <TableCell>{t.category ?? "—"}</TableCell>
                      <TableCell>{t.description ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{accMap[t.account_id]?.code ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtINR(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card>
            <CardHeader className="flex flex-row justify-between"><CardTitle>Chart of Accounts</CardTitle>
              <Dialog open={openAcc} onOpenChange={setOpenAcc}>
                <DialogTrigger asChild><Button size="sm"><Plus className="size-4" /> New Account</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Code</Label><Input value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} /></div>
                    <div><Label>Name</Label><Input value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} /></div>
                    <div><Label>Type</Label>
                      <Select value={accForm.type} onValueChange={(v) => setAccForm({ ...accForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={createAcc}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.code}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell><Badge variant="outline">{a.type}</Badge></TableCell>
                      <TableCell>{a.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader><CardTitle>Trial Balance</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {trial.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell><span className="font-mono text-xs mr-2">{a.code}</span>{a.name}</TableCell>
                      <TableCell className="text-right">{fmtINR(a.debit)}</TableCell>
                      <TableCell className="text-right">{fmtINR(a.credit)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtINR(a.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {trial.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No journal entries</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pl">
          <Card>
            <CardHeader><CardTitle>Profit &amp; Loss Statement</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-2">Income</div>
                <div className="flex justify-between border-b pb-1"><span>Total Income</span><span className="text-emerald-600 font-semibold">{fmtINR(totalIncome)}</span></div>
              </div>
              <div>
                <div className="text-sm font-semibold text-muted-foreground mb-2">Expenses</div>
                <div className="flex justify-between border-b pb-1"><span>Total Expenses</span><span className="text-rose-600 font-semibold">{fmtINR(totalExpense)}</span></div>
              </div>
              <div className="pt-2 border-t-2 flex justify-between text-lg font-bold"><span>Net Profit / Loss</span><span className={profit >= 0 ? "text-emerald-600" : "text-rose-600"}>{fmtINR(profit)}</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
