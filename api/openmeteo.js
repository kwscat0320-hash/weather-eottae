// GET /api/openmeteo?lat=37.5&lon=126.9
// Open-Meteo API — 무료, 키 불필요

async function httpsGetJson(urlStr) {
  const res = await fetch(urlStr, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// PM10 수치 → 한국 등급
function pm10ToGrade(v) { return v <= 30 ? "1" : v <= 80 ? "2" : v <= 150 ? "3" : "4"; }
// PM2.5 수치 → 한국 등급
function pm25ToGrade(v) { return v <= 15 ? "1" : v <= 35 ? "2" : v <= 75 ? "3" : "4"; }

// WMO weather code → 한국어 날씨
function wmoToCondition(code) {
  if (code === 0)  return "맑음";
  if (code <= 2)   return "구름많음";
  if (code === 3)  return "흐림";
  if (code <= 49)  return "안개";
  if (code <= 59)  return "이슬비";
  if (code <= 69)  return "비";
  if (code <= 79)  return "눈";
  if (code <= 82)  return "소나기";
  if (code <= 84)  return "소나기";
  if (code <= 94)  return "천둥번개";
  return "천둥번개";
}

// 풍향 각도 → 16방위 한국어
function degToCompass(deg) {
  if (deg == null) return null;
  const dirs = ["북","북북동","북동","동북동","동","동남동","남동","남남동",
                "남","남남서","남서","서남서","서","서북서","북서","북북서"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// UV 지수 → 한국어 등급
function uvLevel(uv) {
  if (uv == null) return null;
  if (uv < 3)  return "낮음";
  if (uv < 6)  return "보통";
  if (uv < 8)  return "높음";
  if (uv < 11) return "매우높음";
  return "위험";
}

// 초(seconds) → "H시간 M분" 포맷
function secToHM(sec) {
  if (sec == null) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "lat, lon 필요" });

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      // ── 현재 날씨 (15개 변수) ─────────────────────────────────────────────
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,` +
      `precipitation,weather_code,cloud_cover,` +
      `wind_speed_10m,wind_direction_10m,wind_gusts_10m,` +
      `pressure_msl,surface_pressure,visibility,uv_index,is_day` +
      // ── 시간별 예보 (21개 변수) ──────────────────────────────────────────
      `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,` +
      `precipitation_probability,precipitation,rain,snowfall,weather_code,` +
      `cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,` +
      `visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,` +
      `pressure_msl,uv_index,is_day,freezing_level_height` +
      // ── 일별 예보 (17개 변수) ────────────────────────────────────────────
      `&daily=temperature_2m_max,temperature_2m_min,` +
      `apparent_temperature_max,apparent_temperature_min,` +
      `precipitation_sum,precipitation_hours,precipitation_probability_max,` +
      `weather_code,sunrise,sunset,sunshine_duration,daylight_duration,` +
      `wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,` +
      `uv_index_max,shortwave_radiation_sum` +
      `&timezone=Asia%2FSeoul&forecast_days=8&wind_speed_unit=ms`;

    // 대기질: PM + AQI + 가스 성분
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,us_aqi,european_aqi,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide,dust` +
      `&domains=cams_global`;

    const [data, airData] = await Promise.all([
      httpsGetJson(weatherUrl),
      httpsGetJson(airUrl).catch(() => null),
    ]);

    // Open-Meteo API 오류 시 상세 메시지 반환
    if (data.error) {
      return res.status(502).json({ error: `Open-Meteo: ${data.reason || JSON.stringify(data)}` });
    }

    const c = data.current;
    const d = data.daily;
    const h = data.hourly;

    if (!c || !d || !h) {
      return res.status(502).json({ error: "Open-Meteo 응답 구조 이상", raw: JSON.stringify(data).slice(0, 300) });
    }

    const now = new Date();
    const nowHour = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0") + "T" +
      String(now.getHours()).padStart(2, "0") + ":00";

    // Open-Meteo current.time = 모델이 유효한 시각 (ex. "2025-06-10T14:00")
    // 이걸 observedAt으로 사용해야 "얼마나 최신인지" 정직하게 표시됨
    const modelTime = c.time ? new Date(c.time) : now;
    const mHH = String(modelTime.getHours()).padStart(2, "0");
    const mMM = String(modelTime.getMinutes()).padStart(2, "0");

    // ── 시간별 예보 (현재 ~ +23h) ─────────────────────────────────────────
    const startIdx = (h.time || []).findIndex(t => t >= nowHour);
    const forecast = [];
    for (let i = Math.max(0, startIdx); i < Math.min((h.time || []).length, startIdx + 24); i++) {
      const t = new Date(h.time[i]);
      forecast.push({
        timeLabel:      `${String(t.getHours()).padStart(2, "0")}:00`,
        temp:           h.temperature_2m[i],
        feelsLike:      h.apparent_temperature[i],
        humidity:       h.relative_humidity_2m[i],
        dewPoint:       h.dew_point_2m?.[i],
        rainChance:     h.precipitation_probability[i] ?? 0,
        precipitation:  h.precipitation?.[i] ?? 0,
        rain:           h.rain?.[i] ?? 0,
        snowfall:       h.snowfall?.[i] ?? 0,
        condition:      wmoToCondition(h.weather_code[i]),
        cloudCover:     h.cloud_cover?.[i],
        cloudLow:       h.cloud_cover_low?.[i],
        cloudMid:       h.cloud_cover_mid?.[i],
        cloudHigh:      h.cloud_cover_high?.[i],
        visibility:     h.visibility?.[i],
        wind:           h.wind_speed_10m?.[i],
        windDir:        h.wind_direction_10m?.[i],
        windDirLabel:   degToCompass(h.wind_direction_10m?.[i]),
        windGust:       h.wind_gusts_10m?.[i],
        pressure:       h.pressure_msl?.[i],
        uvIndex:        h.uv_index?.[i],
        isDay:          h.is_day?.[i],
        freezingLevel:  h.freezing_level_height?.[i],
      });
    }

    // ── 일별 예보 (8일) ──────────────────────────────────────────────────
    const daily = (d.time || []).map((dateStr, i) => {
      const dateObj = new Date(dateStr + "T00:00:00");
      const dateLabel = dateObj.toLocaleDateString("ko-KR", {
        month: "numeric", day: "numeric", weekday: "short",
      });
      const sunriseStr = d.sunrise?.[i] ?? null;
      const sunsetStr  = d.sunset?.[i]  ?? null;
      const fmtTime = (s) => {
        if (!s) return null;
        const t = new Date(s);
        return `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`;
      };
      return {
        dateLabel,
        tempMax:            d.temperature_2m_max?.[i],
        tempMin:            d.temperature_2m_min?.[i],
        feelsLikeMax:       d.apparent_temperature_max?.[i],
        feelsLikeMin:       d.apparent_temperature_min?.[i],
        precipSum:          d.precipitation_sum?.[i] ?? 0,
        precipHours:        d.precipitation_hours?.[i] ?? 0,
        rainChance:         d.precipitation_probability_max?.[i] ?? 0,
        condition:          wmoToCondition(d.weather_code?.[i]),
        sunrise:            fmtTime(sunriseStr),
        sunset:             fmtTime(sunsetStr),
        sunshineDuration:   secToHM(d.sunshine_duration?.[i]),
        daylightDuration:   secToHM(d.daylight_duration?.[i]),
        windMax:            d.wind_speed_10m_max?.[i],
        windGustMax:        d.wind_gusts_10m_max?.[i],
        windDirDominant:    degToCompass(d.wind_direction_10m_dominant?.[i]),
        uvMax:              d.uv_index_max?.[i],
        uvLevel:            uvLevel(d.uv_index_max?.[i]),
        solarRadiation:     d.shortwave_radiation_sum?.[i],
      };
    });

    // ── 현재 날씨 응답 ───────────────────────────────────────────────────
    return res.status(200).json({
      // 기존 호환 필드
      condition:   wmoToCondition(c.weather_code),
      temp:        c.temperature_2m,
      feelsLike:   c.apparent_temperature,
      high:        d.temperature_2m_max?.[0] ?? c.temperature_2m,
      low:         d.temperature_2m_min?.[0] ?? c.temperature_2m,
      humidity:    c.relative_humidity_2m,
      wind:        c.wind_speed_10m,
      rainChance:  h.precipitation_probability?.[startIdx] ?? 0,
      observedAt:  `${mHH}:${mMM} (Open-Meteo 모델)`,
      // 신규 현재 날씨 필드
      dewPoint:       c.dew_point_2m,
      precipitation:  c.precipitation ?? 0,
      cloudCover:     c.cloud_cover,
      windDir:        c.wind_direction_10m,
      windDirLabel:   degToCompass(c.wind_direction_10m),
      windGust:       c.wind_gusts_10m,
      pressureMsl:    c.pressure_msl,
      surfacePressure: c.surface_pressure,
      visibility:     c.visibility,
      uvIndex:        c.uv_index,
      uvLevel:        uvLevel(c.uv_index),
      isDay:          c.is_day,
      // 오늘 일출/일몰
      sunrise:        daily[0]?.sunrise ?? null,
      sunset:         daily[0]?.sunset  ?? null,
      sunshineDuration: daily[0]?.sunshineDuration ?? null,
      uvMax:          daily[0]?.uvMax ?? null,
      // 예보
      forecast,
      daily,
      // 대기질
      air: airData?.current ? {
        pm10:       Math.round(airData.current.pm10  ?? 0),
        pm25:       Math.round(airData.current.pm2_5 ?? 0),
        pm10Grade:  pm10ToGrade(airData.current.pm10  ?? 0),
        pm25Grade:  pm25ToGrade(airData.current.pm2_5 ?? 0),
        usAqi:      Math.round(airData.current.us_aqi       ?? 0),
        euAqi:      Math.round(airData.current.european_aqi ?? 0),
        no2:        Math.round(airData.current.nitrogen_dioxide ?? 0),
        o3:         Math.round(airData.current.ozone          ?? 0),
        so2:        Math.round(airData.current.sulphur_dioxide ?? 0),
        co:         Math.round(airData.current.carbon_monoxide ?? 0),
        dust:       Math.round(airData.current.dust           ?? 0),
        source:     "Open-Meteo",
      } : null,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message, cause: err.cause?.message ?? String(err.cause ?? "") });
  }
}
