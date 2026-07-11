import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/stores/session';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { hasNativeBridge } from '@/lib/bridge/client';

export function Login() {
  const nav = useNavigate();
  const { login, loading, error } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email.trim(), password);
      nav('/today', { replace: true });
    } catch {
      /* error shown from store */
    }
  }

  return (
    <div className="flex min-h-screen-safe flex-col bg-ink text-paper">
      <div className="flex flex-1 flex-col justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-card bg-yellow shadow-oil">
              <span className="wordmark text-3xl text-ink">O</span>
            </div>
            <h1 className="wordmark text-3xl text-paper">Organikaly</h1>
            <p className="mt-1 text-sm text-paper/70">Field Sales</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-card bg-paper p-5 text-ink shadow-lg">
              <Input
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="mt-4">
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="mt-3 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="gold"
                size="lg"
                block
                loading={loading}
                className="mt-5"
              >
                Sign in
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-paper/60">
            {hasNativeBridge() ? 'Native device features enabled' : 'Browser mode'}
          </p>
        </div>
      </div>
    </div>
  );
}
