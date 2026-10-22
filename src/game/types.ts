// 金額の単位はすべて「万円」。1ターン＝1ヶ月（design.md 1章、2章）。

/** 職業の番号。職業の一覧は src/data/jobs.json */
export type JobId = string;
/** 運用する資産（銘柄）の番号。一覧は src/data/assets.json。お金はすべて銀行預金（Player.cash）として持つ */
export type AssetId = string;
export type Economy = 'boom' | 'normal' | 'recession';
export type SquareType =
  | 'start'
  | 'family'
  | 'plusSmall'
  | 'minusSmall'
  | 'plusMedium'
  | 'minusMedium'
  | 'plusLarge'
  | 'minusLarge'
  | 'chance'
  | 'card'
  | 'luckyCard'
  | 'stock'
  | 'investTalk'
  | 'gamble'
  | 'realEstate';

export interface Square {
  id: number;
  type: SquareType;
  /** 盤面上の位置 */
  x: number;
  y: number;
  /** 次のマス。将来の分かれ道に備えて複数持てる */
  next: number[];
}

export type HighSchoolType = 'public' | 'private';
export type UniversityType = 'national' | 'private' | 'none';

export interface Child {
  /** 生まれた年を0歳とし、年末ごとに1つ上がる */
  age: number;
  /** 15歳で決まる。決まるまでは null */
  highSchool: HighSchoolType | null;
  /** 18歳で決まる。決まるまでは null */
  university: UniversityType | null;
  independent: boolean;
}

export interface Loan {
  balance: number;
  /** 金利（年） */
  rate: number;
  monthsLeft: number;
  /** 毎月の返済額（元金＋利息） */
  payment: number;
}

export interface Home {
  /** 今の相場での価値 */
  value: number;
  loan: Loan | null;
  fireInsured: boolean;
}

export type SpouseWork = 'full' | 'part' | 'none';

export interface Spouse {
  work: SpouseWork;
  /** 収入（年） */
  income: number;
  /** 育休で、その年の残りの収入が半分 */
  halfThisYear: boolean;
}

export interface Player {
  jobId: JobId;
  /** 給料（手取り・年） */
  salary: number;
  /** 給料が入らない残りの月数（失業、重い病気） */
  noIncomeMonths: number;
  /** スポーツ選手が引退する年（何年目か） */
  athleteRetireYear: number | null;
  /** 銀行預金。お金はすべてここに入り、利息がつく */
  cash: number;
  /** 資産ごとの保有口数（株は株数）。価格は market.prices */
  holdings: Record<AssetId, number>;
  /** 資産ごとの、買った額の合計（売ったら、売った割合の分だけ減らす） */
  cost: Record<AssetId, number>;
  /** 毎月の積み立ての金額（投資信託とゴールドだけ。design.md 6.3） */
  saving: Record<AssetId, number>;
  /** 預金が足りず、積み立てを休んでいる */
  savingPaused: boolean;
  married: boolean;
  spouse: Spouse | null;
  children: Child[];
  home: Home | null;
  cardLoan: number;
  /** 医療保険の保険料（年）。入っていなければ null */
  medicalPremium: number | null;
  /** 副業の収入（年） */
  sideBusinessIncome: number;
  /** 副業に挑戦したことがあるか（1回だけ） */
  sideBusinessTried: boolean;
  position: number;
  lap: number;
  /** 手札のカード（カードの番号。design.md 3.9） */
  hand: string[];
  /** 乗った投資の話。結果は年末に決まる（design.md 6.4） */
  talks: { id: string; amount: number }[];
}

export interface Market {
  prices: Record<AssetId, number>;
  depositRate: number;
  economy: Economy;
  /** 不動産の相場（はじめは1） */
  realEstateIndex: number;
  /** 物価（生活費にかかる、はじめは1） */
  livingIndex: number;
  /** 給料の水準（毎年の物価の上昇に合わせて上がる、はじめは1） */
  wageIndex: number;
}

export interface LogEntry {
  year: number;
  month: number;
  key: string;
  params?: Record<string, number | string>;
  cash?: number;
  /** お金が動かなくても、画面の端にお知らせを出す */
  notice?: boolean;
}

/** 1年分の収入と支出（毎月の分を足したもの） */
export interface Settlement {
  year: number;
  income: Record<string, number>;
  expense: Record<string, number>;
  net: number;
  /** ローン返済のうち、元本（借金が減った分） */
  loanPrincipal: number;
  /** お金が足りず、売った資産の額 */
  sold: number;
  /** それでも足りず、借りた額 */
  borrowed: number;
  /** 持っている資産と家の値動き（毎月の分と、ニュース・大きなイベントの分） */
  revaluation: number;
  /** その年に結果が出た投資の話（元手と、戻った金額。借金になった分はマイナス） */
  talks: { id: string; amount: number; back: number }[];
  /** 積み立てで買った金額 */
  saved: number;
  /** カードローンの返済に回した金額 */
  repaid: number;
}

