"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

type ChatMarkdownProps = {
  children: string
  className?: string
  /** ฟองผู้ใช้ (พื้นเข้ม) — ปรับสีลิงก์/โค้ดให้อ่านง่าย */
  variant?: "ai" | "user"
}

export function ChatMarkdown({
  children,
  className,
  variant = "ai",
}: ChatMarkdownProps) {
  const isUser = variant === "user"

  return (
    <div
      className={cn(
        "text-sm leading-relaxed break-words",
        "[&_a]:underline [&_a]:underline-offset-2",
        isUser
          ? "[&_a]:text-primary-foreground/90 [&_code]:bg-primary-foreground/15 [&_code]:text-primary-foreground"
          : "[&_a]:text-primary [&_code]:bg-background/80 [&_code]:text-foreground",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: c }) => (
            <h1 className="text-lg font-bold mt-2 first:mt-0 mb-1.5 leading-snug">
              {c}
            </h1>
          ),
          h2: ({ children: c }) => (
            <h2 className="text-base font-semibold mt-2 first:mt-0 mb-1.5 leading-snug">
              {c}
            </h2>
          ),
          h3: ({ children: c }) => (
            <h3 className="text-[0.95rem] font-semibold mt-1.5 mb-1 leading-snug">
              {c}
            </h3>
          ),
          p: ({ children: c }) => (
            <p className="my-1.5 first:mt-0 last:mb-0">{c}</p>
          ),
          ul: ({ children: c }) => (
            <ul className="my-1.5 list-disc pl-5 space-y-0.5">{c}</ul>
          ),
          ol: ({ children: c }) => (
            <ol className="my-1.5 list-decimal pl-5 space-y-0.5">{c}</ol>
          ),
          li: ({ children: c }) => <li className="leading-relaxed">{c}</li>,
          blockquote: ({ children: c }) => (
            <blockquote className="my-2 border-l-[3px] border-primary/50 pl-3 text-muted-foreground italic">
              {c}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-border" />,
          strong: ({ children: c }) => (
            <strong className="font-semibold">{c}</strong>
          ),
          code: ({ className: codeClass, children: c }) => {
            const isFenced = Boolean(codeClass?.includes("language-"))
            if (isFenced) {
              return <code className={codeClass}>{c}</code>
            }
            return (
              <code
                className={cn(
                  "rounded px-1 py-0.5 text-[0.8125rem] font-mono",
                  isUser ? "bg-primary-foreground/15" : "bg-background/80"
                )}
              >
                {c}
              </code>
            )
          },
          pre: ({ children: c }) => (
            <pre
              className={cn(
                "my-2 overflow-x-auto rounded-lg border px-3 py-2.5 font-mono text-xs leading-relaxed",
                isUser
                  ? "border-primary-foreground/20 bg-primary-foreground/10"
                  : "border-border bg-background/90"
              )}
            >
              {c}
            </pre>
          ),
          table: ({ children: c }) => (
            <div className="my-2 w-full overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[240px] border-collapse text-left text-xs">
                {c}
              </table>
            </div>
          ),
          thead: ({ children: c }) => (
            <thead className="bg-muted/80">{c}</thead>
          ),
          tbody: ({ children: c }) => <tbody>{c}</tbody>,
          tr: ({ children: c }) => (
            <tr className="border-b border-border last:border-0">{c}</tr>
          ),
          th: ({ children: c }) => (
            <th className="border border-border px-2 py-1.5 font-semibold">
              {c}
            </th>
          ),
          td: ({ children: c }) => (
            <td className="border border-border px-2 py-1.5 align-top">{c}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
