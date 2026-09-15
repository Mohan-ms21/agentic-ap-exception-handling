import { StepNav } from "./step-nav";

export default function WalkthroughLayout({
  children,
}: LayoutProps<"/walkthrough">) {
  return (
    <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 content-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <StepNav />
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
