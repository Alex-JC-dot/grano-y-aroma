/* eslint-disable @next/next/no-img-element -- export estático: next/image no optimiza aquí */
import { dibujoDe, esRecorte, fotoDe, type Dibujo, type ItemTotem } from "@/lib/totem";

/** Dibujo para lo que todavía no tiene foto: mismo tamaño y misma sombra que las fotos. */
export function DibujoTotem({ tipo, color = "#7a4a2c" }: { tipo: Dibujo; color?: string }) {
  return (
    <svg className="foto-totem foto-totem--dibujo" viewBox="0 0 120 120" aria-hidden="true">
      {tipo === "taza" && (
        <>
          <ellipse cx="56" cy="98" rx="46" ry="9" fill="#dccdb8" />
          <path d="M86 52h10a14 14 0 0 1 0 28h-14" fill="none" stroke="#e9dcc9" strokeWidth="8" />
          <path d="M18 44h72c0 28-8 50-36 50S18 72 18 44Z" fill="#efe4d4" />
          <ellipse cx="54" cy="45" rx="36" ry="11" fill="#7a4a2c" />
        </>
      )}
      {tipo === "vaso" && (
        <>
          <path d="M34 22h52l-6 84a6 6 0 0 1-6 5H46a6 6 0 0 1-6-5Z" fill="#f3eadd" opacity="0.9" />
          <path d="M37 46h46l-4 56a4 4 0 0 1-4 4H45a4 4 0 0 1-4-4Z" fill="#b5804f" />
          <path d="M32 24c6-16 18-12 28-18 8 8 24 2 28 18Z" fill="#fffaf2" />
          <path d="M44 16c10 6 20-2 32 6" fill="none" stroke="#b5683a" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {tipo === "metodo" && (
        <>
          <path d="M28 18h64L70 56H50Z" fill="#d8c3a6" />
          <path d="M36 22h48L68 50H52Z" fill="#7a4a2c" />
          <rect x="44" y="56" width="32" height="6" rx="3" fill="#b5683a" />
          <path d="M46 66h28l14 34a8 8 0 0 1-7 11H39a8 8 0 0 1-7-11Z" fill="#e6d8c2" />
          <path d="M40 86h40l7 15a5 5 0 0 1-5 6H38a5 5 0 0 1-5-6Z" fill="#8a5432" />
        </>
      )}
      {tipo === "botella" && (
        <>
          <rect x="50" y="8" width="20" height="12" rx="3" fill="#b5683a" />
          <path d="M52 20h16v12c0 8 10 10 10 22v50a8 8 0 0 1-8 8H50a8 8 0 0 1-8-8V54c0-12 10-14 10-22Z" fill="#dbe7ea" />
          <rect x="42" y="62" width="36" height="24" fill="#fffaf2" />
        </>
      )}
      {tipo === "bolsa" && (
        <>
          <path d="M30 22h60l5 84a6 6 0 0 1-6 6H31a6 6 0 0 1-6-6Z" fill="#c49a6c" />
          <path d="M30 22h60l1 14H29Z" fill="#a97f52" />
          <path d="M76 36h15l4 70a6 6 0 0 1-6 6H78Z" fill="#b1875a" opacity="0.6" />
          <rect x="27" y="56" width="66" height="30" fill={color} />
          <ellipse cx="60" cy="71" rx="9" ry="11" fill="#fff6e8" />
          <path d="M63 61c-6 6 2 12-5 20" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {tipo === "masita" && (
        <>
          <ellipse cx="60" cy="70" rx="44" ry="32" fill="#d89a4e" />
          <ellipse cx="60" cy="62" rx="38" ry="24" fill="#e8b56d" />
        </>
      )}
    </svg>
  );
}

export default function FotoTotem({ item, ref }: { item: ItemTotem; ref?: React.Ref<HTMLSpanElement> }) {
  const src = fotoDe(item);
  return (
    <span ref={ref} className="foto-totem__marco">
      {src ? (
        <img className={`foto-totem${esRecorte(src) ? "" : " foto-totem--cuadro"}`} src={src} alt="" draggable={false} />
      ) : (
        <DibujoTotem tipo={dibujoDe(item)} color={item.color ?? undefined} />
      )}
    </span>
  );
}
