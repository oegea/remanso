/**
 * Explicación en lenguaje llano. Si la pantalla está vacía se muestra en línea; si ya hay
 * contenido queda como una pregunta («¿Qué es…?») que abre una hoja, para que abrirla y
 * cerrarla no mueva nada de sitio.
 */
import { useState } from 'react';
import { Sheet } from './Sheet';

export function Intro({ text, question, open }: { text: string | readonly string[]; question: string; open: boolean }) {
  const [sheet, setSheet] = useState(false);
  const ps = typeof text === 'string' ? [text] : text;
  if (open) return <div className="stack" style={{ marginBottom: 4 }}>{ps.map((p) => <p key={p} className="t-muted">{p}</p>)}</div>;
  return (
    <>
      <button className="btn btn-text" style={{ alignSelf: 'flex-start', paddingLeft: 0, whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setSheet(true)}>{question}</button>
      <Sheet open={sheet} onClose={() => setSheet(false)} title={question}>
        <div className="stack t-muted">{ps.map((p) => <p key={p}>{p}</p>)}</div>
      </Sheet>
    </>
  );
}
