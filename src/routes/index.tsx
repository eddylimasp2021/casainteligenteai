import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Casa Inteligente" },
      { name: "description", content: "Casa Inteligente — plataforma de casa inteligente." },
      { property: "og:title", content: "Casa Inteligente" },
      { property: "og:description", content: "Casa Inteligente — plataforma de casa inteligente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <h1 className="text-center text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
        CASA INTELIGENTE
      </h1>
    </main>
  );
}
