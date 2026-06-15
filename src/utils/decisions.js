// ══════════════════════════════════════════════════════════════════════════
// decisions.js — 날씨 데이터 → 행동 판단 함수 모음
// 각 함수는 { title, status, summary, reason[], score? } 를 반환한다
// status: "good" | "normal" | "warning" | "bad"
// ══════════════════════════════════════════════════════════════════════════

const hasRain = (condition = "") =>
  ["비", "눈", "소나기", "이슬비", "뇌우", "천둥"].some(k => condition.includes(k));

// ── 1. 우산 ──────────────────────────────────────────────────────────────
export function getUmbrellaDecision(weather) {
  const { rainChance = 0, condition = "" } = weather || {};
  const rainCond = hasRain(condition);

  if (rainChance >= 60 || rainCond) {
    return {
      title: "우산 챙길까?",
      status: "bad",
      summary: "우산 꼭 챙기세요",
      reason: [
        rainChance >= 60 ? `강수확률 ${rainChance}%로 높아요` : null,
        rainCond ? `현재 날씨: ${condition}` : null,
      ].filter(Boolean),
      criteria: ["강수확률 60% 이상 → 우산 필수", "비/눈/소나기 날씨 → 우산 필수"],
    };
  }
  if (rainChance >= 30) {
    return {
      title: "우산 챙길까?",
      status: "warning",
      summary: "접이식 우산 챙겨두세요",
      reason: [`강수확률 ${rainChance}%, 갑자기 비 올 수 있어요`],
      criteria: ["강수확률 30~59% → 접이식 우산 권장"],
    };
  }
  return {
    title: "우산 챙길까?",
    status: "good",
    summary: "우산 없어도 괜찮아요",
    reason: [`강수확률 ${rainChance}%로 낮아요`],
    criteria: ["강수확률 30% 미만 → 우산 불필요"],
  };
}

// ── 2. 빨래 ──────────────────────────────────────────────────────────────
export function getLaundryDecision(weather) {
  const { rainChance = 0, humidity = 60, wind = 2, temp = 20 } = weather || {};

  let score = 100;
  const deductions = [];

  if (rainChance > 30) {
    score -= 40;
    deductions.push(`강수확률 ${rainChance}% (-40점)`);
  }
  if (humidity > 75) {
    score -= 25;
    deductions.push(`습도 ${humidity}% 높음 (-25점)`);
  }
  if (wind < 1.5) {
    score -= 10;
    deductions.push(`풍속 ${Number(wind).toFixed(1)}m/s 낮음 (-10점)`);
  }
  if (temp < 15) {
    score -= 10;
    deductions.push(`기온 ${Number(temp).toFixed(1)}°C 낮음 (-10점)`);
  }

  if (score >= 80) {
    return {
      title: "빨래해도 될까?",
      status: "good",
      summary: "빨래하기 딱 좋은 날",
      reason: deductions.length ? deductions : ["강수 없고 바람과 온도 양호해요"],
      score,
      criteria: ["80점 이상 → 빨래 추천", "강수확률 30% 초과 -40점, 습도 75% 초과 -25점", "풍속 1.5m/s 미만 -10점, 기온 15°C 미만 -10점"],
    };
  }
  if (score >= 50) {
    return {
      title: "빨래해도 될까?",
      status: "warning",
      summary: "오전에 짧게 돌리는 걸 추천해요",
      reason: deductions,
      score,
      criteria: ["50~79점 → 오전/짧은 시간 권장"],
    };
  }
  return {
    title: "빨래해도 될까?",
    status: "bad",
    summary: "오늘은 빨래 미루세요",
    reason: deductions,
    score,
    criteria: ["50점 미만 → 빨래 비추천"],
  };
}

