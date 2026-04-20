# Seeday AI活人感系统 天气与季节实现方案（开发交付版）

- 版本: v2.0
- 日期: 2026-04-08
- 适用阶段: P1（可直接开发）
- 本版结论: 传给 AI 的环境变量最小化，只保留「温度 + 天气标签（可多标签） + 季节」，并支持业务预警（大风/雾霾）

---

## 1. 目标

在现有链路 `useAnnotationStore -> /api/annotation -> annotation-prompts` 中注入轻量环境上下文，满足：

1. 字段简单稳定，避免 prompt 复杂度过高。
2. 支持复合天气（例如同时下雨+大风）。
3. 支持业务预警（大风预警、雾霾预警）。
4. 外部天气异常时自动降级，不影响主链路。
5. `forceSuggestion=true` 时 suggestion JSON 格式不被破坏。

---

## 2. 最终数据契约（给 AI 的最小输入）

### 2.1 必传字段

```ts
type WeatherCondition =
  | 'sunny'
  | 'cloudy'
  | 'overcast'
  | 'rain_light'
  | 'rain_medium'
  | 'rain_heavy'
  | 'snow'
  | 'hail'
  | 'windy'
  | 'unknown';

type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'unknown';

type WeatherAlert =
  | 'strong_wind_watch'
  | 'haze_watch';

interface WeatherContextV2 {
  temperatureC: number | null;       // 直接数字，不再传 temperatureBand
  conditions: WeatherCondition[];    // 可多标签，如 ['rain_medium','windy']
  source: 'api' | 'fallback';
}

interface SeasonContextV2 {
  season: Season;                    // 仅保留季节
  source: 'local' | 'fallback';
}

interface AnnotationEnvContextV2 {
  weatherContext?: WeatherContextV2;
  seasonContext?: SeasonContextV2;
  weatherAlerts?: WeatherAlert[];    // 可选，空数组或不传都可
}
```

### 2.2 明确删除项（不传给 AI）

以下字段不进入 prompt：

- `temperatureBand`
- `precipitationLevel`
- `provider`
- `hemisphere`
- `seasonPhase`

说明：这些信息可保留在服务端日志，但不喂给模型。

---

## 3. 数据源与可行性结论

## 3.1 常规天气（可覆盖）

数据源：Open-Meteo Weather Forecast API（`/v1/forecast`）

建议读取 `current` 变量：

- `temperature_2m`
- `weather_code`
- `rain`
- `snowfall`
- `wind_speed_10m`
- `wind_gusts_10m`

可用于判断：晴/多云/阴天/雨强/雪/冰雹/大风。

## 3.2 雾霾（可覆盖）

数据源：Open-Meteo Air Quality API（`/v1/air-quality`）

建议读取 `current` 变量：

- `pm2_5`
- `pm10`
- `european_aqi`（可选）

可用于判断 `haze_watch`（业务预警，不是官方预警公告）。

## 3.3 官方预警说明（重要）

Open-Meteo 主天气接口不直接提供各国气象台“官方预警 bulletin”文本。

本方案采用“业务阈值预警”实现：

- 大风预警：按风速/阵风阈值触发
- 雾霾预警：按 PM2.5/PM10/AQI 阈值触发

后续若要接“官方预警”，需再接入国家级告警源（单独需求，不阻塞本版）。

---

## 4. 映射规则（可直接实现）

## 4.1 `conditions[]` 生成规则

`conditions` 是数组，可同时包含多个标签。

1. 先按 `weather_code` 写入基础天空/降水标签：
   - `0 -> sunny`
   - `1,2 -> cloudy`
   - `3 -> overcast`
   - `71-77, 85, 86 -> snow`
   - `96, 99 -> hail`（雷暴夹冰雹）

2. 再按 `rain (mm/h)` 追加雨强标签（与上面可并存）：
   - `0 < rain < 2 -> rain_light`
   - `2 <= rain < 8 -> rain_medium`
   - `rain >= 8 -> rain_heavy`

3. 按风追加 `windy`：
   - `wind_speed_10m >= 35 km/h` 或 `wind_gusts_10m >= 50 km/h` -> `windy`

4. 去重与兜底：
   - 去重后若数组为空，写入 `unknown`

### 4.2 复合天气示例

- 下中雨且刮风: `['rain_medium', 'windy']`
- 阴天有大风: `['overcast', 'windy']`
- 大雪: `['snow']`

### 4.3 季节规则

仅输出当前季节（北半球先行，南半球后续可加）：

- 3-5 月 -> `spring`
- 6-8 月 -> `summer`
- 9-11 月 -> `autumn`
- 12-2 月 -> `winter`

无法判断时 `unknown`。

---

## 5. 预警规则（业务阈值）

## 5.1 大风预警 `strong_wind_watch`

