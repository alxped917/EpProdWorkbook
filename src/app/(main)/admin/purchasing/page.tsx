import { generatePurchaseOrders } from "@/actions/admin";
import { Flash, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { one } from "@/lib/search";
import { displayDateTime } from "@/lib/dates";
import { getWorkspace } from "@/lib/workspace";
import { lbs, money } from "@/lib/format";

export const metadata = { title: "Purchasing" };

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePerm("admin", "edit");
  const sp = await searchParams;
  const workspace = await getWorkspace();
  const [orders, notes] = await Promise.all([
    db.purchaseOrder.findMany({ include: { lines: { include: { product: true, warehouse: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return (
    <div>
      <PageHeader title="Purchasing" subtitle="Drafts a purchase order when on-hand stock is at or below the reorder point or shelf minimum. Email is stored in the outbox and is not sent." />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <form action={generatePurchaseOrders}>
        <button className="min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Generate purchase orders</button>
      </form>
      <div className="mt-6 space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-2xl border border-line p-4 text-sm">
            <h2 className="font-semibold">{order.number} · {order.vendorName} · {order.status}</h2>
            <p className="text-muted">{order.vendorEmail || "No vendor email"} · {displayDateTime(order.createdAt, workspace.timezone)}</p>
            <ul className="mt-2">
              {order.lines.map((line) => (
                <li key={line.id}>{line.product.name}{line.warehouse ? ` @ ${line.warehouse.name}` : ""} — {lbs(line.lbs)} · {money(line.unitPrice)}/lb</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Notification outbox</h2>
      <ul className="space-y-2 text-sm">
        {notes.map((note) => (
          <li key={note.id} className="rounded-xl border border-line p-3">
            <p className="font-medium">{note.subject}</p>
            <p className="text-muted">{note.kind} · {note.status} · {note.toAddress}</p>
            <pre className="mt-1 whitespace-pre-wrap text-xs">{note.body}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
