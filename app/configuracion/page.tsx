'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';
import { useUser } from '@/app/hooks/useUser';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

// Acepta el código con o sin espacios (ej. "1234 5678 9012" o "123456789012") — se
// valida ignorando espacios, pero se guarda tal cual lo escribió el usuario.
function isValidFriendCode(raw: string): boolean {
  return /^\d{12}$/.test(raw.replace(/\s/g, ''));
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [friendCode, setFriendCode] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('username, friend_code')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        console.error('Error fetching profile:', profileError.message);
      }
      setUsername(data?.username ?? '');
      setFriendCode(data?.friend_code ?? '');
      setIsLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setSaved(false);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < USERNAME_MIN_LENGTH || trimmedUsername.length > USERNAME_MAX_LENGTH) {
      setError(`El nombre de usuario debe tener entre ${USERNAME_MIN_LENGTH} y ${USERNAME_MAX_LENGTH} caracteres.`);
      return;
    }
    if (/\s/.test(trimmedUsername)) {
      setError('El nombre de usuario no puede tener espacios.');
      return;
    }

    const trimmedFriendCode = friendCode.trim();
    if (trimmedFriendCode && !isValidFriendCode(trimmedFriendCode)) {
      setError('El código de amigo debe tener 12 dígitos (podés separarlos con espacios).');
      return;
    }

    setIsSaving(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: trimmedUsername, friend_code: trimmedFriendCode || null })
      .eq('user_id', user.id);
    setIsSaving(false);

    if (updateError) {
      // profiles.username tiene una unique constraint.
      if (updateError.code === '23505') {
        setError('Ese nombre de usuario ya está en uso.');
      } else {
        setError(`No se pudo guardar: ${updateError.message}`);
      }
      return;
    }

    setUsername(trimmedUsername);
    setFriendCode(trimmedFriendCode);
    setSaved(true);
  }

  if (isUserLoading || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] text-[#F4F6F8]">
        <p className="text-xs text-[#5C6773]">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 py-10 text-[#F4F6F8]">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-[#8792A0] transition hover:text-[#F4F6F8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al feed
        </Link>

        <div className="rounded-2xl border border-[#232D38] bg-[#131A22] p-6">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2E9BF5]/10">
              <Settings className="h-5 w-5 text-[#2E9BF5]" />
            </div>
            <h1 className="mt-3 text-base font-extrabold tracking-tight">Configuración</h1>
            <p className="mt-1 text-xs text-[#5C6773]">Editá tu perfil de entrenador</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#8792A0]">Nombre de usuario</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={USERNAME_MIN_LENGTH}
                maxLength={USERNAME_MAX_LENGTH}
                className="w-full rounded-lg border border-[#232D38] bg-[#0B0F14] px-3 py-2 text-sm
                           text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition
                           focus:border-[#2E9BF5]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#8792A0]">Código de amigo</label>
              <input
                type="text"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                placeholder="1234 5678 9012"
                className="w-full rounded-lg border border-[#232D38] bg-[#0B0F14] px-3 py-2 text-sm
                           text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition
                           focus:border-[#2E9BF5]"
              />
              <p className="mt-1.5 text-[10px] text-[#5C6773]">
                Así otros pueden agregarte como amigo en Pokémon GO. Es opcional.
              </p>
            </div>

            {error && (
              <p className="rounded-xl border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-2.5 text-xs font-semibold text-[#FF3D3D]">
                {error}
              </p>
            )}

            {saved && !error && (
              <p className="rounded-xl border border-[#2E9BF5]/40 bg-[#2E9BF5]/10 px-3 py-2.5 text-xs font-semibold text-[#2E9BF5]">
                Cambios guardados.
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="mt-2 rounded-full bg-[#2E9BF5] px-5 py-2.5 text-xs font-semibold text-white
                         transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
