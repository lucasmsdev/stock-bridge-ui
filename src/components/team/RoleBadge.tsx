import { Badge } from "@/components/ui/badge";
import { Shield, Edit, Eye } from "lucide-react";
import { OrgRole } from "@/hooks/useOrganization";

interface RoleBadgeProps {
  role: OrgRole;
  className?: string;
}

const roleConfig: Record<OrgRole, { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "outline" }> = {
  admin: {
    label: "Admin",
    icon: Shield,
    variant: "default",
  },
  operator: {
    label: "Operador",
    icon: Edit,
    variant: "secondary",
  },
  viewer: {
    label: "Visualizador",
    icon: Eye,
    variant: "outline",
  },
};

export const RoleBadge = ({ role, className }: RoleBadgeProps) => {
  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};
