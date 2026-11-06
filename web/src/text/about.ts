/** Datos de autoría y contacto que aparecen en la bienvenida y en «Acerca de». */
export const ABOUT = {
  author: 'Oriol Egea',
  contact: 'imoriol@duck.com',
  /** Web personal del autor. */
  website: 'https://www.oriol.im',
  licence: 'AGPL-3.0-or-later',
  /** Dirección pública del código: la AGPL pide que quien recibe el programa pueda llegar a él. */
  sourceUrl: 'https://github.com/oegea/remanso',
  version: '0.2.0',
} as const;

/** Aviso de salud (safety.md §1.3 + emergencia). Cierra la presentación; siempre visible en Ajustes. */
export const HEALTH_NOTICE = [
  'Remanso es un cuaderno personal de notas, objetivos y hábitos. No es un servicio sanitario: no diagnostica, no trata y no sustituye a un profesional de la salud.',
  'Las técnicas proceden de la investigación en autoayuda; sus efectos suelen ser modestos y varían de una persona a otra. Si lo que quieres cambiar afecta a tu salud, o te preocupa, un profesional puede acompañarte mejor que esta aplicación.',
  'Si estás en peligro, llama al 112 o a una persona de confianza. En España, el 024 atiende la conducta suicida las 24 horas, gratis y de forma confidencial.',
];

export const PRIVACY_NOTICE = 'Remanso guarda todo en este dispositivo, cifrado con tu contraseña. No hay servidor, no hay cuenta, nada se envía a ningún sitio. Si borras los datos del navegador o pierdes el dispositivo sin copia, se pierden. Si olvidas la contraseña, no se pueden recuperar.';

/**
 * Pasos de la presentación inicial. Es una carta del autor, en primera persona
 * (docs/decisions/registro-de-decisiones.md, ADR-007): la app nace del
 * conocimiento que la comunidad científica publicó al mundo; ayuda sin distracciones, sin
 * vender nada y sin enganchar a nadie a su propia autoayuda; cada cual es dueño de sus
 * actos y de su atención; se ofrece como regalo al mundo desde la convicción de que
 * compartir con generosidad es lo más valioso del ser humano; si sirve, lo mejor es
 * pasarla. Nada aquí se inventa sobre el autor.
 */
export const WELCOME_STEPS: { title: string; body: string[] }[] = [
  {
    title: 'Hola',
    body: [
      'Esto es Remanso. Antes de que escribas nada, me gustaría contarte por qué existe y qué pretende. Son unos pocos pasos; puedes saltarlos, pero creo que merece la pena leerlos una vez.',
      'Remanso es un cuaderno para escribir, ordenar lo que quieres y mirar tus impulsos con calma. No está aquí para decirte qué tienes que hacer con tu vida. Está aquí para que lo decidas tú, con un poco más de claridad y un poco menos de ruido.',
    ],
  },
  {
    title: 'Nace de un conocimiento compartido',
    body: [
      'Esta aplicación existe porque muchas personas dedicaron su vida a estudiar con rigor cómo cambiamos: cómo se forman los hábitos, qué pasa cuando aplazamos, qué ayuda ante un impulso y qué no. Y existe porque la comunidad científica publicó ese conocimiento al mundo en lugar de guardárselo.',
      'Remanso sólo lo recoge y lo pone a tu alcance. Cada técnica cita los estudios de los que procede y dice con honestidad cuánta confianza merece. Donde la evidencia es débil, lo reconoce. Donde no la hay, no inventa.',
    ],
  },
  {
    title: 'Sin nada que venderte',
    body: [
      'Casi todo lo que usamos a diario está hecho para quedarse con nuestra atención, para vendernos algo o para que volvamos. Hasta el cuidado de uno mismo se ha convertido en un producto: métricas, rachas y una exigencia de rendir que no descansa nunca.',
      'Remanso no juega a eso. No hay nada que comprar, nadie que quiera engancharte a tu propia autoayuda, ninguna racha que romper, nadie midiéndote. Cambiar un hábito tiene sentido cuando nace de tu salud y de tu convicción, no de que alguien te diga lo que tienes que hacer. Tus actos son tuyos, y tu atención también.',
    ],
  },
  {
    title: 'Un regalo',
    body: [
      'Por eso Remanso se ofrece como un regalo al mundo: libre, gratis y sin condiciones. Lo hice convencido de que compartir con generosidad es de lo más valioso que podemos hacer unos por otros, y de que la colaboración y el cuidado mutuo mueven a las personas más que cualquier otra cosa.',
      'Si Remanso te sirve, lo mejor que puedes hacer con él es pasarlo: dáselo a quien creas que le puede ayudar. Así es como debería llegar a la gente, de mano en mano.',
    ],
  },
  {
    title: 'Tuyo, y sólo tuyo',
    body: [
      'Remanso no tiene telemetría. No guarda ni envía tus datos a ningún servidor: todo vive en tu dispositivo, cifrado con tu contraseña, y nadie más puede leerlo. Ni siquiera quien lo escribió.',
      'Eso tiene una consecuencia que debes conocer: si pierdes el dispositivo, si se borran los datos del navegador o si olvidas la contraseña, lo escrito se pierde y nadie puede recuperarlo. Por eso es muy importante que descargues copias de seguridad con regularidad y las guardes en un lugar seguro. Remanso pone un espacio de reflexión seguro y privado por encima de la comodidad.',
    ],
  },
  {
    title: 'Código abierto',
    body: [
      'El código de Remanso es abierto, bajo la licencia AGPL-3.0, la versión vigente de la GNU Affero General Public License. Puedes leerlo, cambiarlo y redistribuirlo, y cualquier versión que alguien ofrezca a otras personas tendrá que seguir siendo igual de libre.',
      'Así nadie podrá cerrar lo que se entregó abierto. El código está en github.com/oegea/remanso.',
    ],
  },
  {
    title: 'Quién hay detrás',
    body: [
      'La idea y el desarrollo son de Oriol Egea. Pero Remanso no existiría si mucha otra gente no hubiera estudiado la conducta humana con rigor científico y publicado lo que aprendió; sus trabajos están citados en Ajustes, en «Técnicas y su evidencia». El mérito es, sobre todo, suyo.',
      'Si Remanso te ha servido, o quieres contactar conmigo por cualquier motivo, siéntete libre de escribirme a imoriol@duck.com. Puedes saber más de mí en www.oriol.im.',
    ],
  },
];
