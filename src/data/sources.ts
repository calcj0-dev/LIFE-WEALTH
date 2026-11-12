// 数値の出典（design.md 15章）。「このゲームについて」の画面に出す。出典の名前は資料そのものの名前なので、言語ファイルには入れない

export interface Source {
  /** 何の数値か（言語ファイルの番号） */
  key: string;
  /** 資料の名前 */
  title: string;
  /** 資料のURL（なければ名前だけ出す） */
  url?: string;
}

export const SOURCES: Source[] = [
  { key: 'about.source.salary', title: '国税庁「令和6年分 民間給与実態統計調査結果について」', url: 'https://www.nta.go.jp/information/release/kokuzeicho/2025/minkan_2025/pdf/01.pdf' },
  { key: 'about.source.living', title: '総務省統計局「家計調査報告（家計収支編）2025年平均結果の概要」', url: 'https://www.stat.go.jp/data/kakei/sokuhou/tsuki/pdf/fies_gaikyo2025.pdf' },
  { key: 'about.source.school', title: '文部科学省「子供の学習費調査」', url: 'https://www.mext.go.jp/content/20260312-mxt_chousa01-000048196_4.pdf' },
  { key: 'about.source.university', title: '日本政策金融公庫「令和3年度 教育費負担の実態調査結果」', url: 'https://www.jfc.go.jp/n/findings/pdf/kyouikuhi_chousa_k_r03.pdf' },
  { key: 'about.source.home', title: '住宅金融支援機構「フラット35利用者調査」2023年度' },
];
