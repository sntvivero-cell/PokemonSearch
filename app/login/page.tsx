'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/app/lib/supabaseClient';

type AuthMode = 'login' | 'signup';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmailNotice, setConfirmEmailNotice] = useState(false);
  const [existingAccountNotice, setExistingAccountNotice] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConfirmEmailNotice(false);
    setExistingAccountNotice(false);

    if (mode === 'login') {
      setIsSubmitting(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setIsSubmitting(false);
        return;
      }
      router.push('/');
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Elegí un nombre de usuario.');
      return;
    }
    if (trimmedUsername.length < USERNAME_MIN_LENGTH || trimmedUsername.length > USERNAME_MAX_LENGTH) {
      setError(`El nombre de usuario debe tener entre ${USERNAME_MIN_LENGTH} y ${USERNAME_MAX_LENGTH} caracteres.`);
      return;
    }
    if (/\s/.test(trimmedUsername)) {
      setError('El nombre de usuario no puede tener espacios.');
      return;
    }

    setIsSubmitting(true);

    // Chequeo previo contra profiles (SELECT es público) para dar un mensaje claro
    // antes de intentar crear la cuenta. profiles.username tiene una unique
    // constraint, así que si dos personas pasan este chequeo a la vez y chocan
    // igual, el catch de abajo (mensaje genérico "Database error saving new user"
    // que Supabase devuelve cuando el trigger handle_new_user falla) es el respaldo.
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', trimmedUsername)
      .maybeSingle();

    if (existingProfile) {
      setError('Ese nombre de usuario ya está en uso.');
      setIsSubmitting(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: trimmedUsername } },
    });
    if (signUpError) {
      if (/database error/i.test(signUpError.message)) {
        setError('Ese nombre de usuario ya está en uso.');
      } else {
        setError(signUpError.message);
      }
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);

    // Con "Confirm email" activado, si el email ya tiene una cuenta Supabase no
    // devuelve un error (filtrarlo sería un problema de seguridad): responde con un
    // "usuario" que tiene identities: [] en vez de la identity nueva. Es la única
    // forma de detectar este caso desde el cliente.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setExistingAccountNotice(true);
      return;
    }

    // Si el proyecto tiene "Confirm email" activado, signUp crea el usuario pero no
    // devuelve una sesión activa hasta que confirme el correo. En ese caso no hay
    // sesión todavía, así que no redirigimos: avisamos que revise su email.
    if (!data.session) {
      setConfirmEmailNotice(true);
      return;
    }

    router.push('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0F14] px-4 text-[#F4F6F8]">
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
              <Sparkles className="h-5 w-5 text-[#2E9BF5]" />
            </div>
            <h1 className="mt-3 text-base font-extrabold tracking-tight">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h1>
            <p className="mt-1 text-xs text-[#5C6773]">
              {mode === 'login'
                ? 'Entrá para publicar y gestionar tus trades'
                : 'Registrate para empezar a intercambiar'}
            </p>
          </div>

          <div className="mb-5 inline-flex w-full rounded-full border border-[#232D38] bg-[#0B0F14] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setConfirmEmailNotice(false);
                setExistingAccountNotice(false);
              }}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                mode === 'login' ? 'bg-[#2E9BF5] text-white' : 'text-[#8792A0] hover:text-[#F4F6F8]'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setConfirmEmailNotice(false);
                setExistingAccountNotice(false);
              }}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                mode === 'signup' ? 'bg-[#2E9BF5] text-white' : 'text-[#8792A0] hover:text-[#F4F6F8]'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#8792A0]">Nombre de usuario</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={USERNAME_MIN_LENGTH}
                  maxLength={USERNAME_MAX_LENGTH}
                  placeholder="ej. AshKetchum10"
                  className="w-full rounded-lg border border-[#232D38] bg-[#0B0F14] px-3 py-2 text-sm
                             text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition
                             focus:border-[#2E9BF5]"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#8792A0]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="entrenador@ejemplo.com"
                className="w-full rounded-lg border border-[#232D38] bg-[#0B0F14] px-3 py-2 text-sm
                           text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition
                           focus:border-[#2E9BF5]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#8792A0]">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#232D38] bg-[#0B0F14] px-3 py-2 text-sm
                           text-[#F4F6F8] placeholder:text-[#5C6773] outline-none transition
                           focus:border-[#2E9BF5]"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-2.5 text-xs font-semibold text-[#FF3D3D]">
                {error}
              </p>
            )}

            {confirmEmailNotice && (
              <p className="rounded-xl border border-[#2E9BF5]/40 bg-[#2E9BF5]/10 px-3 py-2.5 text-xs font-semibold text-[#2E9BF5]">
                Cuenta creada. Revisá tu email para confirmarla antes de iniciar sesión.
              </p>
            )}

            {existingAccountNotice && (
              <p className="rounded-xl border border-[#FF3D3D]/40 bg-[#FF3D3D]/10 px-3 py-2.5 text-xs font-semibold text-[#FF3D3D]">
                Ya existe una cuenta con ese email.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setExistingAccountNotice(false);
                    setError(null);
                  }}
                  className="underline underline-offset-2 hover:text-white"
                >
                  ¿Querés iniciar sesión?
                </button>
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-full bg-[#2E9BF5] px-5 py-2.5 text-xs font-semibold text-white
                         transition hover:bg-[#2589db] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Procesando…'
                : mode === 'login'
                  ? 'Iniciar sesión'
                  : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
