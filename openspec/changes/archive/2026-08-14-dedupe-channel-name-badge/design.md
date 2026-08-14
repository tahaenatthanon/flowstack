## Context

Widget "สถานะช่องทาง" ใน `ContentDashboardPage.tsx` ปัจจุบัน:

```tsx
{channels.map(ch => {
  const platform = PLATFORM_MAP[ch.platform];
  const status = channelStatus.find(s => s.id === ch.id);
  const connected = status?.ok === true;
  return (
    <div key={ch.id} className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm truncate">{ch.name}</span>
        {platform ? (
          <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
        ) : null}
      </div>
      <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-600' : 'text-red-600'}`}>
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        {connected ? 'เชื่อมต่อแล้ว' : 'ไม่เชื่อมต่อ'}
      </span>
    </div>
  );
})}
```

`ch.name` และ `platform.label` มักเป็นชื่อเดียวกัน (เช่น channel ชื่อ "WordPress" → badge "WordPress") → ซ้ำซ้อน

## Goals / Non-Goals

**Goals:**
- แสดงชื่อช่องทางเพียงครั้งเดียวในแต่ละรายการ
- เอา Badge แพลตฟอร์มซ้ำออก
- เพิ่ม Logo Icon ของแต่ละช่องทางด้านหน้าชื่อ

**Non-Goals:**
- ไม่แตะสถานะ (จุดสี + ข้อความ) หรือ hook `useChannelConnectionStatus`
- ไม่เปลี่ยน `ch.name`
- ไม่แตะ widget อื่น

## Decisions

**1. ลบ Badge แพลตฟอร์มซ้ำออกจากแถว channel**
- ลบ `{platform ? <Badge variant="outline" className={platform.color}>{platform.label}</Badge> : null}` ออกจากแถว channel
- คงเฉพาะ `ch.name` + สถานะ (จุดสี + ข้อความ)
- `PLATFORM_MAP` import ยังใช้ในส่วนอื่นของหน้า (เช่น ตาราง top content) — ไม่ต้องลบ import

**2. เพิ่ม Logo Icon ด้านหน้าชื่อช่องทาง**
- ใช้ `<PlatformIcon platform={ch.platform} size={18} />` (component ที่มีอยู่แล้ว) ภายในกล่องสี `getPlatformColors(ch.platform)` (`bg`/`text`)
- วางกล่อง logo (`w-8 h-8 rounded-lg`) ไว้ด้านหน้าชื่อ channel ในแถวเดียวกัน

## Risks / Trade-offs

- [ชื่อช่องทางบางรายการอาจไม่สื่อแพลตฟอร์มชัด] → ชื่อ channel มักถูกตั้งให้บ่งบอกแพลตฟอร์มอยู่แล้ว (เช่น "Facebook", "Line OA"); ยอมรับตาม requirement

## Migration Plan

- เปลี่ยนเฉพาะ `src/pages/ContentDashboardPage.tsx` (frontend) — ไม่มี DB/API migration
- Rollback: เพิ่ม Badge แพลตฟอร์มกลับ