// ── 3. 산책 / 러닝 ───────────────────────────────────────────────────────
export function getRunningDecision(weather, air) {
  const { rainChance = 0, feelsLike = 20, condition = "", wind = 2 } = weather || {};
  const pm10 = air?.pm10 ?? 0;
  const pm10Grade = air?.pm10Grade ?? "1";

  const warnings = [];

  if (feelsLike >= 33) warnings.push(`체감온도 ${Number(feelsLike).toFixed(1)}°C, 야외 활동 위험`);
  if (feelsLike <= 0)  warnings.push(`체감온도 ${Number(feelsLike).toFixed(1)}°C, 동상 주의`);
  if (pm10 >= 80 || pm10Grade === "3" || pm10Grade === "4")
    warnings.push(`미세먼지 PM10 ${pm10}㎍/㎥, 마스크 착용 필수`);
  if (rainChance >= 50) warnings.push(`강수확률 ${rainChance}%, 비 올 가능성`);
  if (hasRain(condition)) warnings.push(`현재 ${condition} 날씨`);

  if (warnings.length >= 2) {
    return {
      title: "산책/러닝 가능할까?",
      status: "bad",
      summary: "오늘은 실내 운동을 추천해요",
      reason: warnings.slice(0, 2),
      criteria: ["체감 33°C 이상, PM10 80 이상, 강수확률 50% 이상 중 2개 이상 → 비추"],
    };
  }
  if (warnings.length === 1) {
    return {
      title: "산책/러닝 가능할까?",
      status: "warning",
      summary: "주의하며 짧게 나가세요",
      reason: warnings,
      criteria: ["주의 조건 1개 해당 → 단시간 외출 권장"],
    };
  }

  const tip = feelsLike >= 25
    ? "이른 아침이나 저녁 시간대를 추천해요"
    : "지금 나가기 딱 좋아요!";

  return {
    title: "산책/러닝 가능할까?",
    status: "good",
    summary: tip,
    reason: [
      `체감온도 ${Number(feelsLike).toFixed(1)}°C`,
      pm10 > 0 ? `미세먼지 ${pm10}㎍/㎥ 양호` : "미세먼지 정보 없음",
    ],
    criteria: ["체감 0~32°C, PM10 80 미만, 강수 50% 미만 → 추천"],
  };
}

// ── 4. 옷차림 ─────────────────────────────────────────────────────────────
export function getOutfitDecision(weather) {
  const { feelsLike = 20, high = 20, low = 10, temp = 20 } = weather || {};
  // 최고 체감온도 기준으로 낮 옷차림 결정
  const ref = feelsLike;

  let outfit, items, status;

  if (ref >= 28) {
    outfit = "반팔 · 가벼운 옷";
    items = ["반팔 티셔츠", "얇은 면바지 또는 반바지"];
    status = "good";
  } else if (ref >= 23) {
    outfit = "반팔 또는 얇은 셔츠";
    items = ["반팔", "얇은 셔츠", "면바지"];
    status = "good";
  } else if (ref >= 17) {
    outfit = "얇은 긴팔";
    items = ["긴팔 티셔츠", "얇은 긴바지"];
    status = "normal";
  } else if (ref >= 10) {
    outfit = "가디건 · 자켓";
    items = ["가디건", "자켓", "얇은 아우터"];
    status = "normal";
  } else {
    outfit = "두꺼운 외투 필수";
    items = ["코트 또는 패딩", "목도리", "장갑 챙기세요"];
    status = "warning";
  }

  const tempRange = Math.abs(high - low);
  const layerTip = tempRange >= 10 ? `일교차 ${tempRange.toFixed(0)}°C, 겉옷 챙기세요` : null;

  return {
    title: "옷차림 어떻게?",
    status,
    summary: outfit,
    reason: [
      `체감온도 ${Number(ref).toFixed(1)}°C 기준`,
      ...(layerTip ? [layerTip] : []),
    ],
    items,
    criteria: ["28°C+ 반팔", "23~27°C 얇은 셔츠", "17~22°C 긴팔", "10~16°C 자켓", "9°C 이하 외투"],
  };
}

