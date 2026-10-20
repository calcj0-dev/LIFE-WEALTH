// 金額の単位はすべて「万円」。

export type JobId = 'employee' | 'civil' | 'engineer' | 'athlete' | 'youtuber' | 'freeter';
/** 運用する資産。お金はすべて銀行預金（Player.cash）として持つ */
export type AssetId = 'bond' | 'gold' | 'fund' | 'stock';
export type Economy = 'boom' | 'normal' | 'recession';
export type SquareType =
  | 'start'
  | 'stopMarriage'
  | 'life'
  | 'good'
  | 'bad'
  | 'gamble'
  | 'insurance'
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

export type SchoolType = 'public' | 'private';
export type UniversityType = 'national' | 'private' | 'none';

export interface Child {
  age: number;
  school: SchoolType;
  /** 18歳で決める。決まるまでは null */
  university: UniversityType | null;
  independent: boolean;
}

export interface Loan {
  balance: number;
  rate: number;
  yearsLeft: number;
  /** 毎年の返済額（元金＋利息） */
  payment: number;
}

export interface Property {
  id: number;
  use: 'home' | 'rental';
  /** 今の相場での価値 */
  value: number;
  loan: Loan | null;
  fireInsured: boolean;
  /** その年は空室で家賃が入らない */
  vacant: boolean;
}

export type SpouseWork = 'full' | 'part' | 'none';

export interface Spouse {
  work: SpouseWork;
  income: number;
  /** 育休でその年の収入が半分 */
  halfThisYear: boolean;
}

/** 投資方針の種類。safe・balanced・aggressive は自動投資の型 */
export type PolicyKind = 'safe' | 'balanced' | 'aggressive' | 'manual' | 'none';

export interface Policy {
  kind?: PolicyKind;
  /** 余ったお金のうち投資に回す割合（0〜1）。残りは銀行預金に残る */
  investRatio: number;
  /** 投資に回すお金の配分（合計1） */
  allocation: Record<AssetId, number>;
}

export interface Player {
  age: number;
  jobId: JobId;
  /** ゲームの始めにルーレットで決まった職業（ランクの基準に使う） */
  startJobId?: JobId;
  salary: number;
  /** その年は給料が入らない（失業、重い病気） */
  noIncomeThisYear: boolean;
  /** 自宅で介護している年は給料が減る */
  careAtHomeThisYear: boolean;
  /** スポーツ選手が引退する年齢 */
  athleteRetireAge: number | null;
  /** 銀行預金。お金はすべてここに入り、利息がつく */
  cash: number;
  /** 資産ごとの保有口数。価格は market.prices */
  holdings: Record<AssetId, number>;
  married: boolean;
  marriageDeclined: boolean;
  spouse: Spouse | null;
  children: Child[];
  properties: Property[];
  cardLoan: number;
  medicalPremium: number | null;
  hobby: boolean;
  petYears: number | null;
  sideBusinessIncome: number;
  policy: Policy;
  happiness: number;
  position: number;
  lap: number;
}

export interface Market {
  prices: Record<AssetId, number>;
  depositRate: number;
  economy: Economy;
  /** 不動産の相場（はじめは1） */
  realEstateIndex: number;
  /** 物価（生活費にかかる、はじめは1） */
  livingIndex: number;
  /** 給料の水準（毎年の物価の上昇に合わせて上がる、はじめは1）。古いセーブにはない */
  wageIndex?: number;
}

export interface LogEntry {
  age: number;
  key: string;
  params?: Record<string, number | string>;
  cash?: number;
  happiness?: number;
}

export interface Settlement {
  age: number;
  income: Record<string, number>;
  expense: Record<string, number>;
  net: number;
  invested: number;
  /** ローン返済のうち、元本（借金が減った分） */
  loanPrincipal: number;
  /** お金が足りず、売った資産の額 */
  sold: number;
  /** それでも足りず、借りた額 */
  borrowed: number;
}

export interface YearRecord {
  age: number;
  netWorth: number;
  cash: number;
  assets: Record<AssetId | 'realEstate', number>;
  debt: number;
  happiness: number;
  economy: Economy;
  newsId: string;
  /** 純資産が増えた・減った理由 */
  breakdown: NetWorthBreakdown;
  /** その年の価格（値動きのチャートと年利の表に使う。古いセーブにはない） */
  market?: { prices: Record<AssetId, number>; realEstateIndex: number; livingIndex: number; depositRate: number };
}

export interface NetWorthBreakdown {
  /** 働いて残したお金（給料など − 生活費などの支出。ローンは利息だけを支出に数える） */
  work: number;
  /** 投資の収入（利息・配当・家賃） */
  investment: number;
  /** 資産の値上がり・値下がり */
  revaluation: number;
  /** 出来事など（マスの出来事、ギャンブル、不動産の売り買いの費用など） */
  other: number;
}

/** 年初の値動き。ニュースの画面で、自分の資産がいくら動いたかを見せる */
export interface MarketChange {
  prevEconomy: Economy;
  /** 値動きの割合 */
  rates: Record<AssetId | 'realEstate', number>;
  /** 自分の資産が動いた金額 */
  amounts: Record<AssetId | 'realEstate', number>;
}

export interface Stats {
  investmentIncome: number;
  gambleSpent: number;
  gambleReturned: number;
  premiumsPaid: number;
  insurancePaid: number;
}

export type DecisionKind =
  | 'marriage'
  | 'life'
  | 'good'
  | 'bad'
  | 'gamble'
  | 'insurance'
  | 'realEstate'
  | 'school'
  | 'university'
  | 'athleteRetire'
  | 'notice';

export interface Decision {
  kind: DecisionKind;
  /** イベントの番号（life, good, bad など） */
  eventId?: string;
  /** 子どもの番号（進学） */
  childIndex?: number;
  /** 不動産の売り出し価格 */
  offerPrice?: number;
  /** お知らせの文章の番号（notice） */
  messageKey?: string;
}

export interface DecisionOption {
  id: string;
  key: string;
  params?: Record<string, number | string>;
  enabled: boolean;
  /** 選んだときにすぐ動くお金（分かるときだけ） */
  cash?: number;
  /** 選んだときに動く幸福ポイント（分かるときだけ） */
  happiness?: number;
}

export type Phase =
  | 'setupJob'
  | 'setupPolicy'
  | 'yearStart'
  | 'decision'
  | 'roll'
  | 'yearEnd'
  | 'finished';

export interface Score {
  /** ランクの基準にした職業 */
  jobId?: JobId;
  happinessPoints: number;
  securityPoints: number;
  total: number;
  rank: string;
  netWorth: number;
}

export interface GameState {
  saveVersion: 1;
  seed: number;
  rngState: number;
  /** 1〜44 */
  year: number;
  phase: Phase;
  player: Player;
  market: Market;
  newsId: string | null;
  lastRoll: number | null;
  /** 最後の移動で通ったマス */
  lastPath: number[];
  /** 今の決定 */
  decision: Decision | null;
  /** これから行う決定（年初の進学など） */
  queue: Decision[];
  /** 今の決定がどこから来たか */
  decisionFrom: 'yearStart' | 'square' | null;
  lastSettlement: Settlement | null;
  history: YearRecord[];
  log: LogEntry[];
  stats: Stats;
  score: Score | null;
  /** その年の年初の値動き */
  marketChange?: MarketChange;
}
