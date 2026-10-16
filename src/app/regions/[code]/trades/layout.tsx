import { Providers } from "./providers";

export default function TradesLayout({
  children,
}: LayoutProps<"/regions/[code]/trades">) {
  return <Providers>{children}</Providers>;
}