// ── 5. 예보 신뢰도 ───────────────────────────────────────────────────────
export function getForecastConfidence(weather, compareWeather, meteoWeather) {
  const sources = [
    weather       ? { name: "기상청",   rainChance: weather.rainChance ?? 0,       temp: weather.temp ?? 0 } : null,
    compareWeather ? { name: "ECMWF",   rainChance: compareWeather.rainChance ?? 0, temp: compareWeather.temp ?? 0 } : null,
    meteoWeather  ? { name: "오픈메테오", rainChance: meteoWeather.rainChance ?? 0,  temp: meteoWeather.temp ?? 0 } : null,
  ].filter(Boolean);

  if (sources.length < 2) {
    return {
      title: "예보 믿어도 될까?",
      status: "normal",
      summary: "단일 예보 기준이에요",
      reason: ["비교할 보조 모델 데이터가 아직 로딩 중이에요"],
      score: null,
      criteria: ["모델 2개 이상 수집 후 신뢰도 비교 가능"],
    };
  }

  const rainValues = sources.map(s => s.rainChance);
  const tempValues = sources.map(s => s.temp);
  const rainSpread = Math.max(...rainValues) - Math.min(...rainValues);
  const tempSpread = Math.max(...tempValues) - Math.min(...tempValues);

  const modelNames = sources.map(s => s.name).join(" · ");
  const details = sources.map(s => `${s.name}: 강수 ${s.rainChance}% / 기온 ${Number(s.temp).toFixed(1)}°`);

  if (rainSpread >= 30 || tempSpread >= 3) {
    return {
      title: "예보 믿어도 될까?",
      status: "warning",
      summary: "모델마다 예보가 갈려요",
      reason: [
        rainSpread >= 30 ? `강수확률 차이 ${rainSpread}%p (${modelNames})` : null,
        tempSpread >= 3  ? `기온 차이 ${tempSpread.toFixed(1)}°C (${modelNames})` : null,
      ].filter(Boolean),
      details,
      score: Math.round(100 - rainSpread * 0.8 - tempSpread * 5),
      criteria: ["강수확률 30%p 이상 차이 → 신뢰도 낮음", "기온 3°C 이상 차이 → 신뢰도 낮음"],
    };
  }

  return {
    title: "예보 믿어도 될까?",
    status: "good",
    summary: "모델들이 비슷하게 봐요",
    reason: [
      `강수 차이 ${rainSpread}%p, 기온 차이 ${tempSpread.toFixed(1)}°C`,
      `비교 모델: ${modelNames}`,
    ],
    details,
    score: Math.round(100 - rainSpread * 0.8 - tempSpread * 5),
    criteria: ["강수확률 차이 30%p 미만, 기온 차이 3°C 미만 → 신뢰도 높음"],
  };
}

// ── 오늘의 결론 문장 생성 ──────────────────────────────────────────────────
export function getTodaySummary(umbrella, laundry, running, outfit, confidence) {
  const lines = [];

  // 가장 중요한 경고 먼저
  if (umbrella.status === "bad") {
    lines.push("비가 예상돼요. 외출 시 우산 꼭 챙기세요.");
  } else if (umbrella.status === "warning") {
    lines.push("비 올 수도 있으니 접이식 우산을 챙기는 게 안전해요.");
  }

  if (running.status === "bad") {
    lines.push("미세먼지나 더위로 야외 운동은 피하는 게 좋아요.");
  }

  if (confidence.status === "warning") {
    lines.push("모델마다 예보가 달라 날씨가 변동성이 있어요.");
  }

  // 좋은 소식
  if (laundry.status === "good" && umbrella.status === "good") {
    lines.push("빨래 말리기 좋은 날이에요.");
  }

  if (lines.length === 0) {
    lines.push(`${outfit.summary}이 어울리는 날씨예요. 오늘 하루도 좋은 하루 되세요!`);
  }

  return lines.join(" ");
}
