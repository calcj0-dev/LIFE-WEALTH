import { useEffect, useRef, useState } from 'react';
import { Board } from './board/Board';
import { Roulette, SPIN_DURATION_MS } from './board/Roulette';
import { choose, chooseYears, closeTrade, createGame, nextYear, openTradeCard, roll } from './game/engine';
import type { GameState } from './game/types';
import { t } from './i18n';
import { loadGame, saveGame } from './save';
import { AutoPopup, FeedPanel, NewsBrief, YearEndBrief } from './ui/Feed';
import { Hud, SidePanel } from './ui/GameScreen';
import { DecisionModal, HistoryModal, NewsModal, YearEndModal, isImportantNews, isNotableYearEnd } from './ui/Modals';
import { Result } from './ui/Result';
import { JobRoulette, YearsSetup } from './ui/Setup';
import { Toasts } from './ui/Toasts';
import { SavingSetup, TradeModal } from './ui/Trade';
import { CardHand, cardIcon } from './ui/Cards';
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
  /** カードで進んだときの出目の説明（例: 👟 3 + 5 = 8マス） */
  const [moveLabel, setMoveLabel] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  /** ふつうの年のニュースと決算を、自動で閉じるポップアップで見せている間 */
  const [autoView, setAutoView] = useState<'news' | 'yearEnd' | null>(null);
  /** 年末のニュースと決算を見た年。年末は「ニュース → 決算 → 取引タイム」の順に見せる（design.md 2.1） */
  const [newsSeenYear, setNewsSeenYear] = useState<number | null>(null);
  const [settleSeenYear, setSettleSeenYear] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const busy = spinning || movingPos !== null;
  const paused = showHistory || showFeed;
  const yearEnd = game?.phase === 'yearEnd';
  const newsStep = yearEnd && newsSeenYear !== game!.year;
  const settleStep = yearEnd && !newsStep && settleSeenYear !== game!.year;
  const tradeStep = yearEnd && !newsStep && !settleStep;

  // ふつうの年のニュースと決算は、約3秒で自動で閉じるポップアップで見せてから進む（design.md 2.2）
  useEffect(() => {
    if (!game || !yearEnd || busy || paused || autoView) return;
    if (newsStep) {
      if (!isImportantNews(game)) setAutoView('news');
    } else if (settleStep && !isNotableYearEnd(game)) setAutoView('yearEnd');
  }, [game, yearEnd, newsStep, settleStep, busy, paused, autoView]);

  const setGame = (s: GameState | null) => {
    setGameState(s);
    saveGame(s && s.phase !== 'finished' ? s : null);
    if (!s || s.phase === 'finished') setSaved(null);
  };

  const closeAuto = () => {
    if (!game) return;
    if (autoView === 'news') setNewsSeenYear(game.year);
    if (autoView === 'yearEnd' && game.phase === 'yearEnd') afterSettlement(game);
    setAutoView(null);
  };

  /** 決算を見たあと。最後の年は取引タイムを出さずに結果へ */
  const afterSettlement = (s: GameState) => {
    if (s.year >= s.years) setGame(nextYear(s));
    else setSettleSeenYear(s.year);
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** 駒を1マスずつ動かしてから、新しい状態にする */
  const move = (next: GameState) => {
    next.lastPath.forEach((pos, i) => later(() => setMovingPos(pos), STEP_MS * (i + 1)));
    later(() => {
      setMovingPos(null);
      setGame(next);
    }, STEP_MS * (next.lastPath.length + 1));
  };

  const spin = () => {
    if (!game || game.phase !== 'roll' || spinning || game.tradeOpen) return;
    const next = roll(game);
    setMoveLabel(null);
    setSpinValue(next.lastRoll);
    setSpinning(true);
    setOverview(false);
    later(() => {
      setSpinning(false);
      move(next);
    }, SPIN_MS);
  };

  /** 移動のカードを使って進む。ダッシュとスーパーダッシュはルーレットを1回回し、ぴったりはすぐ動く */
  const moveWithCard = (index: number, exact?: number) => {
    if (!game || game.phase !== 'roll' || busy) return;
    const next = roll(game, { index, exact });
    const face = next.lastFace!;
    const times = next.lastRoll! / face;
    setOverview(false);
    setSpinValue(face);
    setMoveLabel(
      times > 1
        ? t('cards.moved', { icon: cardIcon(next.lastCard!), face, times, n: next.lastRoll! })
        : t('cards.movedExact', { icon: cardIcon(next.lastCard!), n: next.lastRoll! }),
    );
    if (exact !== undefined) {
      setMovingPos(game.player.position);
      move(next);
      return;
    }
    setSpinning(true);
    later(() => {
      setSpinning(false);
      move(next);
    }, SPIN_MS);
  };

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
  } else if (game.phase === 'setupYears') {
    screen = <YearsSetup onDone={(years) => setGame(chooseYears(game, years))} />;
  } else if (game.phase === 'setupJob') {
    screen = <JobRoulette s={game} onDone={setGame} />;
  } else if (game.phase === 'setupSaving') {
    screen = <SavingSetup s={game} onDone={setGame} />;
  } else if (game.phase === 'finished') {
    screen = <Result s={game} onAgain={() => setGame(null)} />;
  } else {
    const ready = !busy && !paused;
    screen = (
      <div className="game">
        <Hud s={game} />
        <div className="game-body">
          <div className="board-area">
            <Board position={movingPos ?? game.player.position} overview={overview} bonus={game.bonusSquare} />
            <div className="board-toolbar">
              <button className="secondary" onClick={() => setOverview((v) => !v)} disabled={busy}>
                {t(overview ? 'board.follow' : 'board.overview')}
              </button>
            </div>
            <Roulette
              value={busy || game.phase === 'decision' ? spinValue : null}
              spinning={spinning}
              canSpin={game.phase === 'roll' && !busy && !game.tradeOpen}
              onSpin={spin}
              resultLabel={moveLabel ?? undefined}
            />
            <CardHand
              s={game}
              canUse={game.phase === 'roll' && !busy && !paused && !game.tradeOpen}
              onMove={moveWithCard}
              onTrade={(i) => setGame(openTradeCard(game, i))}
            />
          </div>
          <SidePanel s={game} onOpenHistory={() => setShowHistory(true)} onOpenFeed={() => setShowFeed(true)} />
        </div>
        <Toasts log={game.log} />
        {autoView === 'news' && yearEnd && (
          <AutoPopup onClose={closeAuto}>
            <NewsBrief s={game} />
          </AutoPopup>
        )}
        {autoView === 'yearEnd' && yearEnd && (
          <AutoPopup onClose={closeAuto}>
            <YearEndBrief s={game} />
          </AutoPopup>
        )}
        {showFeed && <FeedPanel s={game} onClose={() => setShowFeed(false)} />}
        {showHistory && <HistoryModal s={game} onClose={() => setShowHistory(false)} />}
        {ready && game.phase === 'decision' && <DecisionModal s={game} onChoose={(id) => setGame(choose(game, id))} />}
        {ready && !autoView && newsStep && isImportantNews(game) && <NewsModal s={game} onNext={() => setNewsSeenYear(game.year)} />}
        {ready && !autoView && settleStep && isNotableYearEnd(game) && <YearEndModal s={game} onNext={() => afterSettlement(game)} />}
        {ready && tradeStep && <TradeModal s={game} onChange={setGame} onDone={() => setGame(nextYear(game))} />}
        {ready && game.tradeOpen && <TradeModal s={game} onChange={setGame} onDone={() => setGame(closeTrade(game))} card />}
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