触发条件（满足其一）：

- `wind_gusts_10m >= 62 km/h`（推荐主阈值）
- 或 `wind_speed_10m >= 45 km/h`

## 5.2 雾霾预警 `haze_watch`

触发条件（满足其一）：

- `pm2_5 >= 75 ug/m3`
- 或 `pm10 >= 150 ug/m3`
- 或 `european_aqi >= 80`

> 注：以上为业务预警阈值，可在灰度后根据误报率再微调。

---

## 6. Prompt 注入规范（最小化）

注入位置：`Current holiday` 后、`Today's timeline` 前。

新增最多 3 行：

1. `Season: <season>`
2. `Weather: <temperatureC>C, <conditions_joined_by_comma>`
3. `Alerts: <alerts_joined_by_comma>`（仅当存在预警时注入）

示例：

```text
Season: spring
Weather: 18C, rain_medium, windy
Alerts: strong_wind_watch
```

约束：

1. 不修改 suggestion JSON schema。
2. `forceSuggestion=true` 时仅附加上下文，不改变“只输出 JSON”规则优先级。

---

## 7. 失败降级策略

## 7.1 天气接口失败

- `weatherContext.source='fallback'`
- `temperatureC=null`
- `conditions=['unknown']`

## 7.2 空气质量接口失败

- `weatherAlerts` 不传或传空数组

## 7.3 主链路保证

- 任一外部接口失败，不中断 `/api/annotation` 主请求
- `seasonContext` 本地计算继续可用

---

## 8. 开发落地清单（按文件）

1. `src/types/annotation.ts`
   - 新增 `WeatherCondition` / `WeatherAlert` / `WeatherContextV2` / `SeasonContextV2`
   - 扩展 `AnnotationRequest.userContext`：
     - `weatherContext?: WeatherContextV2`
     - `seasonContext?: SeasonContextV2`
     - `weatherAlerts?: WeatherAlert[]`

2. `src/server/weather-provider.ts`（新增）
   - 调 Open-Meteo 天气接口
   - 超时 800ms

3. `src/server/air-quality-provider.ts`（新增）
   - 调 Open-Meteo air-quality 接口
   - 超时 800ms

4. `src/server/weather-context.ts`（新增）
   - 将天气原始值映射为 `temperatureC + conditions[]`
   - 封装 fallback

5. `src/server/weather-alerts.ts`（新增）
   - 大风阈值判断
   - 雾霾阈值判断
   - 输出 `weatherAlerts[]`

6. `src/lib/seasonContext.ts`（新增）
   - 本地季节计算，仅输出 `season`

7. `src/server/annotation-handler.ts`
   - 在组装 prompt 前计算并注入 weather/season/alerts

8. `src/server/annotation-prompts.user.ts`
   - 在普通批注与 suggestion-aware prompt 中注入 2-3 行环境上下文

---

## 9. 可观测性与日志

仅打元数据日志，不记录原始 prompt 正文：

- `weather_source`
- `weather_conditions`
- `weather_temperature_c`
- `season`
- `alerts`
- `weather_fetch_ms`
- `air_quality_fetch_ms`

核心监控：

1. 天气请求成功率
2. 空气质量请求成功率
3. fallback 占比
4. `forceSuggestion=true` 下 suggestion JSON 解析失败率

---

## 10. 测试与验收

## 10.1 单测

1. `src/server/weather-context.test.ts`
   - 天气 code + rain + wind 到 `conditions[]` 的映射
   - 复合天气（雨+风）

2. `src/server/weather-alerts.test.ts`
   - 强风阈值触发
   - 雾霾阈值触发

3. `src/lib/seasonContext.test.ts`
   - 月份到季节映射

## 10.2 集成测试

1. 天气成功时 prompt 注入正确
2. 同时下雨+大风时能注入双标签
3. 天气超时时 fallback 生效
4. 空气质量失败不影响主链路
5. `forceSuggestion=true` 时 suggestion JSON 保持可解析

## 10.3 回归

1. `npx tsc --noEmit`
2. `npm run test:unit`
3. `npm run build`

---

## 11. 交付节奏

1. Step A（无外部依赖）
   - 先实现季节 + 天气 fallback + prompt 注入（本地 mock）

2. Step B（接入真实数据源）
   - 接 Open-Meteo Weather + Air Quality
   - 加超时与监控

3. Step C（灰度放量）
   - 10% -> 30% -> 100%
   - 观察误报率、JSON 稳定性、用户反馈

---

## 12. 开发默认值（避免争议）

1. 温度直接传数字 `temperatureC`。
2. 天气使用 `conditions[]`，允许多标签，不限制单值。
3. 预警为业务阈值预警，不等同官方气象公告。
4. 外部接口超时统一 800ms。
5. 任何异常不阻断 annotation 主链路。
