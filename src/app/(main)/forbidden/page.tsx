import { PageHeader } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <PageHeader
      title="This role cannot open that page"
      subtitle="Ask an admin to change the permission toggles for your role if you need access."
    />
  );
}
