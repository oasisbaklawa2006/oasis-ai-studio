import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const AccessRestricted = ({ note }: { note?: string }) => (
  <div className="card-elevated p-10 text-center max-w-lg mx-auto mt-10">
    <Lock className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
    <div className="font-display text-2xl mb-2">Access restricted</div>
    <p className="text-sm text-muted-foreground mb-6">{note ?? "Your role does not have access to this page. Contact an Owner or Admin to request access."}</p>
    <Button asChild variant="outline"><Link to="/">Back to dashboard</Link></Button>
  </div>
);
