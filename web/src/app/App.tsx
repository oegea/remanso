import { useEffect, useState } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useReducedMotion } from 'motion/react';
import { session } from './session';
import { useSession } from './useSession';
import { TabBar, Sidebar } from '../ui/Nav';
import { LiveRegion } from '../ui/Live';
import { Lock } from '../screens/Lock';
import { FirstUse } from '../screens/FirstUse';
import { Settings } from '../screens/Settings';
import { More } from '../screens/More';
import { DiaryList } from '../screens/Diary';
import { DiaryEntry } from '../screens/DiaryEntry';
import { NotebookList, NoteList } from '../screens/Notebooks';
import { NoteEntry } from '../screens/NoteEntry';
import { Search } from '../screens/Search';
import { Tasks, ProjectTasks } from '../screens/Tasks';
import { Today } from '../screens/Today';
import { Reminders } from '../screens/Reminders';
import { GoalList, GoalDetail, MetricView } from '../screens/Goals';
import { Impulse } from '../screens/Impulse';
import { ImpulseHistory } from '../screens/ImpulseHistory';
import { ReviewMenu, ReviewSession } from '../screens/Review';
import { Sounds } from '../screens/Sounds';
import { Meditate, MeditateSession } from '../screens/Meditate';
import { MiniPlayer } from '../ui/MiniPlayer';
import { UpdateBanner } from './Update';

export function App() {
  const s = useSession();
  useEffect(() => {
    void session.init();
  }, []);
  if (s.phase === 'loading') {
    return <div className="veil"><div className="spinner" aria-label="Cargando" role="status" /></div>;
  }
  if (s.phase === 'first-use') return <><FirstUse /><UpdateBanner /><LiveRegion /></>;
  if (s.phase === 'locked') return <><Lock /><MiniPlayer raised={false} /><UpdateBanner /><LiveRegion /></>;
  return <Shell />;
}

function Shell() {
  const [loc] = useLocation();
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  // Al cambiar de sección se empieza arriba: el scroll de la anterior no debe heredarse.
  useEffect(() => { window.scrollTo(0, 0); }, [loc]);
  useEffect(() => {
    const f = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);
  // El editor y el episodio de impulso ocupan toda la pantalla: sin barra inferior.
  const fullscreen = /^\/(diario\/\d+|cuadernos\/\d+\/\d+|impulso$|revision\/sesion|meditar\/sesion)/.test(loc);
  // La sesión de meditación tampoco muestra la barra lateral: la pantalla debe quedar vacía.
  const immersive = /^\/meditar\/sesion/.test(loc);
  return (
    <div className={`shell ${immersive ? 'is-immersive' : ''}`}>
      <Sidebar />
      <main className="shell-main" id="main">
        {/* Transición de entrada por CSS al cambiar de sección (la clave sólo cambia con la ruta). */}
        <div key={loc.split('/').slice(0, 2).join('/')} className={`page screen ${reduce ? '' : 'page-enter'}`}>
          <Switch>
              <Route path="/" component={Today} />
              <Route path="/diario" component={DiaryList} />
              <Route path="/diario/:id" component={DiaryEntry} />
              <Route path="/cuadernos" component={NotebookList} />
              <Route path="/cuadernos/:nb" component={NoteList} />
              <Route path="/cuadernos/:nb/:id" component={NoteEntry} />
              <Route path="/tareas/proyecto/:id" component={ProjectTasks} />
              <Route path="/tareas/:tab?" component={Tasks} />
              <Route path="/objetivos" component={GoalList} />
              <Route path="/objetivos/:id/metrica/:mid" component={MetricView} />
              <Route path="/objetivos/:id" component={GoalDetail} />
              <Route path="/recordatorios" component={Reminders} />
              <Route path="/revision" component={ReviewMenu} />
              <Route path="/revision/sesion/:kind" component={ReviewSession} />
              <Route path="/impulso" component={Impulse} />
              <Route path="/impulsos" component={ImpulseHistory} />
              <Route path="/buscar" component={Search} />
              <Route path="/mas" component={More} />
              <Route path="/meditar" component={Meditate} />
              <Route path="/meditar/sesion" component={MeditateSession} />
              <Route path="/sonidos" component={Sounds} />
              <Route path="/ajustes" component={Settings} />
              <Route component={Today} />
            </Switch>
        </div>
      </main>
      {!fullscreen && <TabBar />}
      <MiniPlayer raised={!fullscreen} />
      <UpdateBanner />
      <LiveRegion />
      {hidden && <div className="veil" aria-hidden="true">Remanso</div>}
    </div>
  );
}
