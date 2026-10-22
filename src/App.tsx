import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './board/Board';
import { Roulette, SPIN_DURATION_MS } from './board/Roulette';
import { choose, chooseYears, closeTrade, createGame, dismissBigEvent, dismissNews, nextYear, openTradeCard, roll } from './game/engine';
import type { GameState } from './game/types';
import { t } from './i18n';
import { loadGame, saveGame } from './save';
import { FeedPanel } from './ui/Feed';
import { Hud, SidePanel } from './ui/GameScreen';
import { DecisionModal, HistoryModal, NewsModal, YearEndModal } from './ui/Modals';
import { Result } from './ui/Result';
import { JobRoulette, YearsSetup } from './ui/Setup';
import { TurnSummary, hasSomething, type TurnSummaryData } from './ui/TurnSummary';
import { netWorth } from './game/finance';
import { SavingSetup, TradeModal } from './ui/Trade';
import { CardHand, cardIcon } from './ui/Cards';
import { BigEventModal } from './ui/BigEvent';
import { moneyLevelOf } from './ui/AnimatedMoney';
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
  /** 年末の決算で「取引タイムへ」を押した年（design.md 2.1） */
  const [tradeYear, setTradeYear] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  /** 前に見た記録の数（お金が光る強さを、新しく増えた記録から決めるため） */
  const seenLog = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const busy = spinning || movingPos !== null;
  // 大きなイベントやニュースの画面を出している間も、ほかの画面は止める
  /** ターンの始めの様子（今月のまとめで、前と後を比べるため。design.md 2.3） */
  const [turnStart, setTurnStart] = useState<{ cash: number; worth: number; logLen: number; year: number; month: number } | null>(null);
  /** ルーレットを回してから、駒が止まって結果が反映されるまでの間 */
  const [turnMoving, setTurnMoving] = useState(false);
  // ターンが終わった（選ぶ出来事も大きなイベントも残っていない）ら、今月のまとめを出す
  const turnDone = !!game && !!turnStart && !turnMoving && game.phase !== 'decision' && !game.bigEvent && movingPos === null && !spinning;
  const summary: TurnSummaryData | null =
    game && turnStart && turnDone && hasSomething(game.log.slice(turnStart.logLen))
      ? {
          year: turnStart.year,
          month: turnStart.month,
          monthsPerTurn: game.monthsPerTurn,
          entries: game.log.slice(turnStart.logLen),
          flow: game.lastMonth,
          cashBefore: turnStart.cash,
          cashAfter: game.player.cash,
          worthBefore: turnStart.worth,
          // ニュースで相場が動いた分は、このあとのニュースの画面で見せる（design.md 2.4）
          worthAfter: netWorth(game) - (game.newsEvent?.moved ?? 0),
        }
      : null;
  // 何も起きなかったターンは、まとめを出さずに終える
  useEffect(() => {
    if (turnDone && !summary) setTurnStart(null);
  }, [turnDone, summary]);
  // 大きなイベント、ニュース、今月のまとめを出している間は、ほかの画面は止める
  const paused = showHistory || showFeed || !!game?.bigEvent || !!game?.newsEvent || !!summary;
  const yearEnd = game?.phase === 'yearEnd';
  const tradeStep = yearEnd && tradeYear === game!.year;
  const settleStep = yearEnd && !tradeStep;

  const moneyLevel = useMemo(() => (game ? moneyLevelOf(game.log.slice(Math.min(seenLog.current, game.log.length))) : 'weak'), [game]);
  useEffect(() => {
    seenLog.current = game?.log.length ?? 0;
  }, [game]);

  const setGame = (s: GameState | null) => {
    setGameState(s);
    saveGame(s && s.phase !== 'finished' ? s : null);
    if (!s || s.phase === 'finished') setSaved(null);
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
      setTurnMoving(false);
    }, STEP_MS * (next.lastPath.length + 1));
  };

  /** ターンの始めの様子を覚えておく */
  const markTurnStart = (s: GameState) => {
    setTurnMoving(true);
    setTurnStart({ cash: s.player.cash, worth: netWorth(s), logLen: s.log.length, year: s.year, month: s.month });
  };

  const spin = () => {
    if (!game || game.phase !== 'roll' || spinning || game.tradeOpen) return;
    markTurnStart(game);
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
    markTurnStart(game);
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
        <Hud s={game} level={moneyLevel} />
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
              canSpin={game.phase === 'roll' && !busy && !paused && !game.tradeOpen}
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
          <SidePanel s={game} level={moneyLevel} onOpenHistory={() => setShowHistory(true)} onOpenFeed={() => setShowFeed(true)} />
        </div>
        {showFeed && <FeedPanel s={game} onClose={() => setShowFeed(false)} />}
        {showHistory && <HistoryModal s={game} onClose={() => setShowHistory(false)} />}
        {!busy && game.bigEvent && !showHistory && !showFeed && <BigEventModal s={game} onClose={() => setGame(dismissBigEvent(game))} />}
        {summary && !game.bigEvent && !showHistory && !showFeed && (
          <TurnSummary
            key={`${summary.year}-${summary.month}`}
            data={summary}
            onClose={() => setTurnStart(null)}
          />
        )}
        {/* ニュースは、今月のまとめのあとに、ニュースだけの画面で出す（design.md 2.4） */}
        {!busy && !turnStart && game.newsEvent && !game.bigEvent && !showHistory && !showFeed && <NewsModal s={game} onNext={() => setGame(dismissNews(game))} />}
        {ready && game.phase === 'decision' && (
          // 決定が変わるたびに作り直す（ルーレットを、決定ごとに最初から回すため）
          <DecisionModal key={`${game.year}-${game.month}-${game.log.length}-${game.decision?.kind}`} s={game} onChoose={(id) => setGame(choose(game, id))} />
        )}
        {/* 年末のニュースと決算は、別々の画面で、どちらも OK を押すまで出しておく（design.md 2.2） */}
        {ready && settleStep && <YearEndModal s={game} onTrade={() => setTradeYear(game.year)} onNext={() => setGame(nextYear(game))} />}
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
