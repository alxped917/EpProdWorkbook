import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { defaultCoverage, calculatePickSheet } from "../src/lib/coverage";
import { buildPickLines } from "../src/lib/pick-build";
import { planMaterialUpdate } from "../src/lib/inventory";
import { systemRoles } from "../src/lib/permissions";
import { defaultFieldMap, defaultStatusMap } from "../src/lib/builder-prime-map";
import { matchCrew } from "../src/lib/crew";
import { jobSearchText, nameKey } from "../src/lib/names";
import { addDaysISO, todayISO } from "../src/lib/dates";
import { round2 } from "../src/lib/format";
import { ensureAdmin, seedCore } from "../src/lib/seed-core";
import { resolveSeedPlan } from "../src/lib/seed-plan";

const prisma = new PrismaClient();
const today = todayISO("America/Chicago");

async function seedSample(password: string) {
  const reference = calculatePickSheet(
    {
      squareFeet: 707,
      verticalLf: 0,
      stairsLf: 0,
      flakeSize: "1/4",
      season: "summer",
      include: { moisture: false, gator: false, baseCd: false, topCd: false },
    },
    defaultCoverage(),
  );
  const expectLbs = (key: string, lbs: number) => {
    const line = reference.lines.find((item) => item.key === key);
    if (!line || line.lbs !== lbs) throw new Error(`Reference pick sheet failed for ${key}: ${line?.lbs}`);
  };
  expectLbs("FLAKE", 101);
  expectLbs("BASE_A", 26.7);
  expectLbs("BASE_B", 13.4);
  expectLbs("TOP_A", 34);
  expectLbs("TOP_B", 34);

  await prisma.notification.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.colorMap.deleteMany();
  await prisma.warehouseMatch.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.stockCount.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.jobMaterial.deleteMany();
  await prisma.jobPickLine.deleteMany();
  await prisma.inventoryContainer.deleteMany();
  await prisma.job.deleteMany();
  await prisma.stockBalance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.crewMember.deleteMany();
  await prisma.crew.deleteMany();
  await prisma.userWarehouse.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.workspaceConfig.deleteMany();

  const roles = new Map<string, string>();
  for (const role of systemRoles()) {
    const saved = await prisma.role.create({
      data: {
        name: role.name,
        description: role.description,
        isSystem: role.name !== "Auditor",
        permissions: JSON.stringify(role.permissions),
      },
    });
    roles.set(role.name, saved.id);
  }

  const passwordHash = hashSync(password, 10);
  const people: { key: string; name: string; email: string; role: string; all: boolean; phone: string }[] = [
    { key: "avery", name: "Avery Quinn", email: "avery.quinn@epoxy.example", role: "Admin", all: true, phone: "555-0100" },
    { key: "casey", name: "Casey Nguyen", email: "casey.nguyen@epoxy.example", role: "Team Lead", all: false, phone: "555-0101" },
    { key: "riley", name: "Riley Brooks", email: "riley.brooks@epoxy.example", role: "Team Lead", all: false, phone: "555-0102" },
    { key: "quinn", name: "Quinn Alvarez", email: "quinn.alvarez@epoxy.example", role: "Team Lead", all: false, phone: "555-0103" },
    { key: "morgan", name: "Morgan Hale", email: "morgan.hale@epoxy.example", role: "Installer", all: false, phone: "555-0104" },
    { key: "taylor", name: "Taylor Singh", email: "taylor.singh@epoxy.example", role: "Installer", all: false, phone: "555-0105" },
    { key: "jordan", name: "Jordan Ellis", email: "jordan.ellis@epoxy.example", role: "Installer", all: false, phone: "555-0106" },
    { key: "reese", name: "Reese Patel", email: "reese.patel@epoxy.example", role: "Warehouse", all: false, phone: "555-0107" },
    { key: "drew", name: "Drew Kim", email: "drew.kim@epoxy.example", role: "Warehouse", all: false, phone: "555-0108" },
    { key: "parker", name: "Parker Olsen", email: "parker.olsen@epoxy.example", role: "Office", all: true, phone: "555-0109" },
    { key: "samir", name: "Samir Cole", email: "samir.cole@epoxy.example", role: "Auditor", all: true, phone: "555-0110" },
  ];
  const users = new Map<string, { id: string; name: string }>();
  for (const person of people) {
    const saved = await prisma.user.create({
      data: {
        name: person.name,
        email: person.email,
        passwordHash,
        roleId: roles.get(person.role)!,
        allWarehouses: person.all,
        phone: person.phone,
      },
    });
    users.set(person.key, { id: saved.id, name: saved.name });
  }

  const whSeed = [
    { key: "phoenix", name: "Phoenix", address1: "1840 W Demo Yard Rd", city: "Phoenix", state: "AZ", postalCode: "85009", manager: "reese" },
    { key: "sioux", name: "Sioux Falls", address1: "2200 N Sample Industrial Ave", city: "Sioux Falls", state: "SD", postalCode: "57104", manager: "drew" },
    { key: "clark", name: "Clarkfield", address1: "15 Practice Shop Ln", city: "Clarkfield", state: "MN", postalCode: "56223", manager: "drew" },
    { key: "lake", name: "Lakeville", address1: "8800 Fake Quarry Blvd", city: "Lakeville", state: "MN", postalCode: "55044", manager: "drew" },
    { key: "cokato", name: "Cokato", address1: "410 Training Ct", city: "Cokato", state: "MN", postalCode: "55321", manager: "drew" },
    { key: "zimm", name: "Zimmerman", address1: "72 Mock Flake Dr", city: "Zimmerman", state: "MN", postalCode: "55398", manager: "drew" },
  ];
  const warehouses = new Map<string, { id: string; name: string }>();
  for (const row of whSeed) {
    const saved = await prisma.warehouse.create({
      data: {
        name: row.name,
        address1: row.address1,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        locationManagerId: users.get(row.manager)!.id,
        notes: "Sample ship-to. Not a real customer address.",
      },
    });
    warehouses.set(row.key, { id: saved.id, name: saved.name });
  }

  const assign: Record<string, string[]> = {
    casey: ["clark", "cokato", "zimm", "lake"],
    morgan: ["clark", "cokato", "zimm", "lake"],
    riley: ["lake", "phoenix"],
    taylor: ["lake", "phoenix"],
    quinn: ["sioux"],
    jordan: ["sioux"],
    reese: ["phoenix"],
    drew: ["sioux", "clark", "lake", "cokato", "zimm"],
  };
  for (const [person, keys] of Object.entries(assign)) {
    await prisma.userWarehouse.createMany({
      data: keys.map((key) => ({ userId: users.get(person)!.id, warehouseId: warehouses.get(key)!.id })),
    });
  }

  const crewDefs = [
    { name: "North crew", lead: "casey", members: ["casey", "morgan"] },
    { name: "Metro crew", lead: "riley", members: ["riley", "taylor"] },
    { name: "South crew", lead: "quinn", members: ["quinn", "jordan"] },
  ];
  const crewRows = [];
  for (const crew of crewDefs) {
    const saved = await prisma.crew.create({
      data: { name: crew.name, leadId: users.get(crew.lead)!.id },
    });
    await prisma.crewMember.createMany({
      data: crew.members.map((key) => ({ crewId: saved.id, userId: users.get(key)!.id })),
    });
    crewRows.push({
      id: saved.id,
      name: crew.name,
      leadName: users.get(crew.lead)!.name,
      memberNames: crew.members.map((key) => users.get(key)!.name),
    });
  }

  const resin = { vendorName: "Northstar Resin Supply", vendorEmail: "orders@northstar.example" };
  const flakeVendor = { vendorName: "Sample Flake Co.", vendorEmail: "orders@flakes.example" };
  const chemical = (
    name: string,
    componentKey: string,
    price: number,
    box: number,
    placeholder: boolean,
    extra: { reorderPointLbs?: number; orderUpToLbs?: number } = {},
  ) => ({
    name,
    category: "CHEMICAL",
    componentKey,
    pricePerLb: price,
    weightPerBox: box,
    priceIsPlaceholder: placeholder,
    ...resin,
    reorderPointLbs: extra.reorderPointLbs ?? 0,
    orderUpToLbs: extra.orderUpToLbs ?? 0,
  });
  const catalog = [
    chemical("Basecoat A", "BASE_A", 4.1, 48, false),
    chemical("Basecoat B", "BASE_B", 4.1, 52.5, false),
    chemical("Topcoat A", "TOP_A", 60, 40, false),
    chemical("Topcoat B", "TOP_B", 60, 40, false),
    chemical("Mender A", "MENDER_A", 12, 8, true),
    chemical("Mender B", "MENDER_B", 12, 8, true),
    chemical("Tracbite", "GATOR", 7.5, 40, true, { reorderPointLbs: 30, orderUpToLbs: 80 }),
    chemical("Moisture Barrier A", "MOISTURE_A", 5.5, 40, true),
    chemical("Moisture Barrier B", "MOISTURE_B", 5.5, 40, true),
    chemical("Basecoat C", "BASE_C", 4.1, 48, true),
    chemical("Basecoat D", "BASE_D", 4.1, 48, true),
    chemical("Topcoat C", "TOP_C", 60, 40, true),
    chemical("Topcoat D", "TOP_D", 60, 40, true),
    { name: "Crack Fill", category: "SUPPLY", componentKey: null, pricePerLb: 4.25, weightPerBox: 10, priceIsPlaceholder: true, ...resin, reorderPointLbs: 40, orderUpToLbs: 80 },
    ...["Cabin Fever", "Coyote", "Creekbed", "Dolorite", "Gravel", "Overcast", "Tidal Wave", "Quartz Grey", "Quartz Tan"].map((name) => ({
      name,
      category: "FLAKE",
      componentKey: null,
      pricePerLb: 2,
      weightPerBox: 40,
      priceIsPlaceholder: false,
      ...flakeVendor,
      reorderPointLbs: 40,
      orderUpToLbs: 160,
    })),
  ];
  const products = new Map<string, { id: string; name: string; category: string; componentKey: string | null; weightPerBox: number | null }>();
  for (const item of catalog) {
    const saved = await prisma.product.create({
      data: {
        name: item.name,
        nameKey: nameKey(item.name),
        category: item.category,
        componentKey: item.componentKey,
        pricePerLb: item.pricePerLb,
        weightPerBox: item.weightPerBox,
        priceIsPlaceholder: item.priceIsPlaceholder,
        vendorName: item.vendorName,
        vendorEmail: item.vendorEmail,
        reorderPointLbs: item.reorderPointLbs,
        orderUpToLbs: item.orderUpToLbs,
        notes: item.priceIsPlaceholder ? "Sample placeholder price. Edit before relying on job cost." : "",
      },
    });
    products.set(item.name, saved);
  }

  const coverage = defaultCoverage();
  for (const warehouse of warehouses.values()) coverage.locationFactors[warehouse.name] = 1;
  const componentMap: Record<string, string> = {};
  for (const product of products.values()) {
    if (product.componentKey) componentMap[product.componentKey] = product.id;
  }
  await prisma.workspaceConfig.create({
    data: {
      companyName: "Endless Poxybilities",
      timezone: "America/Chicago",
      coverageJson: JSON.stringify(coverage),
      componentMapJson: JSON.stringify(componentMap),
      bpSubdomain: "endlesspoxybilities",
      bpMode: "mock",
      bpImportStatuses: "Sold, Job Sold, Contract Signed",
      bpFieldMapJson: JSON.stringify(defaultFieldMap()),
      bpStatusMapJson: JSON.stringify(defaultStatusMap()),
      varianceTolerancePct: 5,
      winterMonths: "11,12,1,2,3",
    },
  });
  await prisma.colorMap.create({ data: { bpColorName: "midnight blue", productId: products.get("Tidal Wave")!.id } });
  await prisma.colorMap.create({ data: { bpColorName: "coyote", productId: products.get("Coyote")!.id } });
  for (const warehouse of warehouses.values()) {
    await prisma.warehouseMatch.create({ data: { bpLocation: warehouse.name.toLowerCase(), warehouseId: warehouse.id } });
  }
  await prisma.warehouseMatch.create({ data: { bpLocation: "phoenix yard", warehouseId: warehouses.get("phoenix")!.id } });

  const balances = new Map<string, number>();
  function openingLbs(productName: string, warehouseName: string) {
    if (productName === "Crack Fill" && warehouseName === "Lakeville") return { lbs: 8, shelf: 40 };
    if (productName === "Quartz Tan" && warehouseName === "Phoenix") return { lbs: 0, shelf: 40 };
    if (productName === "Tracbite" && warehouseName === "Sioux Falls") return { lbs: 12, shelf: 30 };
    if (productName.startsWith("Basecoat")) return { lbs: 480, shelf: 80 };
    if (productName.startsWith("Topcoat")) return { lbs: 300, shelf: 60 };
    if (productName.startsWith("Mender")) return { lbs: 60, shelf: 10 };
    if (productName === "Crack Fill") return { lbs: 50, shelf: 20 };
    if (productName === "Tracbite") return { lbs: 80, shelf: 20 };
    if (productName.startsWith("Moisture") || productName.endsWith(" C") || productName.endsWith(" D")) return { lbs: 80, shelf: 0 };
    return { lbs: 180, shelf: 40 };
  }
  for (const warehouse of warehouses.values()) {
    for (const product of products.values()) {
      const amount = openingLbs(product.name, warehouse.name);
      await prisma.stockBalance.create({
        data: { warehouseId: warehouse.id, productId: product.id, onHandLbs: amount.lbs, shelfMinLbs: amount.shelf },
      });
      if (amount.lbs > 0) {
        await prisma.inventoryTransaction.create({
          data: {
            productId: product.id,
            warehouseId: warehouse.id,
            event: "RECEIVED",
            weightChange: amount.lbs,
            newBalance: amount.lbs,
            userId: users.get("drew")!.id,
            note: "Opening balance",
            occurredAt: new Date(`${addDaysISO(today, -21)}T15:00:00.000Z`),
          },
        });
      }
      balances.set(`${warehouse.id}:${product.id}`, amount.lbs);
    }
  }

  const lake = warehouses.get("lake")!.id;
  const phoenix = warehouses.get("phoenix")!.id;
  const containers = [
    { barcode: "IS-DEMO0001-A001", product: "Basecoat A", warehouseId: lake, lbs: 48 },
    { barcode: "IS-DEMO0002-B001", product: "Basecoat B", warehouseId: lake, lbs: 52.5 },
    { barcode: "IS-DEMO0003-F001", product: "Cabin Fever", warehouseId: lake, lbs: 40 },
    { barcode: "IS-PHX0BASE-A001", product: "Basecoat A", warehouseId: phoenix, lbs: 48 },
    { barcode: "IS-PHX0FLAK-C001", product: "Coyote", warehouseId: phoenix, lbs: 40 },
  ];
  for (const container of containers) {
    const product = products.get(container.product)!;
    await prisma.inventoryContainer.create({
      data: {
        barcode: container.barcode,
        productId: product.id,
        warehouseId: container.warehouseId,
        remainingLbs: container.lbs,
        capacityLbs: container.lbs,
        status: "IN_STOCK",
      },
    });
  }

  async function weigh(input: { jobId: string; warehouseId: string; product: string; out: number; inn: number; userId: string; when: string }) {
    const product = products.get(input.product)!;
    const key = `${input.warehouseId}:${product.id}`;
    const onHand = balances.get(key) ?? 0;
    const existing = await prisma.jobMaterial.findUnique({ where: { jobId_productId: { jobId: input.jobId, productId: product.id } } });
    const plan = planMaterialUpdate({
      previousOut: existing?.lbsCheckedOut ?? 0,
      previousIn: existing?.lbsCheckedIn ?? 0,
      nextOut: input.out,
      nextIn: input.inn,
      onHand,
    });
    if (!plan.ok) throw new Error(`${plan.error} (${input.product})`);
    balances.set(key, plan.onHand);
    await prisma.stockBalance.update({
      where: { warehouseId_productId: { warehouseId: input.warehouseId, productId: product.id } },
      data: { onHandLbs: plan.onHand },
    });
    await prisma.jobMaterial.upsert({
      where: { jobId_productId: { jobId: input.jobId, productId: product.id } },
      update: { lbsCheckedOut: round2(input.out), lbsCheckedIn: round2(input.inn) },
      create: { jobId: input.jobId, productId: product.id, lbsCheckedOut: round2(input.out), lbsCheckedIn: round2(input.inn) },
    });
    for (const event of plan.events) {
      await prisma.inventoryTransaction.create({
        data: {
          occurredAt: new Date(input.when),
          productId: product.id,
          event: event.event,
          weightChange: event.weightChange,
          newBalance: event.newBalance,
          warehouseId: input.warehouseId,
          jobId: input.jobId,
          userId: input.userId,
          note: event.note,
        },
      });
    }
  }

  type JobSeed = {
    jobNumber: string;
    bp?: string;
    type?: string;
    status?: string;
    bpStatus?: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    salesperson?: string;
    foreman: string;
    warehouse: string;
    scheduled?: string | null;
    installed?: string | null;
    sqft?: number | null;
    color?: string;
    size?: string;
    season?: string;
    source?: string;
    archived?: boolean;
    companyCam?: string;
    checkout?: { product: string; out: number; inn: number }[];
    firstOut?: string;
  };

  const jobs: JobSeed[] = [
    { jobNumber: "EP-7070", bp: "900707", address1: "18 Fictional Oak St", city: "Lakeville", state: "MN", postalCode: "55044", foreman: "Casey Nguyen", warehouse: "lake", scheduled: today, sqft: 707, color: "Cabin Fever", companyCam: "https://companycam.example/projects/demo-7070" },
    { jobNumber: "EP-2401", bp: "900241", address1: "440 Sample Ridge Rd", city: "Phoenix", state: "AZ", postalCode: "85009", foreman: "Riley Brooks", warehouse: "phoenix", scheduled: today, sqft: 620, color: "Coyote", status: "IN_PROGRESS", bpStatus: "In Progress", checkout: [{ product: "Coyote", out: 70, inn: 0 }, { product: "Basecoat A", out: 20, inn: 0 }], firstOut: `${today}T14:00:00.000Z` },
    { jobNumber: "EP-2402", bp: "900242", address1: "9 Practice Ln", city: "Sioux Falls", state: "SD", postalCode: "57104", foreman: "Quinn Alvarez", warehouse: "sioux", scheduled: addDaysISO(today, 1), sqft: 480, color: "Gravel" },
    { jobNumber: "EP-2403", bp: "900243", address1: "15 Practice Shop Ln", city: "Clarkfield", state: "MN", postalCode: "56223", foreman: "Casey Nguyen", warehouse: "clark", scheduled: addDaysISO(today, 2), sqft: 900, color: "" },
    { jobNumber: "EP-2404", bp: "900244", address1: "8800 Fake Quarry Blvd", city: "Lakeville", state: "MN", postalCode: "55044", foreman: "Morgan Hale", warehouse: "lake", scheduled: addDaysISO(today, 2), sqft: null, color: "Cabin Fever" },
    { jobNumber: "EP-2405", bp: "900245", address1: "410 Training Ct", city: "Cokato", state: "MN", postalCode: "55321", foreman: "Morgan Hale", warehouse: "cokato", scheduled: addDaysISO(today, -8), installed: addDaysISO(today, -6), sqft: 500, color: "Creekbed", status: "COMPLETED", bpStatus: "Complete", checkout: [{ product: "Creekbed", out: 80, inn: 6 }, { product: "Basecoat A", out: 19, inn: 1 }, { product: "Basecoat B", out: 10, inn: 0.5 }, { product: "Topcoat A", out: 24, inn: 0 }, { product: "Topcoat B", out: 24, inn: 1 }], firstOut: `${addDaysISO(today, -8)}T15:00:00.000Z` },
    { jobNumber: "EP-2406", bp: "900246", type: "REPAIR", address1: "72 Mock Flake Dr", city: "Zimmerman", state: "MN", postalCode: "55398", foreman: "Casey Nguyen", warehouse: "zimm", scheduled: today, sqft: 220, color: "Overcast", size: "1/8", status: "IN_PROGRESS", checkout: [{ product: "Overcast", out: 18, inn: 2 }], firstOut: `${today}T13:30:00.000Z` },
    { jobNumber: "EP-2407", bp: "900247", address1: "100 Cancelled Ct", city: "Phoenix", state: "AZ", postalCode: "85009", foreman: "Riley Brooks", warehouse: "phoenix", scheduled: addDaysISO(today, 5), sqft: 300, color: "Tidal Wave", status: "CANCELLED", bpStatus: "Cancelled" },
    { jobNumber: "EP-2408", bp: "900248", address1: "4 Archive Ave", city: "Sioux Falls", state: "SD", postalCode: "57104", foreman: "Quinn Alvarez", warehouse: "sioux", scheduled: addDaysISO(today, -30), installed: addDaysISO(today, -28), sqft: 410, color: "Dolorite", status: "COMPLETED", archived: true },
    { jobNumber: "EP-2409", bp: "900249", address1: "77 Empty Shelf Rd", city: "Phoenix", state: "AZ", postalCode: "85009", foreman: "Taylor Singh", warehouse: "phoenix", scheduled: addDaysISO(today, 8), sqft: 400, color: "Quartz Tan" },
    { jobNumber: "EP-2410", bp: "900250", address1: "12 Wide Floor Blvd", city: "Lakeville", state: "MN", postalCode: "55044", foreman: "Riley Brooks", warehouse: "lake", scheduled: addDaysISO(today, 12), sqft: 1800, color: "Quartz Grey" },
    { jobNumber: "EP-2411", bp: "900251", address1: "3 Chip Ln", city: "Clarkfield", state: "MN", postalCode: "56223", foreman: "Morgan Hale", warehouse: "clark", scheduled: addDaysISO(today, 3), sqft: 640, color: "Creekbed", size: "1/16" },
    { jobNumber: "EP-2412", bp: "900252", address1: "90 Future St", city: "Sioux Falls", state: "SD", postalCode: "57104", foreman: "Jordan Ellis", warehouse: "sioux", scheduled: addDaysISO(today, 21), sqft: 760, color: "Tidal Wave" },
    { jobNumber: "EP-3106", bp: "910106", address1: "Old address to be replaced", city: "Clarkfield", state: "MN", postalCode: "56223", foreman: "Casey Nguyen", warehouse: "clark", scheduled: addDaysISO(today, 4), sqft: null, color: "", bpStatus: "Sold", source: "BUILDER_PRIME" },
  ];

  const productList = [...products.values()];
  for (const job of jobs) {
    const warehouse = warehouses.get(job.warehouse)!;
    const crew = matchCrew(job.foreman, crewRows);
    const created = await prisma.job.create({
      data: {
        jobNumber: job.jobNumber,
        builderPrimeProjectId: job.bp,
        type: job.type ?? "STANDARD",
        status: job.status ?? "NEW",
        builderPrimeStatus: job.bpStatus ?? "Sold",
        address1: job.address1,
        city: job.city,
        state: job.state,
        postalCode: job.postalCode,
        salesperson: job.salesperson ?? "Parker Olsen",
        foreman: job.foreman,
        warehouseId: warehouse.id,
        crewId: crew?.id,
        scheduledDate: job.scheduled,
        installedDate: job.installed,
        squareFootage: job.sqft ?? null,
        flakeColor: job.color ?? "",
        flakeSize: job.size ?? "1/4",
        season: job.season ?? "summer",
        source: job.source ?? "BUILDER_PRIME",
        companyCamUrl: job.companyCam ?? "",
        archivedAt: job.archived ? new Date() : null,
        firstCheckoutAt: job.firstOut ? new Date(job.firstOut) : null,
        bpSyncedAt: new Date(`${addDaysISO(today, -2)}T16:00:00.000Z`),
        searchText: jobSearchText([job.jobNumber, job.bp, job.address1, job.city, job.state, job.foreman, "Parker Olsen", job.color, job.bpStatus]),
      },
    });
    if (job.sqft && job.sqft > 0) {
      const lines = buildPickLines({
        squareFeet: job.sqft,
        verticalLf: 0,
        stairsLf: 0,
        flakeSize: (job.size as "1/4" | "1/8" | "1/16") ?? "1/4",
        season: "summer",
        warehouseName: warehouse.name,
        include: { moisture: false, gator: false, baseCd: false, topCd: false },
        flakeColor: job.color ?? "",
        products: productList,
        componentMap,
        coverage,
      });
      for (const line of lines) {
        await prisma.jobPickLine.create({
          data: { jobId: created.id, componentKey: line.key, productId: line.productId, plannedLbs: line.lbs },
        });
        if (line.productId) {
          await prisma.jobMaterial.create({ data: { jobId: created.id, productId: line.productId } });
        }
      }
    }
    for (const move of job.checkout ?? []) {
      await weigh({
        jobId: created.id,
        warehouseId: warehouse.id,
        product: move.product,
        out: move.out,
        inn: move.inn,
        userId: users.get(job.foreman === "Riley Brooks" ? "riley" : job.foreman === "Morgan Hale" ? "morgan" : "casey")!.id,
        when: job.firstOut ?? `${today}T15:00:00.000Z`,
      });
    }
  }

  const demo = await prisma.jobPickLine.findMany({ where: { job: { jobNumber: "EP-7070" } } });
  const byKey = Object.fromEntries(demo.map((line) => [line.componentKey, line.plannedLbs]));
  if (byKey.FLAKE !== 101 || byKey.BASE_A !== 26.7 || byKey.BASE_B !== 13.4 || byKey.TOP_A !== 34 || byKey.TOP_B !== 34) {
    throw new Error(`EP-7070 pick sheet did not match the reference: ${JSON.stringify(byKey)}`);
  }

  await prisma.notification.create({
    data: {
      kind: "LOW_STOCK",
      subject: "Low stock: Crack Fill at Lakeville",
      body: "Crack Fill at Lakeville is down to 8 lb. The shelf minimum is 40 lb. Email delivery is not configured, so this notice is stored in the outbox.",
      status: "SKIPPED_NO_SMTP",
    },
  });
  await prisma.syncLog.create({
    data: {
      trigger: "MANUAL",
      mode: "mock",
      status: "SUCCESS",
      finishedAt: new Date(),
      message: "Seeded sample history. Use Sync Jobs to import the mock sold projects.",
      createdCount: 0,
      updatedCount: 0,
    },
  });
  await prisma.auditEvent.create({
    data: {
      userId: users.get("avery")!.id,
      userName: "Avery Quinn",
      action: "seed",
      entityType: "workspace",
      summary: "Loaded sample warehouses, products, crews, and jobs.",
    },
  });

  console.log(`Seeded sample data. Sign in as avery.quinn@epoxy.example with password ${password}.`);
  console.log("Demo job EP-7070 is 707 sq ft at Lakeville. Scan IS-DEMO0001-A001, IS-DEMO0002-B001, or IS-DEMO0003-F001.");
}

async function main() {
  const plan = resolveSeedPlan(process.env);
  if (!plan.ok) throw new Error(plan.error);
  if (!plan.production) {
    if (!plan.sample) {
      await seedCore(prisma);
      console.log("Seeded master data only (SEED_SAMPLE_DATA=false).");
      return;
    }
    await seedSample(plan.samplePassword);
    return;
  }
  const users = await prisma.user.count();
  const jobs = await prisma.job.count();
  if (plan.sample && users === 0 && jobs === 0) {
    await seedSample(plan.samplePassword);
  } else {
    await seedCore(prisma);
  }
  const admin = await ensureAdmin(prisma, plan);
  console.log(admin.created ? `Created admin ${admin.email}` : `Admin ${admin.email} already exists. Password was left unchanged.`);
  if (!plan.sample) console.log("Sample jobs were not loaded. Set SEED_SAMPLE_DATA=true before the first setup if you want them.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
