import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function PreviewPage() {
  const [showPreview, setShowPreview] = useState(true);

  if (!showPreview) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Button
          onClick={() => setShowPreview(true)}
          variant="default"
          data-testid="button-show-preview"
        >
          Показати превʼю
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-background flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-card-border">
        <h1 className="font-semibold">Превʼю интерфейсів</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowPreview(false)}
          data-testid="button-close-preview"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-1 gap-2 min-h-0">
        {/* Client Preview */}
        <div className="flex-1 flex flex-col min-h-0 border border-card-border rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-card border-b border-card-border text-sm font-medium">
            👤 Клієнт
          </div>
          <iframe
            src="/client"
            className="flex-1 border-0"
            title="Client Preview"
            data-testid="iframe-client-preview"
          />
        </div>

        {/* Driver Preview */}
        <div className="flex-1 flex flex-col min-h-0 border border-card-border rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-card border-b border-card-border text-sm font-medium">
            🚗 Водій
          </div>
          <iframe
            src="/driver"
            className="flex-1 border-0"
            title="Driver Preview"
            data-testid="iframe-driver-preview"
          />
        </div>
      </div>
    </div>
  );
}