export interface YearRecord {
  year: number;
  netWorth: number;
  cash: number;
  assets: Record<AssetId | 'realEstate', number>;
  debt: number;
  economy: Economy;
  /** その年に起きたニュース */
  newsIds: string[];
  /** 純資産が増えた・減った理由 */
  breakdown: NetWorthBreakdown;
  incomeTotal: number;
  expenseTotal: number;
  /** その年の年末の価格（年利の表に使う） */
  market: { prices: Record<AssetId, number>; realEstateIndex: number; livingIndex: number; depositRate: number };
}

/** 毎月の価格（値動きのチャートに使う） */
export interface PricePoint {
  year: number;
  month: number;
  prices: Record<AssetId, number>;
  livingIndex: number;
  realEstateIndex: number;
  economy: Economy;
}

export interface NetWorthBreakdown {
  /** 働いて残したお金（給料など − 生活費などの支出。ローンは利息だけを支出に数える） */
  work: number;
  /** 投資の収入（利息・配当） */
  investment: number;
  /** 資産の値上がり・値下がり */
  revaluation: number;
  /** 出来事など（マスの出来事、ギャンブル、家の売り買いの費用など） */
  other: number;
}

/** 年末のニュースによる値動き。ニュースの画面で、自分の資産がいくら動いたかを見せる */
export interface MarketChange {
  prevEconomy: Economy;
  /** その年の値動きの割合（1年分） */
  rates: Record<AssetId | 'realEstate', number>;
  /** 自分の資産が1年で動いた金額 */
  amounts: Record<AssetId | 'realEstate', number>;
}

export interface Stats {
  investmentIncome: number;
  gambleSpent: number;
  gambleReturned: number;
  premiumsPaid: number;
  insurancePaid: number;
  /** 積み立てで買った金額の合計 */
  savingTotal: number;
  /** 投資の話に払った元手の合計と、戻ってきた金額の合計（借金になった分はマイナス） */
  talkSpent: number;
  talkReturned: number;
  /** 投資に入れたお金の合計（買った金額）と、売って戻ったお金の合計（投資の成績に使う。design.md 9章） */
  invested: number;
  divested: number;
  /** 持っている資産から入った配当と国債の利息の合計（銀行預金の利息は入れない） */
  assetIncome: number;
}

export type DecisionKind =
  | 'marriage'
  | 'birth'
  | 'event'
  | 'gamble'
  | 'realEstate'
  | 'stock'
  | 'talk'
  | 'discard'
  | 'athleteRetire'
  | 'notice';

export interface Decision {
  kind: DecisionKind;
  /** 出来事の番号（event） */
  eventId?: string;
  /** 家の売り出し価格 */
  offerPrice?: number;
  /** 株のマスで、割安に買える銘柄 */
  assetId?: AssetId;
  /** 投資の話の種類 */
  talkId?: string;
  /** ギャンブルの種類（選んだあと、賭ける金額を選ぶ） */
  gambleId?: string;
  /** お知らせの文章の番号（notice） */
  messageKey?: string;
  params?: Record<string, number | string>;
  /** お知らせを出した元（notice のときに、どのマスかを見せる） */
  fromSquare?: boolean;
}

export interface DecisionOption {
  id: string;
  key: string;
  params?: Record<string, number | string>;
  enabled: boolean;
  /** 選んだときにすぐ動くお金（分かるときだけ） */
  cash?: number;
}

export type Phase = 'setupYears' | 'setupJob' | 'setupSaving' | 'roll' | 'decision' | 'yearEnd' | 'finished';

export interface GameResult {
  netWorth: number;
  /** 投資の成績（投資に入れたお金に対して、何%増えたか。design.md 9章） */
  investReturn: number;
}

/**
 * プレイヤーごとに持つ記録の名前（design.md 12章）。あなたの分は GameState にそのまま持ち、
 * ライバルの分は Rival に同じ形で持つ。ライバルの番では、この記録を GameState と入れ替えて、同じ計算を使う
 */
export type SeatKey =
  | 'player'
  | 'yearFlows'
  | 'lastSettlement'
  | 'history'
  | 'log'
  | 'stats'
  | 'queue'
  | 'lastMonth'
  | 'marketChange'
  | 'yearMarket'
  | 'newsEvent'
  | 'bigEvent'
  | 'decision'
  | 'decisionFrom'
  | 'cardUsed'
  | 'lastRoll'
  | 'lastFace'
  | 'lastCard'
  | 'lastPath'
  | 'result';

