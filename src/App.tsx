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
import { shownTotal } from './ui/Ledger';
import type { MoneyLevel } from './ui/AnimatedMoney';
import { netWorth } from './game/finance';
import { SavingSetup, TradeModal } from './ui/Trade';
import { CardHand, cardIcon } from './ui/Cards';
import { BigEventModal } from './ui/BigEvent';
import { moneyLevelOf } from './ui/AnimatedMoney';
import { APP_VERSION } from './version';
import { PLAYER_COLOR, RIVAL_COLORS, RivalAlertModal, isImportant, rivalLines } from './ui/Rivals';

/** ルーレットが回る時間と、駒が1マス進む時間（ミリ秒） */
const SPIN_MS = SPIN_DURATION_MS + 300;
const STEP_MS = 280;
/** 給料と生活費のアクションの、段階ごとの長さ（ミリ秒）。月末の前 → お給料 → 生活費 → 積み立てなどを引いたあと */
const PAY_STEP_MS = [300, 650, 650, 250];
/** ライバルの駒が1マス進む時間と、ライバルの番の前後の間（ミリ秒。design.md 12.2） */
const RIVAL_STEP_MS = 130;
const RIVAL_PAUSE_MS = 400;

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
  const [turnStart, setTurnStart] = useState<{ cash: number; worth: number; logLen: number; year: number; month: number; rivalPos: number[] } | null>(null);
  /** ルーレットを回してから、駒が止まって結果が反映されるまでの間 */
  const [turnMoving, setTurnMoving] = useState(false);
  /** あなたの番が終わった（選ぶ出来事が残っていない） */
  const humanDone = !!game && !!turnStart && !turnMoving && game.phase !== 'decision' && movingPos === null && !spinning;
  const m = game?.lastMonth;
  const flowKey = m ? `${m.year}-${m.month}` : null;
  /** このターンで月末が来た */
  const monthEnded = !!turnStart && flowKey === `${turnStart.year}-${turnStart.month}`;

  // あなたの月末を見せる順番（design.md 2.2、12.2）: 給料と生活費のアクション → 今月のまとめ → ライバルの番
  // → ライバルのお知らせ → 大きなイベント・ニュース。計算は全員分もう済んでいるので、見せる順番だけを決める

  // 給料と生活費のアクション。銀行預金の横に「＋42万円 お給料」→「−25万円 生活費」の順に金額を浮かべる
  /** アクションを見せ終わった月 */
  const [payShown, setPayShown] = useState<string | null>(null);
  /** 今見せている段階（0: 月末の前、1: お給料、2: 生活費、3: 積み立てなどを引いたあと） */
  const [payStep, setPayStep] = useState<{ key: string; i: number } | null>(null);
  const paying = humanDone && monthEnded && payShown !== flowKey;
  const payIndex = payStep?.key === flowKey ? payStep.i : 0;
  /** 大きなイベントで動いた銀行預金（ライバルの番のあとに見せるので、それまでは引いておく） */
  const bigEventCash = game?.bigEvent?.cash ?? 0;
  let cashShown: { value: number; label?: string; level: MoneyLevel } | undefined;
  if (paying && game && m) {
    const income = shownTotal(m.income);
    const expense = shownTotal(m.expense);
    const end = game.player.cash - bigEventCash;
    const start = end - (income - expense) + m.saved + m.repaid;
    cashShown = [
      { value: start, level: 'medium' as MoneyLevel },
      { value: start + income, label: t('payFlow.salary'), level: 'medium' as MoneyLevel },
      { value: start + income - expense, label: t('payFlow.expense'), level: 'medium' as MoneyLevel },
      { value: end, level: 'weak' as MoneyLevel },
    ][payIndex];
  }
  useEffect(() => {
    if (!paying || !flowKey) return;
    const id = window.setTimeout(() => (payIndex >= 3 ? setPayShown(flowKey) : setPayStep({ key: flowKey, i: payIndex + 1 })), PAY_STEP_MS[payIndex]);
    return () => window.clearTimeout(id);
  }, [paying, flowKey, payIndex]);

  // 今月のまとめ。あなたの月の話なので、ライバルの番より先に出す
  /** まとめを閉じた月 */
  const [summaryClosed, setSummaryClosed] = useState<string | null>(null);
  const big = game?.bigEvent;
  // 大きなイベントとニュースは全員に起きるので、このあとの画面で見せる（まとめには入れない）
  const monthEntries = game && turnStart ? game.log.slice(turnStart.logLen).filter((e) => !e.key.startsWith('bigEvent.')) : [];
  const summary: TurnSummaryData | null =
    game && turnStart && humanDone && monthEnded && !paying && summaryClosed !== flowKey && hasSomething(monthEntries)
      ? {
          year: turnStart.year,
          month: turnStart.month,
          monthsPerTurn: game.monthsPerTurn,
          entries: monthEntries,
          flow: game.lastMonth,
          cashBefore: turnStart.cash,
          cashAfter: game.player.cash - bigEventCash,
          worthBefore: turnStart.worth,
          worthAfter: netWorth(game) - (game.newsEvent?.moved ?? 0) - (big ? big.moved + big.cash : 0),
        }
      : null;

  // ライバルの番（design.md 12.2）。駒を1人ずつすばやく動かして見せる
  /** ライバルの番を見せ終わった月 */
  const [rivalShown, setRivalShown] = useState<string | null>(null);
  /** 今動かしているライバル（r）と、道のどこまで進んだか（i。-1 なら動く前） */
  const [rivalStep, setRivalStep] = useState<{ key: string; r: number; i: number } | null>(null);
  const rivalsMoving = humanDone && monthEnded && !paying && !summary && game!.rivals.length > 0 && rivalShown !== flowKey;
  const rs = rivalStep && rivalStep.key === flowKey ? rivalStep : { r: 0, i: -1 };
  const rivalPositions =
    game?.rivals.map((r, k) => {
      // ライバルの番を見せる前は、ターンの始めの場所に置いておく
      if (!turnStart || !monthEnded || rivalShown === flowKey) return turnStart && rivalShown !== flowKey ? turnStart.rivalPos[k] ?? r.player.position : r.player.position;
      if (!rivalsMoving) return turnStart.rivalPos[k] ?? r.player.position;
      if (k < rs.r) return r.player.position;
      if (k === rs.r && rs.i >= 0) return r.lastPath[rs.i] ?? r.player.position;
      return turnStart.rivalPos[k] ?? r.player.position;
    }) ?? [];
  useEffect(() => {
    if (!rivalsMoving || !game || !flowKey) return;
    if (rs.r >= game.rivals.length) {
      setRivalShown(flowKey);
      return;
    }
    const path = game.rivals[rs.r].lastPath;
    const next = rs.i + 1 < path.length ? { key: flowKey, r: rs.r, i: rs.i + 1 } : { key: flowKey, r: rs.r + 1, i: -1 };
    const id = window.setTimeout(() => setRivalStep(next), rs.i < 0 || next.r !== rs.r ? RIVAL_PAUSE_MS : RIVAL_STEP_MS);
    return () => window.clearTimeout(id);
  }, [rivalsMoving, flowKey, rs.r, rs.i, game]);

  // ここまで見せ終わったら、ターンを終える（このあと、ライバルのお知らせ、大きなイベント、ニュース）
  const turnComplete = humanDone && monthEnded && !paying && !summary && !rivalsMoving;
  useEffect(() => {
    if (turnComplete) setTurnStart(null);
  }, [turnComplete]);

  // ライバルの大事な動き（結婚、ボーナスマス、大きな損）は、ライバルの番のあと、大きなイベントとニュースの前に知らせる
  /** お知らせを見たところまでの、ライバルごとの記録の数 */
  const [rivalSeen, setRivalSeen] = useState<number[] | null>(null);
  const alertReady = !!game && !!rivalSeen && !turnStart;
  const alerts = alertReady ? rivalLines(game!, rivalSeen!).filter((l) => isImportant(l.entry)) : [];
  useEffect(() => {
    if (!game) {
      if (rivalSeen) setRivalSeen(null);
      return;
    }
    const lens = game.rivals.map((r) => r.log.length);
    // はじめて見るゲーム（続きからなど）は、今までの動きを知らせない。大事な動きがなければ、見たことにする
    if (!rivalSeen || (alertReady && alerts.length === 0 && lens.some((n, i) => n !== rivalSeen[i]))) setRivalSeen(lens);
  });
  /** ターンが終わり、ライバルのお知らせも見たあと（大きなイベントとニュースを出す） */
  const afterTurn = !turnStart && alerts.length === 0;
  // ターンの途中、大きなイベント、ニュース、今月のまとめ、ライバルのお知らせを出している間は、ほかの画面は止める
  const paused = showHistory || showFeed || !!turnStart || !!game?.bigEvent || !!game?.newsEvent || !!summary || alerts.length > 0;
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
    setTurnStart({ cash: s.player.cash, worth: netWorth(s), logLen: s.log.length, year: s.year, month: s.month, rivalPos: s.rivals.map((r) => r.player.position) });
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
    /** あなたの番の途中で出す画面（マスの出来事など）を出せるか */
    const readyInTurn = !busy && !showHistory && !showFeed && !game.bigEvent && !game.newsEvent;
    screen = (
      <div className="game">
        {/* ターンの途中は、上の欄の月を、ターンの月のままにする（design.md 2.2） */}
        <Hud s={game} level={moneyLevel} date={turnStart ? { year: turnStart.year, month: turnStart.month } : undefined} />
        <div className="game-body">
          <div className="board-area">
            <Board
              position={movingPos ?? game.player.position}
              overview={overview}
              bonus={game.bonusSquare}
              married={game.player.married}
              color={PLAYER_COLOR}
              others={game.rivals.map((r, k) => ({ position: rivalPositions[k], color: RIVAL_COLORS[r.id] }))}
              focus={rivalsMoving && rs.r < game.rivals.length ? rivalPositions[rs.r] : undefined}
            />
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
          <SidePanel
            s={game}
            level={moneyLevel}
            cashShown={cashShown}
            hideRivalMonth={turnStart && rivalShown !== flowKey ? { year: turnStart.year, month: turnStart.month } : undefined} onOpenHistory={() => setShowHistory(true)} onOpenFeed={() => setShowFeed(true)} />
        </div>
        {showFeed && <FeedPanel s={game} onClose={() => setShowFeed(false)} />}
        {showHistory && <HistoryModal s={game} onClose={() => setShowHistory(false)} />}
        {!busy && afterTurn && game.bigEvent && !showHistory && !showFeed && <BigEventModal s={game} onClose={() => setGame(dismissBigEvent(game))} />}
        {summary && !game.bigEvent && !showHistory && !showFeed && (
          <TurnSummary
            key={`${summary.year}-${summary.month}`}
            data={summary}
            onClose={() => setSummaryClosed(flowKey)}
          />
        )}
        {/* ニュースは、今月のまとめのあとに、ニュースだけの画面で出す（design.md 2.4） */}
        {!busy && afterTurn && game.newsEvent && !game.bigEvent && !showHistory && !showFeed && <NewsModal s={game} onNext={() => setGame(dismissNews(game))} />}
        {alerts.length > 0 && !busy && !showHistory && !showFeed && (
          <RivalAlertModal lines={alerts} onClose={() => setRivalSeen(game.rivals.map((r) => r.log.length))} />
        )}
        {readyInTurn && game.phase === 'decision' && alerts.length === 0 && (
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
