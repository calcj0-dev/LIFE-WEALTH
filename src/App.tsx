import { useEffect, useRef, useState } from 'react';
import { Board } from './board/Board';
import { Roulette, SPIN_DURATION_MS } from './board/Roulette';
import { END_AGE } from './data/rules';
import { choose, continueYear, createGame, nextYear, roll, setPolicy } from './game/engine';
import type { GameState } from './game/types';
import { t } from './i18n';
import { loadGame, saveGame } from './save';
import { Hud, SidePanel } from './ui/GameScreen';
import { DecisionModal, HistoryModal, NewsModal, YearEndModal, isImportantNews, isNotableYearEnd } from './ui/Modals';
import { AutoPopup, FeedPanel, NewsBrief, YearEndBrief } from './ui/Feed';
import { Toasts } from './ui/Toasts';
import { Result } from './ui/Result';
import { AssetManager } from './ui/AssetManager';
import { BudgetCard, JobRoulette, PolicySetup } from './ui/Setup';
import { APP_VERSION } from './version';

/** ルーレットが回る時間と、駒が1マス進む時間（ミリ秒） */
const SPIN_MS = SPIN_DURATION_MS + 300;
const STEP_MS = 280;


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
  /** ふつうの年のニュースと決算を、自動で閉じるポップアップで見せている間 */
  const [autoView, setAutoView] = useState<'news' | 'yearEnd' | null>(null);
  const [showFeed, setShowFeed] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const busyNow = spinning || movingPos !== null;
  const paused = showManager || showHistory || showFeed;

  // ふつうの年のニュースと決算は、約3秒で自動で閉じるポップアップで見せてから進む（design.md 2.2）
  useEffect(() => {
    if (!game || busyNow || paused || autoView) return;
    if (game.phase === 'yearStart' && !isImportantNews(game)) setAutoView('news');
    else if (game.phase === 'yearEnd' && !isNotableYearEnd(game, game.player.age >= END_AGE)) setAutoView('yearEnd');
  }, [game, busyNow, paused, autoView]);

  const closeAuto = () => {
    if (!game) return;
    if (autoView === 'news' && game.phase === 'yearStart') setGame(continueYear(game));
    if (autoView === 'yearEnd' && game.phase === 'yearEnd') setGame(nextYear(game));
    setAutoView(null);
  };

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
          <SidePanel
            s={game}
            onOpenHistory={() => setShowHistory(true)}
            onOpenManager={() => setShowManager(true)}
            onOpenFeed={() => setShowFeed(true)}
          />
        </div>
        <Toasts log={game.log} />
        {autoView === 'news' && game.phase === 'yearStart' && (
          <AutoPopup onClose={closeAuto}>
            <NewsBrief s={game} />
          </AutoPopup>
        )}
        {autoView === 'yearEnd' && game.phase === 'yearEnd' && (
          <AutoPopup onClose={closeAuto}>
            <YearEndBrief s={game} />
          </AutoPopup>
        )}
        {showFeed && <FeedPanel s={game} onClose={() => setShowFeed(false)} />}
        {showHistory && <HistoryModal s={game} onClose={() => setShowHistory(false)} />}
        {showManager && <AssetManager s={game} onChange={setGame} onClose={() => setShowManager(false)} />}
        {!busy && !paused && game.phase === 'yearStart' && isImportantNews(game) && (
          <NewsModal s={game} onNext={() => setGame(continueYear(game))} onOpenManager={() => setShowManager(true)} />
        )}
        {!busy && !paused && game.phase === 'decision' && (
          <DecisionModal s={game} onChoose={(id) => setGame(choose(game, id))} />
        )}
        {!busy && !paused && game.phase === 'yearEnd' && isNotableYearEnd(game, game.player.age >= END_AGE) && (
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
