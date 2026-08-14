## Context

Widget "แพลตฟอร์ม" ใน `ContentDashboardPage.tsx` ปัจจุบัน:

```tsx
{Object.entries(platformCounts)
  .sort(([, a], [, b]) => b - a)
  .map(([platform, count]) => {
    const info = PLATFORM_MAP[platform];
    return (
      <div key={platform} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {info ? (
            <Badge variant="outline" className={info.color}>{info.label}</Badge>
          ) : (
            <span className="text-sm">{platform}</span>
          )}
        </div>
        <span className="text-sm font-medium">{count}</span>
      </div>
    );
  })}
```

`platformCounts` มาจาก `content_items` (`item.platform ?? 'unknown'`)

ส่วน "สถานะช่องทาง" (ที่ปรับแล้ว) แสดง logo + ชื่อแบบ:
```tsx
<span className="w-8 h-8 rounded-lg" style={{ backgroundColor: pc.bg, color: pc.text }}>
  <PlatformIcon platform={ch.platform} size={18} />
</span>
<span className="truncate">{ch.name}</span>
```

## Goals / Non-Goals

**Goals:**
- แสดง Logo Icon + ชื่อแพลตฟอร์ม ในรูปแบบเดียวกับ "สถานะช่องทาง"
- แสดงชื่อแพลตฟอร์มเพียงครั้งเดียว (ไม่มี Badge ซ้ำ)
- แสดงจำนวนคอนเทนต์ตามข้อมูลจริง
- เรียงตามจำนวนมาก→น้อย และชื่อ A–Z เมื่อเท่ากัน

**Non-Goals:**
- ไม่เปลี่ยนวิธีคำนวณ `platformCounts`
- ไม่แตะ widget อื่น
- ไม่เปลี่ยน API/DB

## Decisions

**1. แสดง logo + ชื่อ (รูปแบบเดียวกับ "สถานะช่องทาง")**
- ใช้ `<PlatformIcon platform={platform} size={18} />` ในกล่อง `w-8 h-8 rounded-lg` ตาม `getPlatformColors(platform)`
- ชื่อแพลตฟอร์ม = `PLATFORM_MAP[platform]?.label ?? platform`
- เอา Badge ชื่อซ้ำออก

**2. เรียงลำดับ: จำนวนมาก→น้อย, ชื่อ A–Z เมื่อเท่ากัน**
- `sort((a, b) => (b[1] - a[1]) || nameA.localeCompare(nameB))` โดย `name = PLATFORM_MAP[p]?.label ?? p`

## Risks / Trade-offs

- [แพลตฟอร์ม 'unknown' ไม่มี PLATFORM_MAP] → ใช้ `platform` เป็นชื่อ fallback และ `getPlatformColors` คืน default สีเทา

## Migration Plan

- เปลี่ยนเฉพาะ `src/pages/ContentDashboardPage.tsx` (frontend) — ไม่มี DB/API migration
- Rollback: revert เป็น Badge + sort count desc อย่างเดียว
