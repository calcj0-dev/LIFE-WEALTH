import { useEffect, useRef, useState } from 'react';
import { Board } from './board/Board';
import { Roulette, SPIN_DURATION_MS } from './board/Roulette';
import { END_AGE } from './data/rules';
import { choose, continueYear, createGame, getOptions, nextYear, roll, setPolicy } from './game/engine';
import type { GameState } from './game/types';
import { t } from './i18n';
import { loadGame, saveGame } from './save';
import { Hud, SidePanel } from './ui/GameScreen';
import { DecisionModal, HistoryModal, NewsModal, YearEndModal } from './ui/Modals';
import { Toasts } from './ui/Toasts';
import { Result } from './ui/Result';
import { AssetManager } from './ui/AssetManager';
import { describeDecision } from './ui/decisionText';
import { BudgetCard, JobRoulette, PolicySetup } from './ui/Setup';
import { APP_VERSION } from './version';

/** ルーレットが回る時間と、駒が1マス進む時間（ミリ秒） */
const SPIN_MS = SPIN_DURATION_MS + 300;
const STEP_MS = 280;
/** 「OK」だけの出来事を、自動で進めるまでの時間（ミリ秒） */
const AUTO_OK_MS = 1600;

/** 選択肢のない出来事（「OK」だけ）は、画面を止めずに進める（design.md 2.2） */
function isAutoDecision(s: GameState): boolean {
  if (s.phase !== 'decision' || s.decisionFrom !== 'square') return false;
  const options = getOptions(s);
  return options.length === 1 && options[0].id === 'ok';
}

export function App() {
  const [game, setGameState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(() => loadGame());
  const [spinning, setSpinning] = useState(false);
  /** 駒の移動中に表示するマス（移動していないときは null） */
  const [movingPos, setMovingPos] = useState<number | null>(null);
  /** 出たばかりの出目（ルーレットが回っている間も表示する） */
  const [spinValue, setSpinValue] = useState<number | null>(null);
  const [overview, setOverview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showManager, setShowManager] = useState(false);
  /** 自動で進めた出来事の見出し（少しのあいだ画面に出す） */
  const [banner, setBanner] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const busyNow = spinning || movingPos !== null;
  useEffect(() => {
    if (!game || busyNow || !isAutoDecision(game)) return;
    setBanner(describeDecision(game).title);
    const id = window.setTimeout(() => {
      setBanner(null);
      setGame(choose(game, 'ok'));
    }, AUTO_OK_MS);
    return () => clearTimeout(id);
  }, [game, busyNow]);

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
    setSpinValue(next.lastRoll);
    setSpinning(true);
    setOverview(false);
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
    screen = <JobRoulette s={game} onDone={setGame} />;
  } else if (game.phase === 'setupPolicy') {
    screen = (
      <PolicySetup
        header={<BudgetCard s={game} title={t('budget.title')} />}
        doneLabel={t('setup.policy.start')}
        onDone={(p) => setGame(setPolicy(game, p))}
      />
    );
  } else if (game.phase === 'finished') {
    screen = <Result s={game} onAgain={() => setGame(null)} />;
  } else {
    screen = (
      <div className="game">
        <Hud s={game} />
        <div className="game-body">
          <div className="board-area">
            <Board position={movingPos ?? game.player.position} overview={overview} />
            <div className="board-toolbar">
              <button className="secondary" onClick={() => setOverview((v) => !v)} disabled={busy}>
                {t(overview ? 'board.follow' : 'board.overview')}
              </button>
            </div>
            <Roulette
              value={busy || game.phase === 'decision' ? spinValue : null}
              spinning={spinning}
              canSpin={game.phase === 'roll' && !busy}
              onSpin={spin}
            />
          </div>
          <SidePanel s={game} onOpenHistory={() => setShowHistory(true)} onOpenManager={() => setShowManager(true)} />
        </div>
        <Toasts log={game.log} />
        {banner && <div className="banner">{banner}</div>}
        {showHistory && <HistoryModal s={game} onClose={() => setShowHistory(false)} />}
        {showManager && <AssetManager s={game} onChange={setGame} onClose={() => setShowManager(false)} />}
        {!busy && !showManager && game.phase === 'yearStart' && (
          <NewsModal s={game} onNext={() => setGame(continueYear(game))} onOpenManager={() => setShowManager(true)} />
        )}
        {!busy && !showManager && game.phase === 'decision' && !isAutoDecision(game) && (
          <DecisionModal s={game} onChoose={(id) => setGame(choose(game, id))} />
        )}
        {!busy && !showManager && game.phase === 'yearEnd' && (
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
