import { useEffect, useRef, useState } from 'react';
import { Board } from './board/Board';
import { Roulette } from './board/Roulette';
import { END_AGE } from './data/rules';
import { choose, chooseJob, continueYear, createGame, nextYear, roll, setPolicy } from './game/engine';
import type { GameState } from './game/types';
import { t } from './i18n';
import { loadGame, saveGame } from './save';
import { Hud, SidePanel } from './ui/GameScreen';
import { DecisionModal, NewsModal, YearEndModal } from './ui/Modals';
import { Result } from './ui/Result';
import { JobSelect, PolicySetup } from './ui/Setup';
import { APP_VERSION } from './version';

/** ルーレットが回る時間と、駒が1マス進む時間（ミリ秒） */
const SPIN_MS = 800;
const STEP_MS = 260;

export function App() {
  const [game, setGameState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(() => loadGame());
  const [spinning, setSpinning] = useState(false);
  /** 駒の移動中に表示するマス（移動していないときは null） */
  const [movingPos, setMovingPos] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const setGame = (s: GameState | null) => {
    setGameState(s);
    saveGame(s && s.phase !== 'finished' ? s : null);
    if (!s || s.phase === 'finished') setSaved(null);
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const spin = () => {
    if (!game || game.phase !== 'roll' || spinning) return;
    const next = roll(game);
    setSpinning(true);
    later(() => {
      setSpinning(false);
      next.lastPath.forEach((pos, i) => later(() => setMovingPos(pos), STEP_MS * (i + 1)));
      later(() => {
        setMovingPos(null);
        setGame(next);
      }, STEP_MS * (next.lastPath.length + 1));
    }, SPIN_MS);
  };

  const busy = spinning || movingPos !== null;

  let screen: React.ReactNode;
  if (!game) {
    screen = (
      <div className="center-screen">
        <h1 className="logo">
          LIFE <span>&amp;</span> WEALTH
        </h1>
        <p className="subtitle">{t('app.subtitle')}</p>
        <div className="button-row">
          <button onClick={() => setGame(createGame(Math.floor(Math.random() * 2 ** 31)))}>{t('title.new')}</button>
          {saved && (
            <button className="secondary" onClick={() => setGame(saved)}>
              {t('title.continue')}
            </button>
          )}
        </div>
      </div>
    );
  } else if (game.phase === 'setupJob') {
    screen = <JobSelect onChoose={(job) => setGame(chooseJob(game, job))} />;
  } else if (game.phase === 'setupPolicy') {
    screen = <PolicySetup doneLabel={t('setup.policy.start')} onDone={(p) => setGame(setPolicy(game, p))} />;
  } else if (game.phase === 'finished') {
    screen = <Result s={game} onAgain={() => setGame(null)} />;
  } else {
    const showRollValue = busy || game.phase === 'decision' ? game.lastRoll ?? null : null;
    screen = (
      <div className="game">
        <Hud s={game} />
        <div className="game-body">
          <div className="board-area">
            <Board position={movingPos ?? game.player.position} />
            <Roulette
              value={spinning ? null : showRollValue}
              spinning={spinning}
              canSpin={game.phase === 'roll' && !busy}
              onSpin={spin}
            />
          </div>
          <SidePanel s={game} />
        </div>
        {!busy && game.phase === 'yearStart' && <NewsModal s={game} onNext={() => setGame(continueYear(game))} />}
        {!busy && game.phase === 'decision' && <DecisionModal s={game} onChoose={(id) => setGame(choose(game, id))} />}
        {!busy && game.phase === 'yearEnd' && (
          <YearEndModal s={game} last={game.player.age >= END_AGE} onNext={() => setGame(nextYear(game))} />
        )}
      </div>
    );
  }

  return (
    <>
      {screen}
      {!game && <div className="version">{`v${APP_VERSION}`}</div>}
      <div className="rotate-notice">{t('app.rotate')}</div>
    </>
  );
}
