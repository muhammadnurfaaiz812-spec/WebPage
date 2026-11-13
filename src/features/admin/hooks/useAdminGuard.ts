"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { checkIsAdmin } from "@/features/admin/services/adminService";

export type AdminState = "checking" | "anon" | "forbidden" | "admin";

/**
 * Status sesi untuk tampilan: checking, anon (belum masuk), forbidden
 * (masuk tapi bukan admin), atau admin. Ini hanya pagar UI. Keamanan
 * sebenarnya ada di policy RLS database, bukan di sini.
 */
export function useAdminGuard() {
  const [state, setState] = useState<AdminState>("checking");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function evaluate(session: Session | null) {
      if (!session) {
        if (active) {
          setEmail(null);
          setState("anon");
        }
        return;
      }
      const admin = await checkIsAdmin();
      if (active) {
        setEmail(session.user.email ?? null);
        setState(admin ? "admin" : "forbidden");
      }
    }

    supabase.auth.getSession().then(({ data }) => evaluate(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Jangan memanggil Supabase langsung di dalam callback ini
        // (bisa deadlock). Tunda satu tick.
        setTimeout(() => void evaluate(session), 0);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { state, email };
}
