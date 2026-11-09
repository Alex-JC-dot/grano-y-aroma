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
  /** Sin categoría = café en grano. Los que no son café no usan origen, tueste ni lote. */
  categoria?: Categoria;
  /** Foto propia del producto (si no tiene, se muestra la bolsa con la franja de color). */
  foto?: FotoProducto;
  /** Para lo que no es café: "Frasco de 250 g", "Botella de 500 ml"… */
  presentacion?: string;
  /** Producto de prueba (marcas de terceros): no se incluye en el build de producción. */
  prueba?: boolean;
}

export type Categoria = "grano" | "molido" | "jarabe" | "equipo" | "accesorio";

/**
 * Foto de producto con la etiqueta en blanco. `etiqueta` es la zona de la etiqueta en % de
 * la foto, donde se escribe con HTML la marca y el nombre; `tono` es el color del texto.
 */
export interface FotoProducto {
  src: string;
  etiqueta?: { x: number; y: number; w: number; h: number; tono: "oscuro" | "claro"; texto: string };
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
