# Membership 项目现状（索引）

> DOC-DEPS: LLM.md -> docs/MEMBERSHIP_SPEC.md -> docs/CURRENT_TASK.md
> 更新时间：2026-04-22

本文件已收敛为索引入口，会员制度的详细现状、普通功能/会员功能对齐矩阵、支付闭环与差异项统一维护在：

- `docs/MEMBERSHIP_SPEC.md`

快速结论：

1. 会员判定以 `resolveMembershipState()`（metadata + 7天 trial）为准。
2. 普通功能与会员功能门控已覆盖 Profile / Chat / Growth / Report 主链路。
3. 当前剩余差异集中在权益文案、weekly/monthly 产品口径、批注配额文档漂移。
