import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderKanban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setIsSignUp(true);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, displayName, companyName || displayName);
        toast({ title: 'สมัครสมาชิกสำเร็จ', description: 'ยินดีต้อนรับ! ทดลองใช้ฟรี 30 วัน' });
      } else {
        await signIn(email, password);
      }
      navigate('/');
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary">
              <FolderKanban className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold font-heading">Flowstack</h1>
          </div>
          <p className="text-muted-foreground">
            {isSignUp ? 'สร้างบัญชีใหม่ ทดลองใช้ฟรี 30 วัน' : 'เข้าสู่ระบบเพื่อจัดการโครงการ'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-xl border p-6 space-y-4">
          {isSignUp && (
            <>
              <div>
                <Label htmlFor="companyName">ชื่อบริษัท / ทีม</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="เช่น บริษัท ABC จำกัด"
                  required
                />
              </div>
              <div>
                <Label htmlFor="displayName">ชื่อผู้ใช้</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                  required
                />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="email">อีเมล</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'กำลังดำเนินการ...' : isSignUp ? 'เริ่มทดลองใช้ฟรี' : 'เข้าสู่ระบบ'}
          </Button>
          {isSignUp && (
            <p className="text-center text-xs text-muted-foreground">
              ทดลองใช้ฟรี 30 วัน ไม่ต้องใช้บัตรเครดิต
            </p>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'มีบัญชีแล้ว?' : 'ยังไม่มีบัญชี?'}{' '}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-accent hover:underline font-medium"
            >
              {isSignUp ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Auth;
