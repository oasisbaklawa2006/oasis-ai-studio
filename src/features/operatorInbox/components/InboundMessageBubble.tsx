import type { ReactNode } from "react";
import type { InboundWhatsAppMessage } from "../types";

type InboundMessageBubbleProps = {
  message: InboundWhatsAppMessage;
  children?: ReactNode;
};

export function InboundMessageBubble({ message, children }: InboundMessageBubbleProps) {
  return (
    <div className="flex gap-3" data-testid={`inbound-message-${message.id}`}>
      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
        {message.customer_label.charAt(0)}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{message.customer_label}</span>
          <time dateTime={message.received_at}>
            {new Date(message.received_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        <div className="inline-block max-w-[95%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm">
          {message.body}
        </div>
        {children}
      </div>
    </div>
  );
}
