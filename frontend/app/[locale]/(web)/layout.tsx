type WebLayoutProps = {
  children: React.ReactNode
}

/**
 * Route-group container for user-facing web routes.
 * Pages can be progressively moved under `(web)` without URL changes.
 */
export default function WebLayout({ children }: WebLayoutProps) {
  return children
}

