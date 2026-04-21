# Plant Illustration Prompt Template

用于 Gemini 网页版生成植物插画。将 `【】` 内的变量替换为目标植物的实际内容。

## 工作流

1. 查 `docs/plant_assets_registry.csv`，找到待生成的植物
2. 搜索该植物的真实照片（Google/Pinterest），了解花朵形态、配色、叶片特征，准备 2–3 张参考图
3. 按下方模板填写 prompt，把参考图一起上传给 Gemini 生图
4. 生图完成后运行脚本裁切归档：
   ```bash
   python scripts/process_plant_image.py <原图路径> <rootType> <序号> <中文名> <英文名> <意大利文名>
   ```

---

## Prompt 模板

```
2D flat UI botanical illustration, modern mobile app icon 
style, no outline, no sticker border.
transparent background, PNG with alpha channel, no white fill, no solid color fill behind plant.

[SUBJECT]:
a natural cluster of 【植物英文名】(【植物中文名】), 
3–5 【stems/branches】 arranged organically and asymmetrically.
【花朵特征，例如：delicate small orchid-like flowers with 
elongated lower lips and soft curved petals】
simplified into clean rounded vector-like shapes — 
no fine botanical detail.

[COMPOSITION & GROUNDING]:
stems emerge naturally from the bottom of the frame,
roots and base are NOT visible — stems simply begin 
from the lower portion of the image.
no moss, no soil, no ground plane, no oval base,
no drop shadow, no ground shadow, no ambient glow at base.
3–5 fine 【叶片形态，例如：thread-like】 leaves at stem 
base only, sparse and minimal — not dense, not tangled,
leaves are short and simple, pointing outward naturally.
stems at bottom are slightly grouped and close together,
naturally spacing out and fanning upward.
the very bottom 15% of the image is empty white space —
stems do not touch the bottom edge.
overall silhouette: wider at top, narrower at bottom.
flowers at slightly different heights and depths — front 
flowers slightly larger, back flowers slightly smaller.
natural overlapping between stems and flowers.

[TWO PANELS - SAME CANVAS]:
render as ONE horizontal image with TWO side-by-side panels.
BOTH panels must share identical structure, scale, layout 
and camera angle — only the 【差异内容】 differs.

【根据植物类型选择一组，其余删除】

→ 有花苞的植物：
LEFT panel: full bloom, all flowers open.
RIGHT panel: pre-bloom, all flowers as closed buds.

→ 无花苞/直接开放型花朵（如罂粟/牵牛）：
LEFT panel: full bloom, flowers fully open.
RIGHT panel: wilting state, petals slightly drooping 
and closing inward.

→ 纯叶/草类植物（无花）：
LEFT panel: lush and full, leaves at peak growth.
RIGHT panel: sparse and young, fewer leaves, 
smaller and lighter in color.

→ 果实类植物：
LEFT panel: fully ripe, fruit at full color and size.
RIGHT panel: unripe, fruit small and pale green.

[PETAL SHADING]:
each petal: single smooth gradient, lighter at center/top, 
slightly deeper at edge/bottom.
subtle inner highlight on largest petal.
shape defined by color contrast only — no outlines.

[COLOR]:
soft muted pastel — 【植物真实配色，例如：light purple, 
lavender, soft yellow accents】
based on real 【植物英文名】 colors.
max 2–3 tones per element, no high saturation.
stems and leaves: 【茎叶颜色，例如：soft muted green】, 
same gradient rule.

[STYLE]:
flat 2D vector look, smooth edges, rounded forms.
no texture, no noise, no leaf veins.
no background, no decoration.

[PROHIBIT]:
photorealism, 3D, single stem, symmetric layout,
complex gradients, dark tones, sticker border,
cut-off stems, floating unanchored plant,
leaf cluster at base, ground mass, root bundle,
heavy bottom composition, dense tangled leaves,
drop shadow, ground shadow, ambient glow at base,
inconsistent structure between two panels.
```

---

## 变量说明

| 变量 | 说明 | 示例 |
|------|------|------|
| `【植物英文名】` | 植物英文名 | Clematis |
| `【植物中文名】` | 植物中文名 | 铁线莲 |
| `【stems/branches】` | 茎的类型 | stems / branches / stalks |
| `【花朵特征】` | 花朵外观描述 | delicate small orchid-like flowers with elongated lower lips |
| `【叶片形态】` | 叶片形状描述 | thread-like / broad oval / heart-shaped |
| `【差异内容】` | 两图差异说明 | bloom stage |
| `【植物真实配色】` | 主色调 | light purple, lavender, soft yellow accents |
| `【茎叶颜色】` | 茎叶颜色 | soft muted green |

---

## rootType 对照表

| rootType | 含义 |
|----------|------|
| `bra` | 分枝类（带树枝感） |
| `bul` | 球根类 |
| `fib` | 纤维根类 |
| `sha` | 伞形花序类 |
| `tap` | 直根类 |

---

## 裁切脚本用法

```bash
python scripts/process_plant_image.py <原图路径> <rootType> <序号> <中文名> <英文名> <意大利文名>
```

示例：
```bash
python scripts/process_plant_image.py ~/Desktop/raw/clematis.png bra 2 铁线莲 Clematis Clematide
```

脚本自动完成：
- 左半 → `{rootType}_late_{idx}.png`（盛开 / 成熟状态）
- 右半 → `{rootType}_early_{idx}.png`（花苞 / 未熟状态）
- 各自 resize 到 450×450 px
- 保存到 `public/assets/plants/`
- 追加行到 `docs/plant_assets_registry.csv`
