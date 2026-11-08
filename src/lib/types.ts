export type Role = "cliente" | "admin" | "cajero" | "tostador" | "almacen" | "delivery";

export interface Product {
  id: string;
  name: string;
  origin: string;
  region: string;
  altitude: number;
  roastLevel: "Ligero" | "Medio" | "Oscuro";
  flavorProfile: string[];
  grindTypes: string[];
  lotCode: string;
  cuppingScore: number;
  cuppingNotes: string;
  roastDate: string;
  price: number;
  stock: number;
  imageUrl: string;
  isAuctionEligible?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  selectedGrind: string;
}

export interface Auction {
  id: string;
  lotCode: string;
  productName: string;
  origin: string;
  altitude: number;
  cuppingScore: number;
  basePrice: number;
  currentBid: number;
  currentBidder: string;
  quantity: number;
  unit: string;
  timeLeftSeconds: number;
  imageUrl: string;
  description: string;
  bids: BidEntry[];
}

export interface BidEntry {
  bidder: string;
  amount: number;
  timestamp: string;
}

export interface Subscription {
  id: string;
  frequency: "quincenal" | "mensual";
  quantity: number;
  grind: string;
  nextDelivery: string;
  status: "activa" | "pausada" | "cancelada";
  product: string;
}

export interface POSItem {
  id: string;
  name: string;
  price: number;
  category: string;
  emoji: string;
  stock: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: "verde" | "tostado" | "insumo";
  quantity: number;
  unit: string;
  minStock: number;
  lotCode?: string;
  origin?: string;
}

export interface Order {
  id: string;
  customer: string;
  items: string[];
  total: number;
  status: "Recibido" | "En Preparación" | "En Camino" | "Entregado";
  address: string;
  driver?: string;
  createdAt: string;
}
