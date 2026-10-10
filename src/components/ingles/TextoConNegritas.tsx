import { Fragment } from "react";

const NEGRITA = /\*\*([^*\n]+?)\*\*/g;

/**
 * Texto de la tutora con las negritas de Markdown (**así**) como negritas de
 * verdad, sin asteriscos. Lo demás se deja tal cual (incluidos los saltos de
 * línea, que respeta el contenedor con whitespace-pre-wrap).
 */
export function TextoConNegritas({ texto }: { texto: string }) {
  const partes: React.ReactNode[] = [];
  let desde = 0;
  for (const m of texto.matchAll(NEGRITA)) {
    const inicio = m.index ?? 0;
    if (inicio > desde) partes.push(texto.slice(desde, inicio));
    partes.push(<strong key={inicio}>{m[1]}</strong>);
    desde = inicio + m[0].length;
  }
  if (desde < texto.length) partes.push(texto.slice(desde));
  return (
    <>
      {partes.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
