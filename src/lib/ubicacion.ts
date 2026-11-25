/**
 * Ubicación actual para la entrega. El celular da el punto (con permiso de la persona) y
 * OpenStreetMap dice qué calle es. El punto viaja dentro de la referencia del pedido, con un texto
 * que aquí mismo se reconoce: así el repartidor abre el lugar exacto sin cambiar la base.
 */
export type Punto = { lat: number; lng: number; metros: number; direccion: string | null };

const SUCRE = { lat: -19.0478, lng: -65.2596 };
const LEJOS_KM = 25; // solo se entrega en Sucre
const MARCA = /\s*·?\s*Ubicación: (-?\d+\.\d+),(-?\d+\.\d+)/;

export const enlaceMapa = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lng.toFixed(5)}`;
export const conUbicacion = (texto: string, p: Punto | null) => [texto.trim(), p && `Ubicación: ${p.lat.toFixed(5)},${p.lng.toFixed(5)}`].filter(Boolean).join(" · ");
export const sinUbicacion = (texto: string | null | undefined) => (texto ?? "").replace(MARCA, "").trim();
export function ubicacionDe(texto: string | null | undefined) {
  const m = MARCA.exec(texto ?? "");
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180));

/** La calle y el número más cercanos; null si no se pudo (se escribe a mano). */
async function calleDe(lat: number, lng: number) {
  try {
    const corte = new AbortController();
    const reloj = window.setTimeout(() => corte.abort(), 5000);
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`, { signal: corte.signal });
    window.clearTimeout(reloj);
    if (!r.ok) return null;
    const a = (await r.json())?.address ?? {};
    const calle = a.road ?? a.pedestrian ?? a.footway ?? a.square;
    if (!calle) return null;
    const zona = a.neighbourhood ?? a.suburb ?? a.quarter;
    return [`${calle}${a.house_number ? ` ${a.house_number}` : ""}`, zona].filter(Boolean).join(", ");
  } catch {
    return null;
  }
}

/** Pide el punto al celular. Lanza un mensaje para mostrar tal cual. */
export async function ubicacionActual(): Promise<Punto> {
  if (!("geolocation" in navigator)) throw new Error("Este navegador no da la ubicación. Escribe la dirección.");
  const pos = await new Promise<GeolocationPosition>((listo, falla) => navigator.geolocation.getCurrentPosition(listo, falla, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 })).catch((e: GeolocationPositionError) => {
    throw new Error(e.code === 1 ? "No diste permiso para usar tu ubicación. Actívalo en el navegador o escribe la dirección." : "No pudimos encontrar tu ubicación. Revisa que el GPS esté encendido o escribe la dirección.");
  });
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  if (km({ lat, lng }, SUCRE) > LEJOS_KM) throw new Error("Parece que no estás en Sucre, y por ahora solo entregamos ahí. Escribe la dirección de entrega.");
  return { lat, lng, metros: Math.round(accuracy), direccion: await calleDe(lat, lng) };
}