/** プレイヤー1人分の記録 */
export type SeatData = Pick<GameState, SeatKey>;

/** ライバル（CPU）の番号。steady はコツコツさん（堅実タイプ）、bold はイケイケさん（攻めタイプ） */
export type RivalId = 'steady' | 'bold';

/** ライバル（CPU）1人分 */
export interface Rival extends SeatData {
  id: RivalId;
}

export interface GameState {
  saveVersion: 4;
  seed: number;
  rngState: number;
  /** 遊ぶ年数（10〜50） */
  years: number;
  /** 1ターンの月数（design.md 0.1） */
  monthsPerTurn: number;
  /** 何年目か（1から） */
  year: number;
  /** 何月か（1〜12） */
  month: number;
  phase: Phase;
  player: Player;
  market: Market;
  lastRoll: number | null;
  /** 最後の移動で出たルーレットの目。ダッシュなどで2倍・3倍にする前の数 */
  lastFace: number | null;
  /** 最後の移動で使ったカード */
  lastCard: string | null;
  /** このターンにカードを使ったか（1ターン1枚まで） */
  cardUsed: boolean;
  /** 取引カードで開いた取引タイムの間 */
  tradeOpen: boolean;
  /** ボーナスマスの目印が付いたマス（design.md 3.10） */
  bonusSquare: number;
  /** 最後の移動で通ったマス */
  lastPath: number[];
  /** 今の決定 */
  decision: Decision | null;
  /** これから行う決定（年の始めの進学のお知らせなど） */
  queue: Decision[];
  /** 今の決定がどこから来たか。square ならマスの出来事で、終わると月末に進む */
  decisionFrom: 'queue' | 'square' | null;
  /** 今年の収入と支出（毎月足していく） */
  yearFlows: Settlement;
  /** 最後の年末の決算 */
  lastSettlement: Settlement | null;
  history: YearRecord[];
  prices: PricePoint[];
  log: LogEntry[];
  stats: Stats;
  result: GameResult | null;
  /** 今年の値動きの記録（年の始めの価格と、自分の資産が動いた金額） */
  yearMarket: YearMarket;
  /** 最後の年末の値動き */
  marketChange: MarketChange | null;
  /** 起きたばかりの大きなイベント。画面いっぱいに見せ、「OK」を押すまで止める（design.md 5.3） */
  bigEvent: BigEventResult | null;
  /** 最後のターンの月末の、お金の動き（今月のまとめに出す。design.md 2.3） */
  lastMonth: MonthFlow | null;
  /** 起きたばかりのニュース。今月のまとめで見せ、「OK」を押すまで止める（design.md 7章） */
  newsEvent: NewsEvent | null;
  /** あなたのキャラクター（src/data/characters.ts の番号。古いセーブにはないので、なければ最初のキャラクター） */
  avatar?: string;
  /** ライバル（CPU）2人。いないときは空（design.md 12章） */
  rivals: Rival[];
  /**
   * ライバルの番の計算をしている間だけ、そのライバルの番号（していないときは -1）。
   * 月末の、全員に共通の処理を行わないためと、その間あなたの記録がどこにあるかを知るため
   */
  cpuSeat: number;
}

/** 1ターンの月末の、お金の動き */
export interface MonthFlow {
  year: number;
  month: number;
  income: Record<string, number>;
  expense: Record<string, number>;
  /** 積み立てで買った金額 */
  saved: number;
  /** カードローンの返済に回した金額 */
  repaid: number;
}

export interface BigEventResult {
  id: string;
  /** 銘柄ごとの値動きの割合（大暴落、大急騰など） */
  rates: Record<AssetId, number>;
  /** 値動きで、自分の資産が動いた金額 */
  moved: number;
  /** お金が動いた金額（預金の損、地震の被害、相続など。保険で払われた分は含めない） */
  cash: number;
  /** 保険で払われた金額 */
  covered: number;
}

/** ニュースが起きたときの値動き */
export interface NewsEvent {
  id: string;
  /** 起きた年と月 */
  year: number;
  month: number;
  prevEconomy: Economy;
  /** 銘柄ごとの値動きの割合 */
  rates: Record<AssetId | 'realEstate', number>;
  /** 自分の資産が動いた金額 */
  amounts: Record<AssetId | 'realEstate', number>;
  moved: number;
}

export interface YearMarket {
  startPrices: Record<AssetId, number>;
  startRealEstateIndex: number;
  startEconomy: Economy;
  /** その年に起きたニュース */
  newsIds: string[];
  /** その年に、ニュースで景気が変わったか（変わらなければ、年末に確率で移り変わる） */
  economySet: boolean;
  /** 自分の資産が値動きで動いた金額 */
  amounts: Record<AssetId | 'realEstate', number>;
}
