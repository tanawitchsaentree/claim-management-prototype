# Design Principles — Claim Management

## Hierarchy ของหน้า claim ทุกหน้า

1. **Status ก่อนเสมอ** — user เปิดมาต้องเห็นทันทีว่า claim อยู่ขั้นไหน (badge/chip ที่ fold บน)
2. **Action ขวาบน** — ปุ่มหลัก 1 ปุ่ม (Submit / Approve / Reject) อยู่มุมขวาบนของ content area เสมอ ปุ่มรอง (secondary/tertiary) เรียงซ้ายไล่ความสำคัญลดลง
3. **Data ตรงกลาง** — แบ่ง section ชัดเจนด้วย heading + divider อย่ายัด white space คือ structure ไม่ใช่ waste
4. **Meta ล่าง** — created date, claim ID, audit trail, last modified อยู่ล่างสุดของ page หรือ sidebar

---

## Layout Patterns

### List page (`/claims`)
```
┌─────────────────────────────────────────────┐
│  Page title                    [+ New claim] │
├──────────┬──────────────────────────────────┤
│ Filter   │  Table (columns: ID / Client /   │
│ sidebar  │  Status / Date / Assignee /      │
│  (left)  │  Action)                         │
│          ├──────────────────────────────────┤
│          │  Pagination                      │
└──────────┴──────────────────────────────────┘
```
- Filter bar: ซ้าย fixed width ~240px
- Table: flex-1, ใช้ `nx-table` จาก ng-aquila
- Status column ใช้ chip/badge เสมอ ห้ามใช้ text ล้วน

### Detail page (`/claims/:id`)
```
┌─────────────────────────────────────────────┐
│  ← Back   Claim ID   Status badge  [Action] │
├──────────────────────┬──────────────────────┤
│                      │  Sidebar (1/3)       │
│  Main data (2/3)     │  - Key numbers       │
│  - Section A         │  - Assignee          │
│  - Section B         │  - Timeline          │
│  - Section C         │  - Quick actions     │
└──────────────────────┴──────────────────────┘
```
- Main: `flex: 2`, Sidebar: `flex: 1`, max sidebar width 360px
- ทุก section ใน main มี heading (font-size 20px, font-weight 600) + border-bottom

### Form page (`/claims/new`, `/claims/:id/edit`)
```
┌─────────────────────────────────────────────┐
│  Page title                                  │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────┐               │
│  │  Form (max-width: 720px)  │               │
│  │  centered                 │               │
│  └───────────────────────────┘               │
│                         [Cancel] [Submit →]  │
└─────────────────────────────────────────────┘
```
- Single column, max-width 720px, margin: 0 auto
- Action buttons: float right, Submit = primary, Cancel = tertiary
- Form group spacing: 24px ระหว่าง field groups

### Dashboard page (`/dashboard`)
```
┌─────────────────────────────────────────────┐
│  Header (full width)                         │
├──────────────────────────────┬──────────────┤
│  Main content                │  Right panel │
│  - Action cards row          │  - Stats     │
│  - Task list widget          │  - Quick     │
│  - Recently created widget   │    links     │
└──────────────────────────────┴──────────────┘
```
- Main: flex-1, Right panel: 328px fixed
- ไม่มี left sidebar

---

## Spacing Scale (ใช้ตาม rhythm นี้เท่านั้น)

| ชื่อ | ค่า | ใช้เมื่อ |
|------|-----|---------|
| xs | 4px | gap ระหว่าง icon กับ label |
| sm | 8px | gap ระหว่าง badge/chip |
| md | 16px | padding ใน card, gap ระหว่าง fields |
| lg | 24px | gap ระหว่าง sections |
| xl | 32px | page padding, margin ระหว่าง widget |
| 2xl | 48px | section breaks ใหญ่ |

ห้ามใช้เลขแปลก เช่น 13px, 22px, 37px

---

## Status Color Convention

ใช้สีนี้เท่านั้น — ห้ามประดิษฐ์สีใหม่

| Status | Background | Text | ใช้กับ |
|--------|-----------|------|--------|
| Open | `#dce9f8` | `#006192` | claim/task เปิดอยู่ |
| In Progress | `#fdf3d6` | `#7a5200` | กำลังดำเนินการ |
| Completed | `#d4edda` | `#155724` | เสร็จแล้ว |
| Closed | `#e8e8e8` | `#767676` | ปิดแล้ว |
| Pending | `#fdf3d6` | `#7a5200` | รอดำเนินการ |
| Rejected / Error | `#f8d7da` | `#721c24` | ปฏิเสธ / error เท่านั้น |

---

## ห้าม

- **ห้ามใช้สีแดง** นอกจาก Rejected / Error / validation fail
- **ห้ามใส่ icon ตกแต่ง** — icon ทุกตัวต้องสื่อ action หรือ status จริง ไม่ใช่แค่สวย
- **ห้ามใช้ shadow หนัก** — NDBX เน้น flat, ถ้าจำเป็นใช้ `box-shadow: 0 1px 3px rgba(0,0,0,0.08)` เท่านั้น
- **ห้าม animation** นอกจาก state transition (loading spinner, success flash)
- **ห้าม empty state ว่างเปล่า** — ถ้าไม่มีข้อมูลต้องมี illustration หรือ helper text + action button
- **ห้ามปุ่มเกิน 3 ปุ่ม** ใน action group เดียว ถ้าเกินให้ใช้ dropdown/context menu

---

## เมื่อไม่แน่ใจ

1. ดู component ใกล้เคียงใน project เป็น pattern หลัก (`sections.html` / `dashboard.html`)
2. ดู ng-aquila storybook concept: component API อยู่ใน `node_modules/@allianz/ng-aquila/`
3. ถามผู้ใช้พร้อม mockup text หรือ ASCII layout ก่อน implement จริง — ห้ามคิดเอง
