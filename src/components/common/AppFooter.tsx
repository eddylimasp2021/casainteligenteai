export function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-border/40 bg-background/60 py-4 px-4 text-center backdrop-blur-sm ${className}`}
    >
      <p className="text-xs text-muted-foreground leading-relaxed">
        &copy; 2026 - Eddylima Informática Brasil{" "}
        <a
          href="mailto:eddylimainformatica@gmail.com"
          className="text-primary/90 hover:underline hover:text-primary transition-colors"
        >
          eddylimainformatica@gmail.com
        </a>{" "}
        - Todos os direitos reservados Eddylima Informática Soluções em T.I.
      </p>
    </footer>
  );
}
