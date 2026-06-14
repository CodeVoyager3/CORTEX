import { Brain, GitBranch, Globe, Link2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function FooterSection() {
  const socialLinks = [
    {
      icon: <GitBranch className="h-4 w-4" />,
      href: "https://github.com",
      label: "GitHub",
    },
    {
      icon: <Globe className="h-4 w-4" />,
      href: "https://twitter.com",
      label: "Twitter / X",
    },
    {
      icon: <Link2 className="h-4 w-4" />,
      href: "https://linkedin.com",
      label: "LinkedIn",
    },
  ];

  const linkGroups = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Stats", href: "#stats" },
        { label: "FAQ", href: "#faq" },
        { label: "Dashboard", href: "/dashboard" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "#" },
        { label: "API Reference", href: "#" },
        { label: "Changelog", href: "#" },
        { label: "Status", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
      ],
    },
  ];

  const legalLinks = [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ];

  return (
    <footer className="bg-background w-full border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6 pt-10 pb-6 md:px-12">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Brain className="h-6 w-6 text-purple-500" />
            </div>
            <span className="text-foreground text-lg font-bold tracking-tight">
              CORTEX
            </span>
          </div>

          <div className="flex items-center gap-5">
            <span className="text-primary hidden text-sm sm:inline">
              Engineering Intelligence Hub
            </span>
            <div className="flex items-center gap-2">
              {socialLinks.map((link, index) => (
                <Button
                  key={index}
                  size="icon"
                  variant="outline"
                  asChild
                  className="text-foreground bg-muted hover:text-foreground h-9 w-9 shadow-[0_0_0_0.5px_rgba(0,0,0,0.03),0_2px_4px_0_rgba(0,0,0,0.05),inset_0_2px_0_0px_rgba(255,255,255,0.5)] transition-colors outline-none dark:shadow-[0_0_0_0.5px_rgba(0,0,0,0.03),0_2px_4px_0_rgba(0,0,0,0.05),inset_0_2px_0_0px_rgba(255,255,255,0.1)]"
                >
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                  >
                    {link.icon}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <Separator className="opacity-50" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Contact CTA */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <h3 className="text-foreground text-sm font-semibold">
              Get in touch
            </h3>

            <a
              href="mailto:hello@cortex.ai"
              className="group bg-muted hover:bg-muted/80 flex items-start gap-4 rounded-2xl border p-5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.03),0_2px_4px_0_rgba(0,0,0,0.05),inset_0_2px_0_0px_rgba(255,255,255,0.5)] transition-colors dark:shadow-[0_0_0_0.5px_rgba(0,0,0,0.03),0_2px_4px_0_rgba(0,0,0,0.05),inset_0_2px_0_0px_rgba(255,255,255,0.1)]"
            >
              <div className="bg-primary border-primary text-primary-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_0_0.5px_rgba(0,0,0,0.03),0_2px_4px_0_rgba(0,0,0,0.05),inset_0_2px_0_0px_rgba(255,255,255,0.5)]">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-foreground group-hover:text-primary text-sm font-medium transition-colors">
                  hello@cortex.ai
                </span>
                <span className="text-muted-foreground text-xs leading-relaxed">
                  Reach out for enterprise plans, partnerships, or just to say hello. We respond within 24 hours.
                </span>
              </div>
            </a>
          </div>

          {/* Link Groups */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-12">
              {linkGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="flex flex-col gap-4">
                  <h4 className="text-foreground text-sm font-semibold">
                    {group.title}
                  </h4>
                  <ul className="flex flex-col gap-3">
                    {group.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <a
                          href={link.href}
                          className="text-muted-foreground hover:text-primary text-sm transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Brand Watermark + Legal */}
      <div className="relative mx-auto flex max-w-7xl items-center justify-center px-6 md:px-12">
        <div className="relative overflow-hidden w-full">
          <div className="flex items-end justify-center gap-4 pt-4 pb-0 tracking-widest md:gap-6">
            <div className="text-muted shrink-0">
              <div className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 lg:h-40 lg:w-40 [&>svg]:h-full [&>svg]:w-full">
                <Brain className="h-full w-full" />
              </div>
            </div>
            <span className="text-muted text-7xl leading-none font-bold select-none sm:text-8xl md:text-9xl lg:text-[11rem] xl:text-[14rem]">
              CORTEX
            </span>
          </div>

          <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t to-transparent" />
        </div>

        <div className="absolute bottom-0 flex w-full translate-y-5 flex-col items-center justify-between gap-1 px-12 sm:translate-y-0 sm:flex-row">
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} CORTEX — Engineering Intelligence Hub. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            {legalLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
