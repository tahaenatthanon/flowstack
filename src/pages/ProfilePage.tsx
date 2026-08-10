import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageShell from '@/components/PageShell';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Camera, Save, KeyRound, User, Shield, AtSign, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export default function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const kpiYear = new Date().getFullYear();
  const { data: kpiData } = useQuery({
    queryKey: ['impactos-dev', kpiYear, user?.id],
    queryFn: () => apiFetch(`/impactos.php?view=dev&year=${kpiYear}&user_id=${user?.id}`),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [position, setPosition] = useState(user?.position ?? '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState({
    email_enabled: 0,
    line_enabled: 0,
    telegram_enabled: 0,
    briefing_time: '08:00',
    line_user_id: '',
    telegram_chat_id: '',
    notify_tasks_due:          1,
    notify_tasks_overdue:      1,
    notify_calendar:           1,
    notify_tomorrow:           1,
    notify_assigned:           1,
    notify_sla:                1,
    notify_task_activity:      0,
    task_activity_via_line:    1,
    task_activity_via_telegram:1,
    task_activity_via_email:   0,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // Load notification settings on mount
  useEffect(() => {
    apiFetch('/profile.php?action=notification_settings')
      .then((res: any) => {
        if (res && res.briefing_time !== undefined) {
          setNotifSettings({
            email_enabled:        res.notify_email     ?? res.email_enabled    ?? 0,
            line_enabled:         res.notify_line      ?? res.line_enabled     ?? 0,
            telegram_enabled:     res.notify_telegram  ?? res.telegram_enabled ?? 0,
            briefing_time:        (res.briefing_time ?? '08:00:00').substring(0, 5),
            line_user_id:         res.line_user_id      ?? '',
            telegram_chat_id:     res.telegram_chat_id  ?? '',
            notify_tasks_due:          res.notify_tasks_due          ?? 1,
            notify_tasks_overdue:      res.notify_tasks_overdue      ?? 1,
            notify_calendar:           res.notify_calendar           ?? 1,
            notify_tomorrow:           res.notify_tomorrow           ?? 1,
            notify_assigned:           res.notify_assigned           ?? 1,
            notify_sla:                res.notify_sla                ?? 1,
            notify_task_activity:      res.notify_task_activity      ?? 0,
            task_activity_via_line:    res.task_activity_via_line    ?? 1,
            task_activity_via_telegram:res.task_activity_via_telegram?? 1,
            task_activity_via_email:   res.task_activity_via_email   ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
      toast({ title: 'อัปโหลดรูปโปรไฟล์สำเร็จ' });
    } catch (err: any) {
      toast({ title: 'อัปโหลดล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast({ title: 'กรุณากรอกชื่อแสดงผล', variant: 'destructive' });
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim(), position: position.trim() });
      toast({ title: 'บันทึกข้อมูลสำเร็จ' });
    } catch (err: any) {
      toast({ title: 'บันทึกล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'รหัสผ่านใหม่ไม่ตรงกัน', variant: 'destructive' });
      return;
    }
    setPasswordSaving(true);
    try {
      await apiFetch('/profile.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'change_password', current_password: currentPassword, new_password: newPassword }),
      });
      toast({ title: 'เปลี่ยนรหัสผ่านสำเร็จ' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: 'เปลี่ยนรหัสผ่านล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNotifSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSaving(true);
    try {
      await apiFetch('/profile.php', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'notification_settings',
          ...notifSettings,
          briefing_time: notifSettings.briefing_time + ':00',
        }),
      });
      toast({ title: 'บันทึกการตั้งค่าการแจ้งเตือนสำเร็จ' });
    } catch (err: any) {
      toast({ title: 'บันทึกล้มเหลว', description: err.message, variant: 'destructive' });
    } finally {
      setNotifSaving(false);
    }
  };

  const initials = user?.display_name?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <PageShell
      breadcrumbs={[{ label: 'โปรไฟล์ของฉัน', isCurrent: true }]}
      title="โปรไฟล์ของฉัน"
      description="จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี"
    >

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            รูปโปรไฟล์
          </CardTitle>
          <CardDescription>คลิกที่รูปเพื่อเปลี่ยนรูปโปรไฟล์ (JPEG, PNG, GIF, WebP ขนาดสูงสุด 2MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 cursor-pointer" onClick={handleAvatarClick}>
                <AvatarImage src={user?.avatar_url} alt={user?.display_name} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {/* Medal/Coin overlay */}
              <button
                type="button"
                onClick={() => navigate('/impactos?tab=dev')}
                title="ดูรายงาน KPI ของคุณ"
                className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-yellow-400 border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all z-20"
                style={{ boxShadow: '0 2px 8px 0 rgba(0,0,0,0.10)' }}
              >
                <span className="text-2xl">🏅</span>
              </button>
              {/* Camera button */}
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={avatarUploading}
                className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors z-10"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{user?.display_name}</p>
              <p className="text-sm text-muted-foreground">{user?.role_label || user?.position || 'พนักงาน'}</p>
              {avatarUploading && (
                <p className="text-sm text-primary mt-1 animate-pulse">กำลังอัปโหลด...</p>
              )}
            </div>

            {/* KPI Medal */}
            {kpiData && (
              <button
                type="button"
                onClick={() => navigate('/impactos?tab=dev')}
                className="shrink-0 flex flex-col items-center gap-1 group"
                title={`KPI ${kpiData.grade} — คะแนน ${kpiData.total_score} คลิกดูรายละเอียด`}
              >
                <div className={cn(
                  'h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-transform group-hover:scale-110',
                  kpiData.grade === 'A+' ? 'bg-violet-100 text-violet-700 border-violet-300' :
                  kpiData.grade === 'A'  ? 'bg-green-100 text-green-700 border-green-300' :
                  kpiData.grade === 'B+' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                  kpiData.grade === 'B'  ? 'bg-sky-100 text-sky-700 border-sky-300' :
                  kpiData.grade === 'C'  ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                  'bg-red-100 text-red-700 border-red-300'
                )}>
                  {kpiData.grade || '—'}
                </div>
                <span className="text-[10px] text-muted-foreground group-hover:text-foreground font-medium">
                  {kpiData.total_score ?? '—'} คะแนน
                </span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            ข้อมูลส่วนตัว
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">ชื่อแสดงผล</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ชื่อแสดงผล"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">ตำแหน่ง</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="เช่น Developer, Manager"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={profileSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {profileSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            เปลี่ยนรหัสผ่าน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">รหัสผ่านปัจจุบัน</Label>
              <Input
                id="current_password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="รหัสผ่านปัจจุบัน"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">รหัสผ่านใหม่</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">ยืนยันรหัสผ่านใหม่</Label>
              <Input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="ยืนยันรหัสผ่านใหม่"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={passwordSaving} className="gap-2">
                <KeyRound className="h-4 w-4" />
                {passwordSaving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Info (readonly) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            ข้อมูลบัญชี
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">อีเมล</p>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">บทบาท</p>
              <p className="font-medium">{user?.role_label || (Number(user?.is_admin) === 1 ? 'ผู้ดูแลระบบ' : 'สมาชิก')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">สถานะ</p>
              <p className="font-medium">{Number(user?.is_admin) === 1 ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งานทั่วไป'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Aliases (readonly – managed by admin) */}
      {(user?.aliases?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AtSign className="h-4 w-4" />
              Email Alias ที่ใช้ Login ได้
            </CardTitle>
            <CardDescription>อีเมล alias เหล่านี้สามารถใช้เข้าสู่ระบบแทนอีเมลหลักได้ (จัดการโดยผู้ดูแลระบบ)</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {user?.aliases?.map((alias) => (
                <li key={alias.id} className="flex items-center gap-3 text-sm">
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{alias.alias_email}</span>
                  {alias.label && (
                    <span className="text-muted-foreground">— {alias.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            การแจ้งเตือน (AI Secretary Briefing)
          </CardTitle>
          <CardDescription>ตั้งค่าการรับสรุปประจำวันผ่านช่องทางต่างๆ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleNotifSave} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="briefing_time">เวลาส่งสรุปประจำวัน</Label>
              <Input
                id="briefing_time"
                type="time"
                value={notifSettings.briefing_time}
                onChange={e => setNotifSettings(s => ({ ...s, briefing_time: e.target.value }))}
                className="w-36"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">อีเมล</p>
                  <p className="text-xs text-muted-foreground">ส่งสรุปผ่านอีเมลที่ลงทะเบียนไว้</p>
                </div>
                <Switch
                  checked={notifSettings.email_enabled === 1}
                  onCheckedChange={v => setNotifSettings(s => ({ ...s, email_enabled: v ? 1 : 0 }))}
                />
              </div>

              {/* Line */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Line OA</p>
                    <p className="text-xs text-muted-foreground">ส่งสรุปผ่าน Line Official Account</p>
                  </div>
                  <Switch
                    checked={notifSettings.line_enabled === 1}
                    onCheckedChange={v => setNotifSettings(s => ({ ...s, line_enabled: v ? 1 : 0 }))}
                  />
                </div>
                {notifSettings.line_enabled === 1 && (
                  <div className="space-y-1.5 pl-4 border-l-2 border-muted">
                    <Label className="text-xs">Line User ID</Label>
                    <Input
                      placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={notifSettings.line_user_id}
                      onChange={e => setNotifSettings(s => ({ ...s, line_user_id: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <p className="text-xs text-muted-foreground">หา User ID ได้ที่ Line OA Manager หรือ webhook</p>
                  </div>
                )}
              </div>

              {/* Telegram */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Telegram</p>
                    <p className="text-xs text-muted-foreground">ส่งสรุปผ่าน Telegram Bot</p>
                  </div>
                  <Switch
                    checked={notifSettings.telegram_enabled === 1}
                    onCheckedChange={v => setNotifSettings(s => ({ ...s, telegram_enabled: v ? 1 : 0 }))}
                  />
                </div>
                {notifSettings.telegram_enabled === 1 && (
                  <div className="space-y-1.5 pl-4 border-l-2 border-muted">
                    <Label className="text-xs">Telegram Chat ID</Label>
                    <Input
                      placeholder="เช่น 123456789 หรือ -1001234567890"
                      value={notifSettings.telegram_chat_id}
                      onChange={e => setNotifSettings(s => ({ ...s, telegram_chat_id: e.target.value }))}
                      className="h-8 text-xs"
                    />
                    <p className="text-xs text-muted-foreground">ใช้ @userinfobot บน Telegram เพื่อหา Chat ID</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* ประเภทการแจ้งเตือน */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">ประเภทการแจ้งเตือนที่รับ</p>
                <p className="text-xs text-muted-foreground">เลือกหัวข้อที่ต้องการรับในสรุปประจำวัน</p>
              </div>
              {([
                { key: 'notify_tasks_due',     label: 'Task ครบกำหนดวันนี้',   desc: 'งานที่ถึงกำหนดส่งวันนี้' },
                { key: 'notify_tasks_overdue', label: 'Task เกินกำหนด',        desc: 'งานที่เลยกำหนดส่งไปแล้ว' },
                { key: 'notify_calendar',      label: 'กิจกรรม/ประชุมวันนี้',  desc: 'นัดหมายและกิจกรรมในปฏิทิน' },
                { key: 'notify_tomorrow',      label: 'ตารางพรุ่งนี้',          desc: 'แจ้งล่วงหน้ากิจกรรมวันถัดไป' },
                { key: 'notify_assigned',      label: 'ได้รับ Task ใหม่',       desc: 'เมื่อมีงานถูก assign ให้ตัวเอง' },
                { key: 'notify_sla',           label: 'Ticket เกิน SLA',        desc: 'Support ticket ที่เกินเวลา SLA' },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={notifSettings[key] === 1}
                    onCheckedChange={v => setNotifSettings(s => ({ ...s, [key]: v ? 1 : 0 }))}
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* แจ้งเตือนกิจกรรม Task ทีม (Admin / Manager) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">แจ้งเตือนการบันทึก Task ของทีม</p>
                  <p className="text-xs text-muted-foreground">รับแจ้งเตือนทันทีเมื่อสมาชิกทีมสร้างหรืออัปเดตงาน (สำหรับ Admin / Manager)</p>
                </div>
                <Switch
                  checked={notifSettings.notify_task_activity === 1}
                  onCheckedChange={v => setNotifSettings(s => ({ ...s, notify_task_activity: v ? 1 : 0 }))}
                />
              </div>
              {notifSettings.notify_task_activity === 1 && (
                <div className="pl-4 border-l-2 border-muted space-y-3">
                  <p className="text-xs text-muted-foreground">รับผ่านช่องทาง:</p>
                  {([
                    { key: 'task_activity_via_line',     label: 'LINE',     desc: 'ส่งไปยัง LINE User ID ที่ตั้งค่าไว้' },
                    { key: 'task_activity_via_telegram', label: 'Telegram', desc: 'ส่งไปยัง Telegram Chat ID ที่ตั้งค่าไว้' },
                    { key: 'task_activity_via_email',    label: 'อีเมล',    desc: 'ส่งอีเมลแจ้งเตือนพร้อมลิงค์เปิดงาน' },
                  ] as const).map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch
                        checked={notifSettings[key] === 1}
                        onCheckedChange={v => setNotifSettings(s => ({ ...s, [key]: v ? 1 : 0 }))}
                      />
                    </div>
                  ))}
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    ข้อความแจ้งเตือนจะมี: ชื่องาน · ผู้บันทึก · สถานะ · 🔗 ลิงค์เปิดงาน<br />
                    <span className="text-amber-600">ต้องตั้งค่า Public URL ในหน้า Admin → ตั้งค่าการแจ้งเตือน ก่อน</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={notifSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {notifSaving ? 'กำลังบันทึก...' : 'บันทึกการแจ้งเตือน'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
