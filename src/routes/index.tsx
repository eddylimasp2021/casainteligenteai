import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/home/ui-states";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Casa Inteligente AI — HomePulse" },
      { name: "description", content: "Plataforma de casa inteligente: controle cômodos, dispositivos e segurança em tempo real." },
      { property: "og:title", content: "Casa Inteligente AI — HomePulse" },
      { property: "og:description", content: "Controle sua casa inteligente em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading) navigate({ to: session ? "/dashboard" : "/login", replace: true });
  }, [loading, session, navigate]);
  return <LoadingState />;
}
