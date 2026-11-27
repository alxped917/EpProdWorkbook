import { importProducts, mergeProducts, saveProduct } from "@/actions/catalog";
import { Flash, PageHeader, inputClass, labelClass } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { one } from "@/lib/search";
import { findDuplicatePairs } from "@/lib/duplicates";
import { money } from "@/lib/format";
import { COMPONENT_KEYS } from "@/lib/coverage";

export const metadata = { title: "Master data" };

export default async function MasterDataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePerm("masterData", "view");
  const sp = await searchParams;
  const tab = one(sp.tab) || "CHEMICAL";
  const q = one(sp.q).toLowerCase();
  const products = await db.product.findMany({ orderBy: { name: "asc" } });
  const visible = products.filter((p) => p.category === tab && (!q || p.name.toLowerCase().includes(q)));
  const dupes = findDuplicatePairs(products.map((p) => ({ id: p.id, name: p.name })));
  const editable = can(user.permissions, "masterData", "edit");
  return (
    <div>
      <PageHeader
        title="Master data"
        subtitle="Chemicals, supplies, and flake colors. Prices marked sample were not supplied by the shop and should be edited before job cost is trusted."
        actions={<a className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm" href="/api/exports/master-data">Export CSV</a>}
      />
      <Flash notice={one(sp.notice)} error={one(sp.error)} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["CHEMICAL", "Chemicals"], ["SUPPLY", "Supplies"], ["FLAKE", "Colors & Finishes"]].map(([key, label]) => (
          <a key={key} className={`rounded-full px-3 py-1 text-sm ${tab === key ? "bg-accent text-accent-ink" : "border border-line"}`} href={`/master-data?tab=${key}&q=${encodeURIComponent(q)}`}>{label}</a>
        ))}
      </div>
      <form className="mb-4 flex gap-2" action="/master-data">
        <input type="hidden" name="tab" value={tab} />
        <input className={inputClass} name="q" defaultValue={one(sp.q)} placeholder="Search products" aria-label="Search products" />
        <button className="min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">Search</button>
      </form>
      {dupes.length ? (
        <div className="mb-4 rounded-2xl border border-danger/40 p-4 text-sm">
          <p className="font-medium">Possible duplicates</p>
          <ul className="mt-2 space-y-1">
            {dupes.map((pair) => (
              <li key={`${pair.a}-${pair.b}`}>{products.find((p) => p.id === pair.a)?.name} and {products.find((p) => p.id === pair.b)?.name} — {pair.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-2">
        {visible.map((product) => (
          <details key={product.id} className="rounded-2xl border border-line bg-panel p-3">
            <summary className="cursor-pointer">
              <span className="font-medium">{product.name}</span>
              <span className="ml-2 text-sm text-muted">{money(product.pricePerLb)}/lb · {product.weightPerBox ? `${product.weightPerBox} lb box` : "no box weight"} · {product.status}{product.priceIsPlaceholder ? " · sample price" : ""}</span>
            </summary>
            {editable ? <ProductForm product={product} /> : null}
          </details>
        ))}
      </div>
      {editable ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form action={saveProduct} className="rounded-2xl border border-line p-4">
            <h2 className="font-semibold">Add product</h2>
            <ProductFields category={tab} />
            <button className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Add</button>
          </form>
          <div className="space-y-4">
            <form action={importProducts} className="rounded-2xl border border-line p-4">
              <h2 className="font-semibold">CSV import</h2>
              <p className="mt-1 text-sm text-muted">Columns: name, category, pricePerLb, weightPerBox, status. Matching names update the existing product.</p>
              <input className="mt-3 block w-full text-sm" type="file" name="file" accept=".csv,text/csv" required />
              <button className="mt-3 min-h-11 rounded-xl border border-line px-4 text-sm" type="submit">Import</button>
            </form>
            <form action={mergeProducts} className="rounded-2xl border border-line p-4">
              <h2 className="font-semibold">Merge duplicates</h2>
              <p className="mt-1 text-sm text-muted">Stock, job lines, and history move onto the product you keep.</p>
              <label className="mt-3 block text-sm">Keep<select className={inputClass} name="keepId">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="mt-3 block text-sm">Merge away<select className={inputClass} name="dropId">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <button className="mt-3 min-h-11 rounded-xl bg-danger px-4 text-sm text-white" type="submit">Merge</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductFields({
  product,
  category,
}: {
  product?: {
    id: string;
    name: string;
    category: string;
    pricePerLb: number;
    priceIsPlaceholder: boolean;
    weightPerBox: number | null;
    status: string;
    vendorName: string;
    vendorEmail: string;
    reorderPointLbs: number;
    orderUpToLbs: number;
    notes: string;
    componentKey: string | null;
  };
  category?: string;
}) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <label className="block md:col-span-2"><span className={labelClass}>Name</span><input className={inputClass} name="name" defaultValue={product?.name} required /></label>
      <label className="block"><span className={labelClass}>Category</span>
        <select className={inputClass} name="category" defaultValue={product?.category ?? category}>
          <option value="CHEMICAL">Chemical</option>
          <option value="SUPPLY">Supply</option>
          <option value="FLAKE">Color & finish</option>
        </select>
      </label>
      <label className="block"><span className={labelClass}>Status</span>
        <select className={inputClass} name="status" defaultValue={product?.status ?? "ACTIVE"}><option>ACTIVE</option><option>INACTIVE</option></select>
      </label>
      <label className="block"><span className={labelClass}>Price per lb</span><input className={inputClass} name="pricePerLb" defaultValue={product?.pricePerLb ?? ""} required /></label>
      <label className="block"><span className={labelClass}>Weight per box</span><input className={inputClass} name="weightPerBox" defaultValue={product?.weightPerBox ?? ""} /></label>
      <label className="block"><span className={labelClass}>Pick-sheet component</span>
        <select className={inputClass} name="componentKey" defaultValue={product?.componentKey ?? ""}>
          <option value="">None</option>
          {COMPONENT_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="priceIsPlaceholder" defaultChecked={product?.priceIsPlaceholder} /> Sample price</label>
      <label className="block"><span className={labelClass}>Vendor</span><input className={inputClass} name="vendorName" defaultValue={product?.vendorName} /></label>
      <label className="block"><span className={labelClass}>Vendor email</span><input className={inputClass} name="vendorEmail" defaultValue={product?.vendorEmail} /></label>
      <label className="block"><span className={labelClass}>Reorder point (lb)</span><input className={inputClass} name="reorderPointLbs" defaultValue={product?.reorderPointLbs ?? 0} /></label>
      <label className="block"><span className={labelClass}>Order up to (lb)</span><input className={inputClass} name="orderUpToLbs" defaultValue={product?.orderUpToLbs ?? 0} /></label>
      <label className="block md:col-span-2"><span className={labelClass}>Notes</span><textarea className={inputClass} name="notes" defaultValue={product?.notes} rows={2} /></label>
    </div>
  );
}

function ProductForm({ product }: { product: Parameters<typeof ProductFields>[0]["product"] }) {
  return (
    <form action={saveProduct}>
      <ProductFields product={product} />
      <button className="mt-3 min-h-11 rounded-xl bg-accent px-4 text-sm text-accent-ink" type="submit">Save product</button>
    </form>
  );
}
