# 星尘珍藏 (Stardust Memories) 热区测试文档

> 状态说明：Stardust 功能已在当前版本实现并接入生产路径（前端在 `src/components/feedback/AIAnnotationBubble.tsx` 提取批注 emoji，并写入 `src/store/useStardustStore.ts`）。

## 热区设计规范

### StardustEmoji 组件热区

| 属性 | 值 | 说明 |
|------|-----|------|
| 显示尺寸 | 20×20pt (sm) / 24×24pt (md) / 32×32pt (lg) | Emoji实际显示大小 |
| 点击热区 | 44×44pt | 符合WCAG 2.1标准，便于触摸操作 |
| 扩展方式 | padding + margin | 通过CSS扩展实际点击区域 |

### 热区防冲突设计

```
Activity Record Card Layout:
┌─────────────────────────────────────────────────────┐
│ ● 写代码                                           │
│   12-15 14:00 - 12-15 15:30              [编辑]     │  ← 右上角操作按钮（hover显示）
│   耗时 1h30m  [🌟]                         [插入]     │  ← Emoji在耗时旁，不与按钮重叠
│                                            [删除]     │
└─────────────────────────────────────────────────────┘
```

**设计决策：**
1. Emoji放置在**左下角**（耗时信息旁边），与右上角操作按钮对角分布
2. 操作按钮只在**hover时显示**，平时不占用空间
3. Emoji点击热区（44pt）与卡片其他区域无重叠

## 点击事件处理

### 事件冒泡控制

```typescript
// StardustEmoji 组件内
<button
  onClick={(e) => {
    e.stopPropagation(); // 阻止事件冒泡到父元素
    onClick?.(e);
  }}
>
```

**为什么要阻止冒泡：**
- 防止点击Emoji时触发消息卡片的其他点击事件
- 避免误操作（如误删、误编辑）

### 热区测试要点

#### 1. 移动端触摸测试
- [ ] iOS Safari（iPhone SE/12/14系列）
- [ ] Android Chrome（中低端机型）
- [ ] 微信内置浏览器

**测试步骤：**
1. 点击Emoji图标，确认弹出查看卡片
2. 快速连续点击，确认无重复触发
3. 点击Emoji边缘（接近边界处），确认仍可响应
4. 在Emoji位置滑动列表，确认列表可正常滚动

#### 2. 桌面端鼠标测试
- [ ] Chrome/Edge/Firefox/Safari
- [ ] 不同屏幕分辨率（1920×1080, 1440×900, 1366×768）

**测试步骤：**
1. 鼠标悬停确认呼吸动画正常
2. 点击确认查看卡片弹出
3. 点击卡片外部区域确认关闭
4. 按ESC键确认可关闭卡片

#### 3. 冲突场景测试

| 场景 | 预期行为 | 测试方式 |
|------|----------|----------|
| 点击Emoji时hover操作按钮 | Emoji响应，操作按钮不响应 | 快速移动鼠标后点击 |
| 点击Emoji后快速点击操作按钮 | 卡片先弹出，操作按钮后响应（如有） | 快速连续点击不同区域 |
| 滚动列表时点击Emoji | 列表停止滚动，卡片弹出 | 滚动中快速点击 |

### 可访问性（A11y）

```typescript
// StardustEmoji 组件
<button
  title="点击查看珍藏"  // 屏幕阅读器提示
  aria-label="查看星尘珍藏：{emojiChar}"
>
```

### 性能考虑

1. **事件委托**：不使用全局事件监听，每个Emoji独立绑定
2. **防抖处理**：动画触发使用requestAnimationFrame
3. **内存管理**：组件卸载时清理事件监听器

## 调试技巧

### 查看热区边界

在浏览器DevTools中添加以下CSS来临时显示热区边界：

```css
/* 临时调试用 */
.stardust-emoji {
  outline: 1px solid red !important;
  background: rgba(255, 0, 0, 0.1) !important;
}
```

### 验证stopPropagation

在控制台添加以下代码来验证事件冒泡是否被正确阻止：

```javascript
// 监听消息卡片点击
document.querySelectorAll('.message-card').forEach(card => {
  card.addEventListener('click', (e) => {
    console.log('Card clicked', e.target);
  });
});

// 监听Emoji点击
document.querySelectorAll('.stardust-emoji').forEach(emoji => {
  emoji.addEventListener('click', (e) => {
    console.log('Emoji clicked, propagation stopped:', e.isPropagationStopped);
  });
});
```

## 已知限制

1. **iOS 双击缩放**：快速双击Emoji可能触发页面缩放（已添加`touch-action: manipulation`缓解）
2. **Android 触摸延迟**：部分Android设备有300ms触摸延迟（使用FastClick或CSS `touch-action`优化）

## 验收标准

- [ ] 44pt热区在移动端可正常点击
- [ ] 与右上角操作按钮无点击冲突
- [ ] 滚动列表时点击不卡顿
- [ ] 屏幕阅读器可正常识别
- [ ] 低端设备（2GB RAM）操作流畅
