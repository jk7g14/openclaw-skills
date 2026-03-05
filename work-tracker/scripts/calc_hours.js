#!/usr/bin/env node
// 근무시간 계산 엔진 - 점심 차감, 추천 스케줄 생성

const WEEKLY_HOURS = 40;
const LUNCH_START = [12, 30];
const LUNCH_END = [13, 30];
const CORE_START = [11, 0];
const CORE_END = [17, 0];
const HALF_DAY_CREDIT = 4.0;
const VACATION_CREDIT = 8.0;
const FRIDAY_LEAVE = [17, 0];

function toMinutes(h, m) {
  return h * 60 + m;
}

function parseTime(s) {
  const parts = s.trim().split(":");
  return [parseInt(parts[0]), parseInt(parts[1])];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function lunchOverlapMinutes(startHm, endHm) {
  const s = toMinutes(...startHm);
  const e = toMinutes(...endHm);
  const ls = toMinutes(...LUNCH_START);
  const le = toMinutes(...LUNCH_END);
  return Math.max(0, Math.min(e, le) - Math.max(s, ls));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calcDayHours(day) {
  const status = day.status || "normal";

  if (status === "holiday" || status === "공휴일") {
    return { status: "holiday", worked: 0, credit: VACATION_CREDIT };
  }

  if (status === "vacation" || status === "휴가") {
    return { status: "vacation", worked: 0, credit: VACATION_CREDIT };
  }

  const clockIn = day.clock_in;
  const clockOut = day.clock_out;

  if (status === "half" || status === "반차") {
    let worked = 0;
    if (clockIn && clockOut) {
      const start = parseTime(clockIn);
      const end = parseTime(clockOut);
      const totalMin = toMinutes(...end) - toMinutes(...start);
      const lunchMin = lunchOverlapMinutes(start, end);
      worked = Math.max(0, totalMin - lunchMin) / 60;
    }
    return { status: "half", worked: round2(worked), credit: round2(HALF_DAY_CREDIT + worked) };
  }

  if (status === "today") {
    if (clockIn) {
      return { status: "today", clock_in: clockIn, worked: null, credit: null };
    }
    return { status: "today", worked: null, credit: null };
  }

  // normal
  if (!clockIn || !clockOut) {
    return { status: "normal", worked: 0, credit: 0 };
  }

  const start = parseTime(clockIn);
  const end = parseTime(clockOut);
  const totalMin = toMinutes(...end) - toMinutes(...start);
  const lunchMin = lunchOverlapMinutes(start, end);
  const worked = Math.max(0, totalMin - lunchMin) / 60;
  return { status: "normal", worked: round2(worked), credit: round2(worked) };
}

function recommendClockOut(clockInStr, neededHours) {
  const start = parseTime(clockInStr);
  const startMin = toMinutes(...start);
  const neededMin = neededHours * 60;
  let rawEnd = startMin + neededMin;

  const lunchS = toMinutes(...LUNCH_START);
  const lunchE = toMinutes(...LUNCH_END);

  if (startMin < lunchE && rawEnd > lunchS) {
    let overlap = Math.max(0, Math.min(rawEnd, lunchE) - Math.max(startMin, lunchS));
    rawEnd += overlap;
    const newOverlap = Math.max(0, Math.min(rawEnd, lunchE) - Math.max(startMin, lunchS));
    if (newOverlap > overlap) {
      rawEnd += newOverlap - overlap;
    }
  }

  const h = Math.floor(rawEnd / 60);
  const m = Math.floor(rawEnd % 60);
  return `${pad2(h)}:${pad2(m)}`;
}

function fridayFixedHours(clockInStr) {
  const start = parseTime(clockInStr);
  const totalMin = toMinutes(...FRIDAY_LEAVE) - toMinutes(...start);
  const lunchMin = lunchOverlapMinutes(start, FRIDAY_LEAVE);
  return Math.max(0, totalMin - lunchMin) / 60;
}

function generateRecommendations(todayInfo, remainingHours, remainingDays) {
  const recommendations = [];
  if (!remainingDays.length || remainingHours <= 0) return recommendations;

  const futureDays = remainingDays.slice(1);
  const isFriday = (dow) => dow === "Fri" || dow === "금";

  // Option 1: 균등 분배
  const opt1 = [];
  let left1 = remainingHours;

  for (const d of remainingDays) {
    const dow = d.day_of_week || "";
    const isToday = todayInfo && d.date === todayInfo.date;
    const ci = isToday && todayInfo ? (todayInfo.clock_in || "09:00") : "09:00";

    if (isFriday(dow)) {
      const fh = fridayFixedHours(ci);
      opt1.push({ date: d.date, day_of_week: dow, clock_in: ci, clock_out: `${pad2(FRIDAY_LEAVE[0])}:${pad2(FRIDAY_LEAVE[1])}`, hours: round2(fh) });
      left1 -= fh;
    } else {
      opt1.push({ date: d.date, day_of_week: dow, clock_in: ci, hours: null });
    }
  }

  const nonFri1 = opt1.filter((s) => s.hours === null);
  if (nonFri1.length) {
    const perDay = Math.max(0, left1 / nonFri1.length);
    for (const s of nonFri1) {
      s.hours = round2(perDay);
      s.clock_out = recommendClockOut(s.clock_in, perDay);
    }
  }
  recommendations.push({ option: "균등 분배", description: "남은 근무일에 균등하게 시간 분배 (금요일 17시 퇴근 고정)", schedule: opt1 });

  // Option 2: 오늘 코어타임 퇴근
  if (remainingDays.length >= 2 && todayInfo && todayInfo.clock_in) {
    const opt2 = [];
    let left2 = remainingHours;

    const todayCi = todayInfo.clock_in;
    const todayTotal = toMinutes(...CORE_END) - toMinutes(...parseTime(todayCi));
    const todayLunch = lunchOverlapMinutes(parseTime(todayCi), CORE_END);
    const todayH = Math.max(0, todayTotal - todayLunch) / 60;
    const todayDow = remainingDays[0].day_of_week || "";

    opt2.push({ date: remainingDays[0].date, day_of_week: todayDow, clock_in: todayCi, clock_out: `${pad2(CORE_END[0])}:${pad2(CORE_END[1])}`, hours: round2(todayH) });
    left2 -= todayH;

    for (const d of futureDays) {
      const dow = d.day_of_week || "";
      if (isFriday(dow)) {
        const fh = fridayFixedHours("09:00");
        opt2.push({ date: d.date, day_of_week: dow, clock_in: "09:00", clock_out: `${pad2(FRIDAY_LEAVE[0])}:${pad2(FRIDAY_LEAVE[1])}`, hours: round2(fh) });
        left2 -= fh;
      } else {
        opt2.push({ date: d.date, day_of_week: dow, clock_in: "09:00", hours: null });
      }
    }

    const nonFri2 = opt2.slice(1).filter((s) => s.hours === null);
    if (nonFri2.length) {
      const perDay2 = Math.max(0, left2 / nonFri2.length);
      for (const s of nonFri2) {
        s.hours = round2(perDay2);
        s.clock_out = recommendClockOut(s.clock_in, perDay2);
      }
    }
    recommendations.push({ option: "오늘 코어타임 퇴근", description: "오늘 17시 퇴근, 나머지 날에 분배 (금요일 17시 고정)", schedule: opt2 });
  }

  // Option 3: 오늘 몰아서
  if (remainingDays.length >= 2 && todayInfo && todayInfo.clock_in) {
    const opt3 = [];
    let left3 = remainingHours;
    let futureTotal = 0;
    const tempFuture = [];

    for (const d of futureDays) {
      const dow = d.day_of_week || "";
      if (isFriday(dow)) {
        const fh = fridayFixedHours("09:00");
        tempFuture.push({ date: d.date, day_of_week: dow, clock_in: "09:00", clock_out: `${pad2(FRIDAY_LEAVE[0])}:${pad2(FRIDAY_LEAVE[1])}`, hours: round2(fh) });
        futureTotal += fh;
      } else {
        tempFuture.push({ date: d.date, day_of_week: dow, clock_in: "09:00", clock_out: recommendClockOut("09:00", 8), hours: 8 });
        futureTotal += 8;
      }
    }

    const todayNeeded = Math.max(0, left3 - futureTotal);
    opt3.push({
      date: remainingDays[0].date, day_of_week: remainingDays[0].day_of_week || "",
      clock_in: todayInfo.clock_in, clock_out: recommendClockOut(todayInfo.clock_in, todayNeeded), hours: round2(todayNeeded),
    });
    opt3.push(...tempFuture);
    recommendations.push({ option: "오늘 몰아서 + 나머지 8시간", description: "나머지 날 8시간 기준, 부족분을 오늘 채움 (금요일 17시 고정)", schedule: opt3 });
  }

  return recommendations;
}

function main() {
  const args = process.argv.slice(2);
  const dataIdx = args.indexOf("--data");
  if (dataIdx === -1 || !args[dataIdx + 1]) {
    console.error(JSON.stringify({ error: "Usage: node calc_hours.js --data '<JSON>'" }));
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(args[dataIdx + 1]);
  } catch (e) {
    console.error(JSON.stringify({ error: `JSON 파싱 오류: ${e.message}` }));
    process.exit(1);
  }

  const days = data.days || [];
  const results = [];
  let totalCredit = 0;
  let todayInfo = null;
  const remainingDays = [];
  let foundToday = false;

  for (const day of days) {
    const r = calcDayHours(day);
    r.date = day.date || "";
    r.day_of_week = day.day_of_week || "";

    if (r.status === "today") {
      todayInfo = { ...day, ...r };
      foundToday = true;
      remainingDays.push(day);
    } else if (r.status === "holiday") {
      totalCredit += r.credit || 0;
    } else if (!foundToday) {
      totalCredit += r.credit || 0;
    } else {
      remainingDays.push(day);
    }

    results.push(r);
  }

  const remainingHours = Math.max(0, WEEKLY_HOURS - totalCredit);
  const recommendations = generateRecommendations(todayInfo, remainingHours, remainingDays);

  const output = {
    daily: results,
    total_credited: round2(totalCredit),
    weekly_target: WEEKLY_HOURS,
    remaining_hours: round2(remainingHours),
    recommendations,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
