/** Everything a cover template prints. Templates stay purely presentational. */
export interface CoverModel {
  publicationName: string;
  title: string;
  dek?: string;
  lines: string[];
  volume: number;
  number: number;
  date: string;
  price: string;
  locked: boolean;
}
