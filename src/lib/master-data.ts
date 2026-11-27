export type CatalogItem = {
  name: string;
  category: "CHEMICAL" | "SUPPLY" | "FLAKE";
  componentKey: string | null;
  pricePerLb: number;
  weightPerBox: number;
  priceIsPlaceholder: boolean;
  vendorName: string;
  vendorEmail: string;
  reorderPointLbs: number;
  orderUpToLbs: number;
};

export type WarehouseSeed = {
  key: string;
  name: string;
  city: string;
  state: string;
  postalCode: string;
  sampleAddress: string;
};

const resin = { vendorName: "Northstar Resin Supply", vendorEmail: "orders@northstar.example" };
const flakeVendor = { vendorName: "Sample Flake Co.", vendorEmail: "orders@flakes.example" };

function chemical(
  name: string,
  componentKey: string,
  price: number,
  box: number,
  placeholder: boolean,
  extra: { reorderPointLbs?: number; orderUpToLbs?: number } = {},
): CatalogItem {
  return {
    name,
    category: "CHEMICAL",
    componentKey,
    pricePerLb: price,
    weightPerBox: box,
    priceIsPlaceholder: placeholder,
    ...resin,
    reorderPointLbs: extra.reorderPointLbs ?? 0,
    orderUpToLbs: extra.orderUpToLbs ?? 0,
  };
}

export const CATALOG: CatalogItem[] = [
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
  {
    name: "Crack Fill",
    category: "SUPPLY",
    componentKey: null,
    pricePerLb: 4.25,
    weightPerBox: 10,
    priceIsPlaceholder: true,
    ...resin,
    reorderPointLbs: 40,
    orderUpToLbs: 80,
  },
  ...["Cabin Fever", "Coyote", "Creekbed", "Dolorite", "Gravel", "Overcast", "Tidal Wave", "Quartz Grey", "Quartz Tan"].map(
    (name): CatalogItem => ({
      name,
      category: "FLAKE",
      componentKey: null,
      pricePerLb: 2,
      weightPerBox: 40,
      priceIsPlaceholder: false,
      ...flakeVendor,
      reorderPointLbs: 40,
      orderUpToLbs: 160,
    }),
  ),
];

export const WAREHOUSE_SEEDS: WarehouseSeed[] = [
  { key: "phoenix", name: "Phoenix", city: "Phoenix", state: "AZ", postalCode: "85009", sampleAddress: "1840 W Demo Yard Rd" },
  { key: "sioux", name: "Sioux Falls", city: "Sioux Falls", state: "SD", postalCode: "57104", sampleAddress: "2200 N Sample Industrial Ave" },
  { key: "clark", name: "Clarkfield", city: "Clarkfield", state: "MN", postalCode: "56223", sampleAddress: "15 Practice Shop Ln" },
  { key: "lake", name: "Lakeville", city: "Lakeville", state: "MN", postalCode: "55044", sampleAddress: "8800 Fake Quarry Blvd" },
  { key: "cokato", name: "Cokato", city: "Cokato", state: "MN", postalCode: "55321", sampleAddress: "410 Training Ct" },
  { key: "zimm", name: "Zimmerman", city: "Zimmerman", state: "MN", postalCode: "55398", sampleAddress: "72 Mock Flake Dr" },
];
