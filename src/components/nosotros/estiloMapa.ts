import type { StyleSpecification } from "maplibre-gl";

/**
 * Estilo propio del mapa de Nosotros, en los colores del sitio (claro y oscuro). Los datos son de
 * OpenStreetMap, servidos gratis y sin clave por OpenFreeMap.
 */

/** Plaza 25 de Mayo, Sucre (longitud, latitud). */
export const PLAZA: [number, number] = [-65.25958, -19.04785];

const TONOS = {
  dark: { fondo: "#1a1512", manzana: "#211a16", parque: "#2c2a1c", agua: "#22302f", calle: "#3d2c22", mayor: "#6e482e", borde: "#14100d", edificio: "#33271f", texto: "#cdb9a6", halo: "#17120f", lugar: "#e6cfae" },
  light: { fondo: "#e6ded4", manzana: "#ded4c7", parque: "#cfd0b2", agua: "#bccbc6", calle: "#f5efe6", mayor: "#e0b78b", borde: "#cdbfae", edificio: "#cbbba7", texto: "#5d4c3f", halo: "#efe8de", lugar: "#7a4527" },
} as const;

const MAYORES = ["primary", "secondary", "trunk", "motorway"];

export function estiloMapa(tema: "dark" | "light", chico = false): StyleSpecification {
  const c = TONOS[tema];
  const ancho = (a: number, b: number): ["interpolate", ["exponential", number], ["zoom"], ...number[]] => ["interpolate", ["exponential", 1.5], ["zoom"], 12, a, 18, b];
  const es = ["coalesce", ["get", "name:es"], ["get", "name"]] as ["coalesce", ["get", string], ["get", string]];
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { osm: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    layers: [
      { id: "fondo", type: "background", paint: { "background-color": c.fondo } },
      { id: "manzanas", type: "fill", source: "osm", "source-layer": "landuse", paint: { "fill-color": c.manzana } },
      { id: "verde", type: "fill", source: "osm", "source-layer": "landcover", filter: ["match", ["get", "class"], ["grass", "wood"], true, false], paint: { "fill-color": c.parque, "fill-opacity": 0.8 } },
      { id: "parques", type: "fill", source: "osm", "source-layer": "park", paint: { "fill-color": c.parque } },
      { id: "agua", type: "fill", source: "osm", "source-layer": "water", paint: { "fill-color": c.agua } },
      { id: "calles-borde", type: "line", source: "osm", "source-layer": "transportation", filter: ["match", ["get", "class"], [...MAYORES, "tertiary", "minor"], true, false], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.borde, "line-width": ancho(1.6, 22) } },
      { id: "senderos", type: "line", source: "osm", "source-layer": "transportation", minzoom: 14, filter: ["match", ["get", "class"], ["path", "service", "track", "pedestrian"], true, false], paint: { "line-color": c.calle, "line-width": ancho(0.4, 5), "line-opacity": 0.75 } },
      { id: "calles", type: "line", source: "osm", "source-layer": "transportation", filter: ["match", ["get", "class"], ["tertiary", "minor"], true, false], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.calle, "line-width": ancho(1, 18) } },
      { id: "avenidas", type: "line", source: "osm", "source-layer": "transportation", filter: ["match", ["get", "class"], MAYORES, true, false], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.mayor, "line-width": ancho(1.6, 21) } },
      { id: "edificios", type: "fill-extrusion", source: "osm", "source-layer": "building", minzoom: 14, paint: { "fill-extrusion-color": c.edificio, "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.82 } },
      { id: "nombres-calles", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 14.5, layout: { "symbol-placement": "line", "text-field": es, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 14], "symbol-spacing": 380 }, paint: { "text-color": c.texto, "text-halo-color": c.halo, "text-halo-width": 1.4 } },
      // En el celular los nombres de lugares se encimarían con el punto: solo calles.
      { id: "nombres-lugares", type: "symbol", source: "osm", "source-layer": "poi", minzoom: 14.5, filter: ["match", ["get", "class"], ["museum", "park", "place_of_worship", "college", "town_hall", "attraction", "monument", "castle"], true, false], layout: { visibility: chico ? "none" : "visible", "text-field": es, "text-font": ["Noto Sans Regular"], "text-size": 12, "text-max-width": 8, "text-padding": 14, "symbol-sort-key": ["get", "rank"] }, paint: { "text-color": c.lugar, "text-halo-color": c.halo, "text-halo-width": 1.5 } },
      { id: "nombres-zonas", type: "symbol", source: "osm", "source-layer": "place", filter: ["match", ["get", "class"], ["city", "town", "suburb", "neighbourhood", "quarter", "village"], true, false], maxzoom: 15.5, layout: { "text-field": es, "text-font": ["Noto Sans Regular"], "text-size": ["match", ["get", "class"], "city", 22, 13] }, paint: { "text-color": c.texto, "text-halo-color": c.halo, "text-halo-width": 1.6 } },
    ],
  };
}
