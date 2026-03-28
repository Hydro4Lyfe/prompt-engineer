"use client";

import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyClipboard } from "@/lib/hooks/use-copy-clipboard";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const { copied, copy } = useCopyClipboard();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => copy(text)}
      className={className}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="mr-1.5 h-4 w-4" />
          Copy
        </>
      )}
    </Button>
  );
}
