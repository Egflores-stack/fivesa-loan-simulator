import { Calculator, Phone, Mail } from "lucide-react";

const Header = () => {
  const contactEmail = (import.meta.env.VITE_CONTACT_EMAIL || "").trim();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-md">
            <Calculator className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">CREDIA</h1>
            <p className="text-xs text-muted-foreground">Préstamos Personales</p>
          </div>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          <a
            href="tel:+525555555555"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <Phone className="h-4 w-4" />
            <span>(55) 5555-5555</span>
          </a>
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}`}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <Mail className="h-4 w-4" />
              <span>{contactEmail}</span>
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default Header;
