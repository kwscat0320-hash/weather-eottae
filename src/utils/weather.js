export const DEFAULT_LOCATION = { lat: 37.5665, lon: 126.978 };

export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ko`,
      { headers: { "Accept-Language": "ko" } }
    );
    const data = await res.json();
    const a = data.address;
    const dong = a.neighbourhood || a.suburb || a.quarter || "";
    const gu = a.borough || a.city_district || a.district || "";
    if (dong && gu) return `${gu} ${dong}`;
    if (dong) return dong;
    if (gu) return gu;
    return a.county || a.city || a.state || "현재 위치";
  } catch {
    return "현재 위치";
  }
}

export function getTheme(condition = "", air = null) {
  // 미세먼지/초미세먼지 나쁨(3) 이상이면 우선 적용 — 단, 천둥·눈·비 등 악천후보다는 후순위
  const airBad = air && (Number(air.pm10Grade) >= 3 || Number(air.pm25Grade) >= 3);

  if (condition.includes("천둥") || condition.includes("번개"))
    return {
      img: "/characters/thunder.png",
      bg: "from-slate-900 via-indigo-950 to-slate-800",
      card: "rgba(255,255,255,0.1)", cardsBg: "#1e2235",
      text: "#ffffff", sub: "#a5b4fc",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["오늘 천둥번개 진짜 무서워요...", "절대 밖에 나가지 마세요!", "저 좀 안아주세요 🥺"],
    };
  if (condition.includes("눈"))
    return {
      img: "/characters/snow.png",
      bg: "from-sky-100 via-blue-50 to-indigo-100",
      card: "rgba(255,255,255,0.6)", cardsBg: "#dde8f8",
      text: "#1e293b", sub: "#3b82f6",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["눈이 펑펑 와요! ❄️", "미끄러우니까 조심하세요~", "목도리 꼭 챙기기!"],
    };
  if (condition.includes("소나기"))
    return {
      img: "/characters/shower.png",
      bg: "from-slate-700 via-slate-600 to-slate-800",
      card: "rgba(255,255,255,0.1)", cardsBg: "#2d3748",
      text: "#ffffff", sub: "#cbd5e1",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["갑자기 소나기 쏟아져요!", "우산 꼭 챙기세요 ☔", "저는 이미 다 젖었어요..."],
    };
  if (condition.includes("비"))
    return {
      img: "/characters/rain.png",
      bg: "from-sky-500 via-blue-400 to-sky-600",
      card: "rgba(255,255,255,0.2)", cardsBg: "#1d6fa8",
      text: "#ffffff", sub: "#e0f2fe",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["비 오는 날도 나쁘지 않아요~ 🌧️", "우산 챙기셨나요?", "실내에서 따뜻하게 있어요!"],
    };
  if (condition.includes("흐림"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-400 via-slate-300 to-slate-400",
      card: "rgba(255,255,255,0.3)", cardsBg: "#a8b8cc",
      text: "#0f172a", sub: "#475569",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["흐리고 우중충한 날이에요.", "기분도 같이 꿀꿀하네요...", "그래도 비는 안 와요!"],
    };
  if (condition.includes("구름"))
    return {
      img: "/characters/cloudy.png",
      bg: "from-slate-200 via-sky-100 to-slate-200",
      card: "rgba(255,255,255,0.5)", cardsBg: "#d8e6f0",
      text: "#1e293b", sub: "#64748b",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["구름이 좀 있지만 괜찮아요!", "야외 활동 해볼 만해요 🐾", "가볍게 겉옷 하나 챙겨요~"],
    };
  // 미세먼지 나쁨 (맑음/구름 상황에서만 적용)
  if (airBad)
    return {
      img: "/characters/air.png",
      bg: "from-amber-200 via-orange-100 to-yellow-200",
      card: "rgba(255,255,255,0.45)", cardsBg: "#e8d5b0",
      text: "#1c1309", sub: "#92400e",
      bubble: "bg-white", bubbleText: "#1C283C",
      speech: ["오늘 미세먼지 나쁨이에요 😷", "마스크 꼭 쓰고 나가세요!", "가능하면 실내에 있어요~"],
    };
  // 맑음 (기본)
  return {
    img: "/characters/sunny.png",
    bg: "from-[#FFDF20] to-[#FDE585]",
    card: "rgba(255,254,254,0.4)", cardsBg: "#FDE585",
    text: "#0E162B", sub: "#BA4C00",
    bubble: "bg-white", bubbleText: "#1C283C",
    speech: ["오늘 날씨 너무 좋아요! ☀️", "나들이 가기 딱 좋은 날!", "저도 같이 나가고 싶어요 🐾"],
  };
}

export function gradeInfo(grade) {
  if (grade === "1") return { dotColor: "#22c55e", label: "좋음" };
  if (grade === "2") return { dotColor: "#3b82f6", label: "보통" };
  if (grade === "3") return { dotColor: "#8b5cf6", label: "나쁨" };
  if (grade === "4") return { dotColor: "#ef4444", label: "매우나쁨" };
  return { dotColor: "#6b7280", label: "-" };
}

export function getSpeech(theme, weather) {
  if (!weather) return theme.speech[0];
  return theme.speech[new Date().getHours() % theme.speech.length];
}

export const isKorea = (lat, lon) => lat >= 33 && lat <= 38.9 && lon >= 124 && lon <= 132;
