/**
 * Values transcribed by hand from the OLD FrumToronto site's published August
 * 2026 zmanim sheet (screenshots supplied with the support ticket).
 *
 * This is a PARITY fixture, not a regression gate. It answers "are we faithful
 * to the sheet the community read for years?" — a different question from
 * tests/unit/zmanim-snapshot.test.ts, which answers "did our own output move?"
 * and runs at zero tolerance. See spec §11.0; conflating them produced a gate
 * that could not catch what it guarded.
 *
 * SAMPLE, NOT THE WHOLE MONTH — and deliberately so.
 * -------------------------------------------------
 * Eight consecutive days, 1–8 August 2026. Transcribing all 31 rows x 16
 * columns is ~500 hand-copied cells from a screenshot of a system that no
 * longer runs, and a mistyped fixture cell is indistinguishable from a code
 * defect at first glance. Eight consecutive days x 14 compared columns is 112
 * cells — already enough to catch every systematic error this fixture exists to
 * catch: a wrong shita, a wrong rounding direction, a mis-mapped column, or a
 * day-boundary offset. Those all show up as a whole column or a constant shift,
 * not as one stray cell.
 *
 * The window includes a Friday (7 Aug, the only candle-lighting row here) and
 * spans a Shabbos, so the weekly-varying columns are exercised.
 *
 * WHAT THIS MONTH DOES NOT COVER: August 2026 contains ZERO chag and ZERO fast
 * events, and no DST transition — measured. It validates the ordinary weekday
 * case only. The fall-holiday sample (old-sheet-2026-09.ts) is the one that
 * exercises Rosh Hashana, Tzom Gedaliah and Yom Kippur, and is the one to keep
 * if effort ever has to be cut.
 *
 * Two columns present on the old sheet are deliberately NOT compared — both by
 * recorded owner decision, not oversight:
 *   - Misheyakir degree: the sheet used 11 degrees, we print 10.2 (spec §9.1).
 *   - Sof Zman Shema (MA): the sheet used a fixed 72 minutes (9:11 on 5 Aug),
 *     we print the 16.1-degree family (8:55) — a 15-minute difference (§9.3).
 * They are transcribed here anyway, as evidence of what the sheet actually
 * said, and covered instead by the MyZmanim block in the parity test — the only
 * independent check on those two decisions.
 */
export interface OldSheetRow {
  date: string;
  /** Sof Zman Shema (MA) as the OLD sheet computed it: fixed 72 minutes. Not compared — §9.3. */
  szsMA_72min: string;
  /** Misheyakir at 11 degrees, as the old sheet printed it. Not compared — §9.1. */
  misheyakir11: string;
  alos161: string;
  alos72: string;
  misheyakir45: string;
  haneitz: string;
  szsGra: string;
  sztGra: string;
  chatzos: string;
  minchaGedola: string;
  minchaKetana: string;
  plag: string;
  candles?: string;
  shkia: string;
  tzeis85: string;
  tzeis72: string;
  dafYomi: string;
}

export const OLD_SHEET_2026_08: OldSheetRow[] = [
  {
    date: "2026-08-01", alos161: "4:22am", alos72: "4:54am", misheyakir11: "5:00am",
    misheyakir45: "5:21am", haneitz: "6:06am", szsMA_72min: "9:09am", szsGra: "9:45am",
    sztGra: "10:58am", chatzos: "1:24pm", minchaGedola: "2:00pm", minchaKetana: "5:39pm",
    plag: "7:10pm", shkia: "8:41pm", tzeis85: "9:30pm", tzeis72: "9:53pm",
    dafYomi: "Chullin 93",
  },
  {
    date: "2026-08-02", alos161: "4:23am", alos72: "4:56am", misheyakir11: "5:01am",
    misheyakir45: "5:23am", haneitz: "6:08am", szsMA_72min: "9:10am", szsGra: "9:46am",
    sztGra: "10:58am", chatzos: "1:24pm", minchaGedola: "2:00pm", minchaKetana: "5:38pm",
    plag: "7:09pm", shkia: "8:40pm", tzeis85: "9:29pm", tzeis72: "9:52pm",
    dafYomi: "Chullin 94",
  },
  {
    date: "2026-08-03", alos161: "4:25am", alos72: "4:57am", misheyakir11: "5:03am",
    misheyakir45: "5:24am", haneitz: "6:09am", szsMA_72min: "9:10am", szsGra: "9:46am",
    sztGra: "10:59am", chatzos: "1:24pm", minchaGedola: "2:00pm", minchaKetana: "5:37pm",
    plag: "7:08pm", shkia: "8:38pm", tzeis85: "9:27pm", tzeis72: "9:50pm",
    dafYomi: "Chullin 95",
  },
  {
    date: "2026-08-04", alos161: "4:27am", alos72: "4:58am", misheyakir11: "5:04am",
    misheyakir45: "5:25am", haneitz: "6:10am", szsMA_72min: "9:11am", szsGra: "9:47am",
    sztGra: "10:59am", chatzos: "1:23pm", minchaGedola: "2:00pm", minchaKetana: "5:36pm",
    plag: "7:07pm", shkia: "8:37pm", tzeis85: "9:26pm", tzeis72: "9:49pm",
    dafYomi: "Chullin 96",
  },
  {
    date: "2026-08-05", alos161: "4:28am", alos72: "4:59am", misheyakir11: "5:05am",
    misheyakir45: "5:26am", haneitz: "6:11am", szsMA_72min: "9:11am", szsGra: "9:47am",
    sztGra: "10:59am", chatzos: "1:23pm", minchaGedola: "1:59pm", minchaKetana: "5:36pm",
    plag: "7:06pm", shkia: "8:36pm", tzeis85: "9:24pm", tzeis72: "9:48pm",
    dafYomi: "Chullin 97",
  },
  {
    date: "2026-08-06", alos161: "4:30am", alos72: "5:00am", misheyakir11: "5:07am",
    misheyakir45: "5:27am", haneitz: "6:12am", szsMA_72min: "9:12am", szsGra: "9:48am",
    sztGra: "10:59am", chatzos: "1:23pm", minchaGedola: "1:59pm", minchaKetana: "5:35pm",
    plag: "7:05pm", shkia: "8:34pm", tzeis85: "9:23pm", tzeis72: "9:47pm",
    dafYomi: "Chullin 98",
  },
  {
    date: "2026-08-07", alos161: "4:32am", alos72: "5:01am", misheyakir11: "5:08am",
    misheyakir45: "5:28am", haneitz: "6:13am", szsMA_72min: "9:12am", szsGra: "9:48am",
    sztGra: "11:00am", chatzos: "1:23pm", minchaGedola: "1:59pm", minchaKetana: "5:34pm",
    plag: "7:04pm", candles: "8:15pm", shkia: "8:33pm", tzeis85: "9:21pm", tzeis72: "9:45pm",
    dafYomi: "Chullin 99",
  },
  {
    date: "2026-08-08", alos161: "4:33am", alos72: "5:02am", misheyakir11: "5:09am",
    misheyakir45: "5:29am", haneitz: "6:14am", szsMA_72min: "9:13am", szsGra: "9:49am",
    sztGra: "11:00am", chatzos: "1:23pm", minchaGedola: "1:59pm", minchaKetana: "5:33pm",
    plag: "7:03pm", shkia: "8:32pm", tzeis85: "9:20pm", tzeis72: "9:44pm",
    dafYomi: "Chullin 100",
  },
];
